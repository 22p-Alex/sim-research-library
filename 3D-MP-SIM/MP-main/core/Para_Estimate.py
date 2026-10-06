"""3D-MP-SIM 的参数估计模块

通过互相关和 EMD（经验模态分解）估计照明波矢 (PGxy, PGz)、
调制深度 (C) 和初始相位 (fai)，支持整数像素估计和亚像素精调。
"""
import datetime

import numpy as np
import torch
import matplotlib.pyplot as plt
import cv2
import math

import Utils as _U
import WindowF as _WF
import DataProcess as _DP
from pathlib import Path
from PyEMD import EMD

# numpy / torch FFT 简写
fft2 = np.fft.fft2
ifft2 = np.fft.ifft2
fftn = np.fft.fftn
ifftn = np.fft.ifftn
fftshift = np.fft.fftshift
ifftshift = np.fft.ifftshift

tfft2 = torch.fft.fft2
tifft2 = torch.fft.ifft2
# 注：tfftn / tifftn 为不带 shift 的 torch 版本，
# 用于 dft_corr2d/3d（依赖 `s` 输出形状参数），
# 移位版本的 Utils 辅助函数 (_U.tfftn / _U.tifftn) 在 _move_terms 中显式使用。
tfftn = torch.fft.fftn
tifftn = torch.fft.ifftn
tfftshift = torch.fft.fftshift
tifftshift = torch.fft.ifftshift


# ===========================================================================
# 小型辅助函数
# ===========================================================================

#=== '元素全反转（保持形状）' ===#
def flip180(arr):
    """对数组执行完整元素顺序反转（遗留本地辅助函数）。

    Parameters
    ----------
    arr : np.ndarray
        输入数组。

    Returns
    -------
    np.ndarray
        反转后的数组副本。
    """
    return np.flip(arr).copy()


#=== '生成圆形结构元素' ===#
def _circular_kernel(size):
    """构建指定尺寸的圆形二值结构元素。

    Parameters
    ----------
    size : int
        结构元素边长，0 时返回 None。

    Returns
    -------
    np.ndarray or None
        圆形二值核 (size, size)。
    """
    if size == 0:
        return None
    r = size // 2
    yy, xx = np.ogrid[:size, :size]
    return (np.sqrt((xx - r) ** 2 + (yy - r) ** 2) <= r).astype(np.uint8)


#=== '圆形腐蚀 (本地版)' ===#
def Cir_Erode(data, size=3):
    """对 2D 数据执行圆形腐蚀（本地版，仅警告而非抛出异常）。

    Parameters
    ----------
    data : np.ndarray
        2D 输入数据。
    size : int
        结构元素尺寸。

    Returns
    -------
    np.ndarray
        腐蚀后数据。
    """
    if size == 0:
        return data
    out = cv2.erode(data, _circular_kernel(size))
    if np.mean(data) != 0 and np.mean(out) == 0:
        print('3D 腐蚀过度，需减小结构元素尺寸')
    return out


#=== '逐层圆形腐蚀 (3D)' ===#
def Cir_Erode_3D(data, size=3):
    """对 3D 数据逐层执行圆形腐蚀。

    Parameters
    ----------
    data : np.ndarray
        3D 输入数据。
    size : int
        结构元素尺寸。

    Returns
    -------
    np.ndarray
        腐蚀后的 3D 数据。
    """
    data2 = _U.image_reshape(data, dim=3)
    for i in range(data2.shape[0]):
        data2[i] = Cir_Erode(data[i], size=size)
    return data2


#=== '判断 2D/3D 处理路径' ===#
def _flag_for_j(j, cfai):
    """根据级次 j 和 cfai 值判断使用 2D 还是 3D 处理路径。

    Parameters
    ----------
    j : int
        级次编号。
    cfai : int
        cfai 参数。

    Returns
    -------
    int
        0 = 2D 路径（±2 级），1 = 3D 路径（±1 级）。
    """
    return 0 if (j < 3 and cfai != 4) else 1


#=== '缓存坐标网格' ===#
def _cached_meshgrid(opt, xy_expand=2, z_expand=None):
    """缓存 (ZV, XV, YV) 网格到 ``opt`` 上，按网格形状索引。

    ``LiheXYZ`` 和 ``cal_c_fai`` 在相同网格下被调用数十次，
    每次重新计算网格是主要瓶颈，缓存可显著加速。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    xy_expand : int
        XY 扩展倍数。
    z_expand : int or None
        Z 扩展倍数，None 则使用 opt.z_expand。

    Returns
    -------
    zv, xv, yv : np.ndarray
        缓存的稀疏网格坐标。
    """
    if z_expand is None:
        z_expand = opt.z_expand
    key = (xy_expand, z_expand, opt.nx, opt.ny, opt.nz_re)
    cache = getattr(opt, '_meshgrid_cache', {})
    if key not in cache:
        cache[key] = _U.meshgrid(opt, xy_expand=xy_expand, z_expand=z_expand)
        opt._meshgrid_cache = cache
    return cache[key]


# ===========================================================================
# 互相关计算 (基于 DFT)
# ===========================================================================

#=== '2D 互相关 (DFT 实现)' ===#
def dft_corr2d(opt, h, g):
    """通过 FFT 实现 2D 互相关，用于整数像素位移估计。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    h, g : torch.Tensor
        两个 2D 输入张量。

    Returns
    -------
    np.ndarray
        2D 互相关结果。
    """
    g = torch.conj(g)
    g = flip180(g.resolve_conj().numpy())
    k = np.array(h.shape)
    L = np.array(g.shape)
    g = _U.ToTensor(g)
    h = _U.ToTensor(h)
    f = tifftn(tfftn(h, s=tuple(k + L - 1)) * tfftn(g, s=tuple(k + L - 1)))
    nx, ny = f.shape
    if nx != (k + L)[0]:
        f = _U.pad_or_cut(f, x=(k + L)[0], y=(k + L)[1])
    return _U.ToNumpy(f)


#=== '3D 互相关 (DFT 实现)' ===#
def dft_corr3d(opt, h, g):
    """通过 FFT 实现 3D 互相关，用于 Z 方向整数位移估计。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    h, g : torch.Tensor
        两个 3D 输入张量。

    Returns
    -------
    np.ndarray
        3D 互相关结果。
    """
    g = torch.conj(g)
    g = flip180(g.resolve_conj().numpy())
    k = np.array(h.shape)
    L = np.array(g.shape)
    g = _U.ToTensor(g)
    h = _U.ToTensor(h)
    f = tifftn(tfftn(h, s=tuple(k + L - 1)) * tfftn(g, s=tuple(k + L - 1)))
    nz, nx, ny = f.shape
    if nx != (k + L)[0]:
        f = _U.pad_or_cut(f, x=(k + L)[1], y=(k + L)[2], z=(k + L)[0])
    return _U.ToNumpy(f)


# ===========================================================================
# 参数文件读写
# ===========================================================================

#=== '保存 PGxy / PGz / cfai 为 .npy 文件' ===#
def saveparameter(path, PGxy, PGz, cfai, run_parameter):
    """将估计出的 PGxy / PGz / cfai 保存为 .npy 文件。

    Parameters
    ----------
    path : str or Path
        保存目录。
    PGxy : np.ndarray
        横向波矢估计值。
    PGz : np.ndarray
        轴向波矢估计值。
    cfai : np.ndarray
        调制深度与相位估计值。
    run_parameter : dict
        运行参数，含 ``filename``, ``Dr_sub``, ``pzzz``。
    """
    path = Path(str(path))
    filename = run_parameter['filename']
    dr_sub = run_parameter['Dr_sub']
    pzz = str(run_parameter['pzzz'])
    sep = '\\'  # 遗留分隔符，保留以维持文件命名兼容
    if PGxy.any():
        np.save(str(path) + sep + 'PGxy' + '-' + dr_sub + '-' + filename
                + '-' + pzz + '.npy', PGxy)
    if PGz.any():
        np.save(str(path) + sep + 'PGz' + '-' + dr_sub + '-' + filename
                + '-' + pzz + '.npy', PGz)
    if cfai.any():
        np.save(str(path) + sep + 'cfai' + '-' + dr_sub + '-' + filename
                + '-' + pzz + '.npy', cfai)


#=== '保存二阶 cfai (cfa02)' ===#
def saveparameter02(path, cfai, run_parameter):
    """保存二阶分量的 cfai（cfa02）为 .npy 文件。

    Parameters
    ----------
    path : str or Path
        保存目录。
    cfai : np.ndarray
        二阶分量的 cfai。
    run_parameter : dict
        运行参数。
    """
    path = Path(str(path))
    filename = run_parameter['filename']
    dr_sub = run_parameter['Dr_sub']
    pzz = str(run_parameter['pzzz'])
    sep = '\\'
    if cfai.any():
        np.save(str(path) + sep + 'cfa02' + '-' + dr_sub + '-' + filename
                + '-' + pzz + '.npy', cfai)


#=== '扫描参数目录并加载已保存的数组' ===#
def _scan_param_files(path):
    """扫描参数目录，加载已保存的 PGxy/PGz/cfai/cfa02 数组。

    Parameters
    ----------
    path : str or Path
        参数目录路径。

    Returns
    -------
    dict
        键为 'PGxy', 'PGz', 'cfai', 'cfa02'，值为对应的 np.ndarray。
    """
    found = {}
    for ldr_i in Path(str(path)).iterdir():
        if not ldr_i.is_file():
            continue
        name = ldr_i.name
        if 'PGxy' in name:
            print(f'加载 PGxy: {name}')
            found['PGxy'] = np.load(ldr_i)
        elif 'cfai' in name:
            print(f'加载 cfai: {name}')
            found['cfai'] = np.load(ldr_i)
        elif 'PGz' in name:
            print(f'加载 PGz: {name}')
            found['PGz'] = np.load(ldr_i)
        elif 'cfa02' in name:
            print(f'加载 cfai02: {name}')
            found['cfa02'] = np.load(ldr_i)
    return found


#=== '从 PGxy 计算平均波矢长度' ===#
def _plong_from_pgxy(opt, PGxy):
    """根据 PGxy 估算平均照明波矢长度。

    Parameters
    ----------
    opt : Namespace
        参数对象，含 ``Nangles``, ``Norders``, ``nc``。
    PGxy : np.ndarray
        各方向各阶的 XY 波矢 (Nangles, Norders, 2)。

    Returns
    -------
    float
        平均波矢长度。
    """
    plong = 0
    for i in range(opt.Nangles):
        for j in range(1, 3):  # ±2 级
            plong += np.sqrt(PGxy[i, j, 0] ** 2 + PGxy[i, j, 1] ** 2)
        for j in range(3, opt.Norders):  # ±1 级
            plong += np.sqrt(PGxy[i, j, 0] ** 2 + PGxy[i, j, 1] ** 2) * 2
    return plong / (opt.nc - 3)


#=== '加载 cfai, PGxy, PGz (含 plong 推导)' ===#
def loadparameter(opt, path, run_parameter):
    """从参数目录加载 cfai、PGxy、PGz，并推导 plong。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    path : str or Path
        参数文件目录。
    run_parameter : dict
        运行参数。

    Returns
    -------
    cfai, PGxy, PGz, plong : np.ndarray, np.ndarray, np.ndarray, float
    """
    found = _scan_param_files(path)
    PGz = found.get('PGz', np.zeros((3, 7)))
    PGxy = found['PGxy']
    cfai = found['cfai']
    plong = _plong_from_pgxy(opt, PGxy)
    return cfai, PGxy, PGz, plong


#=== '仅加载 PGxy / PGz (含 plong)' ===#
def loadparameter2(opt, path, run_parameter):
    """仅加载 PGxy 和 PGz，不加载 cfai。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    path : str or Path
        参数文件目录。
    run_parameter : dict
        运行参数。

    Returns
    -------
    PGxy, PGz, plong : np.ndarray, np.ndarray, float
    """
    found = _scan_param_files(path)
    PGz = found.get('PGz', np.zeros((3, 7)))
    if 'PGz' not in found:
        print('加载参数失败')
    PGxy = found['PGxy']
    plong = _plong_from_pgxy(opt, PGxy)
    return PGxy, PGz, plong


#=== '仅加载单个 cfai.npy' ===#
def loadparameter3(opt, path):
    """从单个 cfai.npy 文件加载 cfai。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    path : str
        包含 cfai.npy 的目录路径。

    Returns
    -------
    np.ndarray or None
        cfai 数组，失败时返回 None。
    """
    try:
        return np.load(path + 'cfai.npy')
    except Exception:
        print('加载参数失败')
        return None


#=== '加载二阶 cfai02' ===#
def loadparameter4(opt, path, run_parameter):
    """加载 cfa02（二阶分量 cfai）。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    path : str or Path
        参数目录。
    run_parameter : dict
        运行参数。

    Returns
    -------
    np.ndarray
        cfa02 数组。

    Raises
    ------
    FileNotFoundError
        若找不到 cfa02 文件。
    """
    found = _scan_param_files(path)
    if 'cfa02' not in found:
        raise FileNotFoundError('未找到 cfai02')
    return found['cfa02']


# ===========================================================================
# 整数像素估计 (XY / Z)
# ===========================================================================

#=== 'XY 互相关环带滤波与峰值定位' ===#
def _lihe_xy_filter(opt, lihe, i, j, save=True):
    """对 XY 互相关结果施加环带通滤波器并定位峰值。

    在波矢长度的预期范围内保留信号，滤除范围外的噪声。

    Parameters
    ----------
    opt : Namespace
        含 ``pg``（预期波矢长度）、``fanwei``（搜索范围）、``nx``、``ny``。
    lihe : np.ndarray
        2D 互相关幅度图。
    i, j : int
        方向和级次索引（用于保存文件名）。
    save : bool
        是否保存中间结果。

    Returns
    -------
    px, py : int
        波矢峰值的整数像素坐标（相对于中心）。
    """
    XV, YV = _U.meshgridxy(opt, xy_expand=2)
    kr = np.sqrt(XV ** 2 + YV ** 2)
    lihe[kr > (opt.pg + opt.fanwei)] = 0
    lihe[kr < (opt.pg - opt.fanwei)] = 0
    lihe = np.abs(lihe)
    if save:
        _U.save_tif(f"4 lihe-pxy-{i}-{j}.tif", lihe)
    opt.lihe2d.append(lihe)
    m = np.max(lihe)
    idx = np.where(lihe == m)
    return idx[0][0] - opt.nx, idx[1][0] - opt.ny


#=== 'XY 方向整数像素位移估计 (3D 输入)' ===#
def get_intpxy(opt, ck0, ck1, i, j, methods='FAN'):
    """通过 2D 互相关估计 XY 方向的整数像素位移（输入为 3D 数据）。

    取 ck0/ck1 的中心 Z 层进行相位相关计算，支持 'FAN' 和 'SHAO' 两种方法。

    Parameters
    ----------
    opt : Namespace
        参数对象，含 ``OTFmask2D``, ``eps`` 等。
    ck0, ck1 : np.ndarray
        两个 3D 频域分量 (nz, nx, ny)。
    i, j : int
        方向和级次索引。
    methods : str
        'FAN' = 归一化相位相关 + OTF 掩膜，
        'SHAO' = 空域共轭乘积的 FFT 峰值。

    Returns
    -------
    px, py : int
        XY 方向的整数位移（像素）。
    """
    assert len(ck0.shape) == 3 and len(ck1.shape) == 3
    nz, nx, ny = ck0.shape
    print(nz, nx, ny)
    if methods == 'FAN':
        # OTF 掩膜自相关作为归一化分母
        otf_mask_tensor = _U.ToTensor(_U.pad_or_cut(opt.OTFmask2D, x=nx, y=ny))
        otf_mask_tensor = _U.image_reshape(otf_mask_tensor, dim=2)
        assert len(otf_mask_tensor.shape) == 2
        denominator = abs(dft_corr2d(opt, otf_mask_tensor, otf_mask_tensor))
        _U.save_tif('denominator.tif', denominator.real)

        # 提取中心 Z 层并归一化相位
        slice0 = ck0[nz // 2]
        phase0 = slice0 / (np.abs(slice0) + opt.eps)
        slice1 = ck1[nz // 2]
        phase1 = slice1 / (np.abs(slice1) + opt.eps)

        phase0 = _U.ToTensor(phase0)
        phase1 = _U.ToTensor(phase1)
        result = dft_corr2d(opt, phase0, phase1)
        lihe = abs(result / (denominator + opt.eps))
    elif methods == 'SHAO':
        # 空域共轭乘积法
        ck0_pad = _U.pad_or_cut(ck0, x=2 * nx, y=2 * ny, z=1 * nz)
        ck1_pad = _U.pad_or_cut(ck1, x=2 * nx, y=2 * ny, z=1 * nz)
        spatial0 = _U.ifftn(ck0_pad)
        spatial1 = _U.ifftn(ck1_pad)
        lihe = np.max(np.abs(_U.fftn(spatial0 * spatial1.conj()))
                      / 1000, axis=0)
    return _lihe_xy_filter(opt, lihe, i, j, save=True)


#=== 'XY 方向整数像素位移估计 (2D 输入)' ===#
def get_intpxy_2D(opt, ck0, ck1, i, j, methods='FAN'):
    """通过 2D 互相关估计 XY 方向的整数像素位移（输入为 2D 数据）。

    与 :func:`get_intpxy` 逻辑一致，但直接处理 2D 切片。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    ck0, ck1 : np.ndarray
        两个 2D 频域分量 (nx, ny)。
    i, j : int
        方向和级次索引。
    methods : str
        'FAN' 或 'SHAO'。

    Returns
    -------
    px, py : int
        XY 方向的整数位移。
    """
    assert len(ck0.shape) == 2 and len(ck1.shape) == 2
    nz, nx, ny = ck0.shape
    print(nz, nx, ny)
    if methods == 'FAN':
        otf_mask_tensor = _U.ToTensor(_U.pad_or_cut(opt.OTFmask2D, x=nx, y=ny))
        otf_mask_tensor = _U.image_reshape(otf_mask_tensor, dim=2)
        assert len(otf_mask_tensor.shape) == 2
        denominator = abs(dft_corr2d(opt, otf_mask_tensor, otf_mask_tensor))
        _U.save_tif('denominator.tif', denominator.real)

        phase0 = ck0 / (np.abs(ck0) + opt.eps)
        phase1 = ck1 / (np.abs(ck1) + opt.eps)
        _U.save_tif('imagf0AC.tif', phase0.real)
        phase0 = _U.ToTensor(phase0)
        phase1 = _U.ToTensor(phase1)
        result = dft_corr2d(opt, phase0, phase1)
        _U.save_tif('result.tif', result.real)
        lihe = abs(result / (denominator + opt.eps))
    elif methods == 'SHAO':
        ck0_pad = _U.pad_or_cut(ck0, x=2 * nx, y=2 * ny, z=1 * nz)
        ck1_pad = _U.pad_or_cut(ck1, x=2 * nx, y=2 * ny, z=1 * nz)
        spatial0 = _U.ifftn(ck0_pad)
        spatial1 = _U.ifftn(ck1_pad)
        lihe = np.max(np.abs(_U.fftn(spatial0 * spatial1.conj()))
                      / 1000, axis=0)
    return _lihe_xy_filter(opt, lihe, i, j, save=False)


#=== 'Z 方向整数像素位移估计' ===#
def get_intpz(opt, ck0, ck1, i, j, methods='FAN'):
    """通过 3D 互相关估计 Z 方向的整数像素位移。

    Parameters
    ----------
    opt : Namespace
        参数对象，含 ``OTFmask3D``, ``pg``, ``fanwei``, ``pgz`` 等。
    ck0, ck1 : np.ndarray
        两个 3D 频域分量 (nz, nx, ny)。
    i, j : int
        方向和级次索引。
    methods : str
        'FAN' = 归一化相位相关 + 3D OTF 掩膜，
        'SHAO' = 空域共轭乘积法。

    Returns
    -------
    pz, px, py : int
        Z, X, Y 方向的整数位移（像素）。
    """
    assert len(ck0.shape) == 3
    nz, nx, ny = ck0.shape
    ck0 = ck0 / np.max(abs(ck0))
    ck1 = ck1 / np.max(abs(ck1))
    notch_filter = _WF.getotfAtt(opt, fwhm=0.2 * 1000 / opt.fc)
    erosion_size = 0

    if methods == 'FAN':
        otf_mask = _U.pad_or_cut(opt.OTFmask3D, x=nx, y=ny, z=nz)
        otf_mask = _U.ToTensor(Cir_Erode(otf_mask, size=erosion_size))
        denominator = abs(dft_corr3d(opt, otf_mask, otf_mask))
        phase0 = _U.ToTensor(ck0 / (np.abs(ck0) + opt.eps)) * otf_mask
        phase1 = _U.ToTensor(ck1 / (np.abs(ck1) + opt.eps)) * otf_mask
        result = dft_corr3d(opt, phase0, phase1)
        lihe = abs(result / (denominator + opt.eps))
        lihe = _U.pad_or_cut(lihe, x=nx, y=ny, z=2 * nz)
    elif methods == 'SHAO':
        ck0_pad = _U.pad_or_cut(ck0, x=nx, y=ny, z=2 * nz)
        ck1_pad = _U.pad_or_cut(ck1, x=nx, y=ny, z=2 * nz)
        otf_mask = Cir_Erode(_U.pad_or_cut(opt.OTFmask3D, x=nx, y=ny, z=2 * nz),
                             size=erosion_size)
        ck0_masked = ck0_pad * otf_mask * notch_filter
        ck1_masked = ck1_pad * otf_mask * notch_filter
        spatial0 = _U.ifftn(ck0_masked)
        spatial1 = _U.ifftn(ck1_masked)
        lihe = abs(_U.fftn(spatial0 * spatial1.conj())) / 1000

    # 施加 XY 环带滤波器 + Z 范围限制
    XV, YV = _U.meshgridxy(opt, xy_expand=1)
    kr = np.sqrt(XV ** 2 + YV ** 2)
    lihe = abs(lihe / np.max(lihe))
    lihe[:, kr > (opt.pg + opt.fanwei)] = 0
    lihe[:, kr < (opt.pg - opt.fanwei)] = 0
    lihe[0:nz - opt.pgz] = 0
    lihe[nz + opt.pgz:] = 0
    lihe[nz] = 0

    opt.lihe3d.append(lihe)
    opt.lihe3dxy.append(np.max(abs(lihe) / 10, axis=2))

    m = np.max(lihe)
    idx = np.where(lihe == m)
    return (int(idx[0][0] - (opt.nz_re / 2)),
            int(idx[1][0] - opt.nx / 2),
            int(idx[2][0] - opt.ny / 2))


# ===========================================================================
# 亚像素精调
# ===========================================================================

#=== 'XY 亚像素精调 (交替坐标下降)' ===#
def get_subpxy(opt, i, j, ck_0, ck_p, pgx, pgy, func):
    """通过交替坐标下降法对 XY 波矢进行亚像素精调。

    在 X 和 Y 方向上交替搜索，步长逐步二分缩小，直到收敛。

    注：原代码在内层循环中复用 ``i`` 作为循环变量，
    这会遮蔽方向索引。此处使用 ``k`` 作为探测循环变量以保持正确性。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    i, j : int
        方向和级次索引。
    ck_0, ck_p : np.ndarray
        0 级参考分量和目标级分量。
    pgx, pgy : float
        整数像素估计的初始值。
    func : callable
        重叠代价函数 (LiheXYZ)。

    Returns
    -------
    pgx, pgy : float
        精调后的亚像素 XY 波矢。
    """
    xstep = ystep = 1
    step_x = xstep
    step_y = ystep
    precision = 0.05

    PXY = np.array([pgx, pgy]) / (2 * opt.nx)
    best_cost = func(opt, i, j, ck_0, ck_p, PXY[0], PXY[1])

    while step_x > precision or step_y > precision:
        test = np.zeros(4)

        # ---- X 轴梯度探测 ----
        for k in range(2):
            x_test = pgx - 1e-5 if k == 0 else pgx + 1e-5
            PXY = np.array([x_test, pgy]) / (2 * opt.nx)
            test[k] = func(opt, i, j, ck_0, ck_p, PXY[0], PXY[1])

        if test[0] > test[1]:
            direction_x = -1
        elif test[0] < test[1]:
            direction_x = 1
        else:
            try:
                direction_x = -direction_x
            except NameError:
                direction_x = 1

        while step_x > precision:
            x_test = pgx + direction_x * step_x
            PXY = np.array([x_test, pgy]) / (2 * opt.nx)
            cost_tmp = func(opt, i, j, ck_0, ck_p, PXY[0], PXY[1])
            if cost_tmp <= best_cost:
                step_x = step_x * 0.5
            else:
                print("更新 pgx =", x_test, 'cost = ', cost_tmp)
                pgx = x_test
                best_cost = cost_tmp
                step_y = ystep
                break

        # ---- Y 轴梯度探测 ----
        for k in range(2, 4):
            y_test = pgy - 1e-5 if k == 2 else pgy + 1e-5
            PXY = np.array([pgx, y_test]) / (2 * opt.ny)
            test[k] = func(opt, i, j, ck_0, ck_p, PXY[0], PXY[1])

        if test[2] > test[3]:
            direction_y = -1
        elif test[2] < test[3]:
            direction_y = 1
        else:
            try:
                direction_y = -direction_y
            except NameError:
                direction_y = 1

        while step_y > precision:
            y_test = pgy + direction_y * step_y
            PXY = np.array([pgx, y_test]) / (2 * opt.ny)
            cost_tmp = func(opt, i, j, ck_0, ck_p, PXY[0], PXY[1])
            if cost_tmp <= best_cost:
                step_y = step_y * 0.5
            else:
                print("更新 pgy =", y_test, 'cost = ', cost_tmp)
                pgy = y_test
                best_cost = cost_tmp
                step_x = xstep
                break

    return pgx, pgy


#=== 'Z 亚像素精调 (等分搜索)' ===#
def get_subpz(opt, i, j, ck_0, ck_p, pgx, pgy, pgz, m, func, precision=0.1,
              search_range=6):
    """通过等分搜索在 pgz 附近进行 Z 方向亚像素精调。

    在 ``pgz ± search_range * precision`` 范围内等距计算代价函数，
    选取最大值对应的 pgz。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    i, j : int
        方向与级次索引。
    ck_0, ck_p : np.ndarray
        参考分量和目标分量。
    pgx, pgy : float
        已确定的 XY 波矢。
    pgz : float
        Z 波矢的初始估计。
    m : int
        级次标记，传递给代价函数。
    func : callable
        代价函数 (LiheXYZ)。
    precision : float
        搜索步长（像素单位）。
    search_range : int
        单侧搜索点数。

    Returns
    -------
    float
        精调后的亚像素 pgz。
    """
    nz = opt.nz + 2 * opt.Zpadding
    nx = opt.nx
    PXY = np.array([pgx, pgy]) / (2 * nx)
    print('ck_p.shape', ck_p.shape)
    print('nz=', nz)
    PGZ = pgz / (nz * 2)

    best_cost = func(opt, i, j, ck_0, ck_p, PXY[0], PXY[1], PGZ, m)
    cost_array = np.zeros(2 * search_range - 1)
    cost_array[search_range - 1] = best_cost
    print('基准：', best_cost.round(6))
    for ii in range(1, search_range):
        print('+', ii, ' ', pgz + ii * precision)
        PGZ = (pgz + ii * precision) / (nz * 2)
        temp = func(opt, i, j, ck_0, ck_p, PXY[0], PXY[1], PGZ, m)
        print(temp.round(6))
        cost_array[(search_range - 1) + ii] = temp
    for ii in range(1, search_range):
        print('-', ii, ' ', pgz - ii * precision)
        PGZ = (pgz - ii * precision) / (nz * 2)
        temp = func(opt, i, j, ck_0, ck_p, PXY[0], PXY[1], PGZ, m)
        cost_array[(search_range - 1) - ii] = temp
        print(temp.round(6))
    print(cost_array)

    X = np.linspace(-(search_range - 1) * precision + pgz,
                    (search_range - 1) * precision + pgz, search_range * 2 - 1)
    fig = plt.figure()
    ax = fig.add_axes([0, 0, 1, 1])
    ax.bar(X, cost_array, color='b', width=precision / 2)
    plt.xlim(-(search_range - 1) * precision + pgz,
             (search_range - 1) * precision + pgz)

    jj = np.where(cost_array == np.max(cost_array))[0][0]
    if jj > (search_range - 1):
        print('j +', (jj - (search_range - 1)))
        print(pgz + (jj - (search_range - 1)) * precision)
        return pgz + (jj - (search_range - 1)) * precision
    print('j -', ((search_range - 1) - jj))
    print(pgz - ((search_range - 1) - jj) * precision)
    return pgz - ((search_range - 1) - jj) * precision


# ===========================================================================
# 重叠代价 / 调制深度计算 (共享核心)
# ===========================================================================

#=== '安全复数乘法（实数 × 复数）' ===#
def _safe_cmul_real(real_arr: torch.Tensor, complex_arr: torch.Tensor) -> torch.Tensor:
    """实数张量 × 复数张量的安全乘法。

    MPS 后端不支持任何形式的复数 `*` 运算（包括 real × complex）。
    通过 ``torch.view_as_real`` 拆分为纯实数分量完成乘法。

    Parameters
    ----------
    real_arr : torch.Tensor
        实数张量 (..., dtype=float32)。
    complex_arr : torch.Tensor
        复数张量 (..., dtype=complex64)。

    Returns
    -------
    torch.Tensor
        real_arr * complex_arr，复数类型。
    """
    # MPS 不支持任何复杂张量乘法；临时移回 CPU 运算，结果迁回原设备
    device = real_arr.device
    if device.type == 'cpu':
        return real_arr * complex_arr
    return (real_arr.cpu() * complex_arr.cpu()).to(device)


#=== '安全复数乘法（复数 × 复数）' ===#
def _safe_cmul(a: torch.Tensor, b: torch.Tensor) -> torch.Tensor:
    """复数张量 × 复数张量的安全乘法。

    MPS 后端不支持任何形式的复数 `*` 运算。
    直接将张量临时迁回 CPU 完成乘法，再移回原设备。

    Parameters
    ----------
    a : torch.Tensor
        复数张量 (..., dtype=complex64)。
    b : torch.Tensor
        复数张量 (..., dtype=complex64)。

    Returns
    -------
    torch.Tensor
        a * b，复数类型。
    """
    device = a.device
    if device.type == 'cpu':
        return a * b
    return (a.cpu() * b.cpu()).to(device)


#=== '在 GPU 上执行频谱移动' ===#
def _move_terms_on_gpu(opt, ysh, otf, otfmask, imgfm):
    """将 imgfm / otf / otfmask 按 ``ysh`` 在 CPU 上平移。

    MPS 后端对复数乘法存在不稳定兼容性问题（ComplexDouble 转换失败），
    此函数仅在参数估计阶段调用，数据量较小，直接在 CPU 上完成全部运算。

    Parameters
    ----------
    opt : Namespace
        含 ``device`` 属性。
    ysh : np.ndarray
        相位移动因子 exp(2πi·k·r)。
    otf : np.ndarray
        系统 OTF。
    otfmask : np.ndarray
        OTF 支撑域掩膜。
    imgfm : np.ndarray
        待平移的频域图像。

    Returns
    -------
    imgfm_move, otf_move, otfmask_move : np.ndarray
        平移后的三个数组。
    """
    ysh_t = torch.from_numpy(np.ascontiguousarray(ysh)).cpu()
    otf_t = torch.from_numpy(np.ascontiguousarray(otf)).cpu()
    otfmask_t = torch.from_numpy(np.ascontiguousarray(otfmask)).cpu()
    imgfm_t = torch.from_numpy(np.ascontiguousarray(imgfm)).cpu()

    # 频域相位乘法 = IFFT(imgfm_t) × ysh_t（CPU 上复数乘法完全正常）
    spat = _U.tifftn(imgfm_t)
    imgfm_move = _U.tfftn(spat * ysh_t)

    psf_ = tfftshift(_U.tifftn(otf_t)).real
    otf_move = abs(_U.tfftn(tifftshift(psf_ * ysh_t)))

    psf_mask_ = tfftshift(_U.tifftn(otfmask_t)).real
    otfmask_move = abs(_U.tfftn(tifftshift(psf_mask_ * ysh_t)))
    otfmask_move[otfmask_move > 0.9] = 1
    otfmask_move[otfmask_move != 1] = 0

    return (imgfm_move.numpy(), otf_move.numpy(),
            otfmask_move.numpy())


#=== '重叠代价函数 LiheXYZ' ===#
def LiheXYZ(opt, i, j, ck_0, ck_p, kx, ky, kz=0, m=2, cfai=0, mask_ger=0,
            run_parameter=''):
    """计算给定频移 (kx, ky, kz) 下的重叠代价。

    支持 2D 路径（j<3 且 cfai≠4）和 3D 路径（±1 级）。
    重叠代价定义为移动后 OTF 支撑域内的归一化互相关幅值。

    Parameters
    ----------
    opt : Namespace
        含 OTF, OTFmask, eps 等参数。
    i, j : int
        方向与级次索引。
    ck_0, ck_p : np.ndarray
        0 级参考分量和目标级分量 (nz, nx, ny)。
    kx, ky, kz : float
        频移量（归一化频率坐标）。
    m : int
        级次标记。
    cfai : int
        cfai 参数。
    mask_ger : int
        掩膜生成标志。
    run_parameter : str
        运行参数。

    Returns
    -------
    float
        归一化重叠代价（0~1 之间）。
    """
    flag = _flag_for_j(j, cfai)
    assert len(ck_0.shape) == 3
    nz, nx, ny = ck_0.shape

    ZV, XV, YV = _cached_meshgrid(opt, xy_expand=2, z_expand=opt.z_expand)
    ysh = np.exp(2j * np.pi * (kx * XV + ky * YV + kz * ZV))

    if flag == 0:  # ±2 级，2D 路径
        ysh = ysh[0]
        imgf0AC = ck_0[nz // 2]
        imgf0 = imgf0AC / (abs(imgf0AC) + opt.eps)
        imgf0 = _U.pad_or_cut(imgf0, x=nx * 2, y=ny * 2, z=1)
        otf = opt.OTF2D
        otfmask = opt.OTFmask2D
        imgfmAC = ck_p[nz // 2]
        imgfm = imgfmAC / (abs(imgfmAC) + opt.eps)
        imgfm = _U.pad_or_cut(imgfm, x=nx * 2, y=ny * 2, z=1)
    else:  # ±1 级，3D 路径
        imgf0AC = ck_0
        imgf0 = imgf0AC / (abs(imgf0AC) + opt.eps)
        imgf0 = _U.pad_or_cut(imgf0, x=nx * 2, y=ny * 2, z=opt.nz_re)
        otf = _U.image_reshape(opt.OTF, dim=3)
        otfmask = opt.OTFmask3D
        imgfmAC = ck_p
        imgfm = imgfmAC / (abs(imgfmAC) + opt.eps)
        imgfm = _U.pad_or_cut(imgfm, x=nx * 2, y=ny * 2, z=opt.nz_re)

    imgfm_move, otf_move, otfmask_move = _move_terms_on_gpu(
        opt, ysh, otf, otfmask, imgfm)

    w0 = (imgf0 * otfmask) * (otf_move * otfmask_move)
    w1 = (otf * otfmask) * (imgfm_move * otfmask_move)
    w0 = w0.astype(np.complex64)
    w1 = w1.astype(np.complex64)
    overlap_mask = otfmask_move * otfmask

    overlap_sum = abs(np.sum(w1 * w0.conj()))
    overlap_mask_sum = abs(np.sum(overlap_mask))
    return abs(overlap_sum / overlap_mask_sum)


#=== '计算调制深度 C 和相位 fai' ===#
def cal_c_fai(opt, i, j, ck_0, ck_p, kx, ky, kz=0, filename='',
              run_parameter=""):
    """计算单个分量的调制深度 (C) 和初始相位 (fai)。

    不同于 :func:`LiheXYZ`，此处重新计算腐蚀后的 otfmask_move，
    而非使用位移后的掩膜。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    i, j : int
        方向与级次索引。
    ck_0, ck_p : np.ndarray
        0 级参考和目标级分量。
    kx, ky, kz : float
        归一化频移量。
    filename : str
        输出文件名前缀。
    run_parameter : dict
        运行参数。

    Returns
    -------
    C, fai, C2 : float
        调制深度（EMD 结果）、初始相位、备用调制深度。
    """
    assert len(ck_0.shape) == 3
    nz, nx, ny = ck_0.shape

    ZV, XV, YV = _cached_meshgrid(opt, xy_expand=2, z_expand=opt.z_expand)
    ysh = np.exp(2j * np.pi * (kx * XV + ky * YV + kz * ZV))

    imgf0 = _U.pad_or_cut(np.copy(ck_0), x=nx * 2, y=ny * 2, z=opt.nz_re)
    otf = abs(_U.image_reshape(opt.OTF, dim=3))
    otfmask = opt.OTFmask3D
    imgfm = _U.pad_or_cut(np.copy(ck_p), x=nx * 2, y=ny * 2, z=opt.nz_re)

    otfmask_move, _, _ = _DP.otf_mask_3d_2d(
        opt, PGxy=[kx * (2 * opt.nx), ky * (2 * opt.ny)],
        PGz=[kz * opt.nz_re], Debug=0)
    otfmask_move = Cir_Erode_3D(otfmask_move, size=3)

    imgfm_move, otf_move, _ = _move_terms_on_gpu(
        opt, ysh, otf, otfmask, imgfm)

    w0 = (imgf0 * otfmask) * (otf_move * otfmask_move)
    w1 = (otf * otfmask) * (imgfm_move * otfmask_move)
    overlap_mask = otfmask_move * otfmask
    overlap_mask = Cir_Erode_3D(overlap_mask, size=int(opt.fc // 5))

    overlap_cfai_3D = (w1 / (w0 + opt.eps)) * overlap_mask.astype(np.bool_)
    overlap_c = np.abs(overlap_cfai_3D)
    overlap_fai = np.angle(overlap_cfai_3D
                           / (abs(overlap_cfai_3D) + opt.eps))

    opt.abscm3d.append(overlap_c)
    opt.angcm3d.append(overlap_fai)
    opt.overlap_mask3d.append(overlap_mask)

    C, fai, C2 = Cal_parameter(overlap_c, overlap_fai, 1, i, j, filename,
                               run_parameter)
    return C, fai, C2


# ===========================================================================
# 基于 EMD 的参数提取
# ===========================================================================

#=== '通过直方图 + EMD 提取稳健的 C / fai' ===#
def Cal_parameter(overlap_c, overlap_fai, flag3D, i, j, filename,
                  run_parameter, updown='whole'):
    """从重叠区域的 C 和 fai 分布中提取稳健估计值。

    流程：对 C 和 fai 分别做直方图统计 → EMD 经验模态分解去噪 →
    取 IMF 峰值对应的参数值。

    Parameters
    ----------
    overlap_c : np.ndarray
        逐像素的调制深度。
    overlap_fai : np.ndarray
        逐像素的相位。
    flag3D : int
        0 = 2D，非 0 = 3D。
    i, j : int
        方向与级次索引。
    filename : str
        诊断图文件名。
    run_parameter : dict
        运行参数。
    updown : str
        直方图方向。

    Returns
    -------
    c_value, fai_value, c_mean : float
        EMD 提取的调制深度、初始相位、均值调制深度。
    """
    overlap_c_1d = overlap_c.flatten()[np.argwhere(overlap_c.flatten())].squeeze()
    overlap_fai_1d = overlap_fai.flatten()[np.argwhere(overlap_fai.flatten())].squeeze()
    overlap_fai_1d_T = overlap_fai_1d.T
    overlap_c_1d_T = overlap_c_1d.T

    if flag3D == 0:
        overlap_c_1d_T2 = overlap_c_1d_T * overlap_c_1d_T[::-1]
    else:
        overlap_c_1d_T2 = overlap_c_1d_T ** 2
    overlap_c_ = overlap_c_1d_T2 ** 0.5
    c_mean = np.mean(overlap_c_[(overlap_c_ < 1) & (overlap_c_ > 0.03)])

    # 相位直方图 + EMD
    FAI_interval = 0.02
    FAI_range = np.arange(-np.pi, np.pi, FAI_interval)
    FAI_histogram, _ = np.histogram(overlap_fai_1d_T, FAI_range)
    FAI_histogram[int(np.pi / FAI_interval)] = (
        FAI_histogram[int(np.pi / FAI_interval) + 1]
        + FAI_histogram[int(np.pi / FAI_interval) - 1]) / 2

    fai, FAI_histogram_4pi, FAI_EMD, rate, FAI_idx_max = extend(
        FAI_histogram, j, FAI_interval)

    # 调制深度直方图 + EMD
    C_interval = 0.01
    C_range = np.arange(C_interval, 1 + C_interval, C_interval)
    C_histogram, _ = np.histogram(overlap_c_, C_range)
    emd = EMD()
    C_imf = emd(C_histogram)
    C_EMD = np.sum(C_imf[:, :], 0)
    C_EMD[0:10] = 0
    C_idx_max = np.where(C_EMD == np.max(C_EMD))
    c_value = C_interval * np.mean(C_idx_max) + C_interval

    draw_c_fai(C_histogram, C_EMD, FAI_histogram_4pi, FAI_EMD, i, j,
               np.mean(FAI_idx_max), c_mean, c_value, fai, filename,
               run_parameter, np.mean(C_idx_max), C_interval, FAI_interval)

    if rate > 0.2:
        return c_value, fai, c_mean
    return c_mean, fai, c_value


#=== '绘制 C / fai 诊断图' ===#
def draw_c_fai(c, c2, fa, fa2, i, j, h, c_mean, c_EMD, fai, filename,
               run_parameter, hh, jdc, jdjd):
    """绘制调制深度和相位的诊断图（以 RGB 数组返回）。

    Parameters
    ----------
    c, c2 : np.ndarray
        C 的直方图与 EMD 分解。
    fa, fa2 : np.ndarray
        fai 的直方图与 EMD 分解。
    i, j : int
        方向与级次索引。
    h : float
        相位峰值位置。
    c_mean, c_EMD : float
        均值与 EMD 提取的调制深度。
    fai : float
        EMD 提取的相位。
    filename : str
        文件名前缀。
    run_parameter : dict
        运行参数。
    hh : float
        C 峰值位置。
    jdc, jdjd : float
        C 和 fai 的 bin 宽度。

    Returns
    -------
    np.ndarray
        RGB 诊断图像数组。
    """
    fig = plt.figure(figsize=(15, 3))
    sub1 = plt.subplot(1, 2, 1)
    start = 10
    plt.plot(c2)
    plt.title(f'{i + 1, j}-C-调制深度', fontname='Times New Roman',
              weight='bold')
    sub1.text(0.98, 0.98, 'MEAN:' + str(c_mean.round(2)),
              horizontalalignment='right', verticalalignment='top',
              transform=sub1.transAxes)
    sub1.text(hh, 0, str((c_EMD).round(2)), ha='center', va='bottom')

    tick_positions = [20, 40, 60, 80, 100]
    tick_labels = [np.round(k * jdc, 1) for k in tick_positions]
    sub1.set_xlim((start, 100))
    sub1.set_xticks(tick_positions)
    sub1.set_xticklabels(tick_labels)
    sub1.set_ylim(bottom=0.)

    sub2 = plt.subplot(1, 2, 2)
    plt.plot(fa)
    plt.plot(fa2)
    plt.title(f'{i + 1, j}-φ-相位', fontname='Times New Roman', weight='bold')
    sub2.text(h, 0, fai.round(2), ha='center', va='bottom')
    kedu = [0, 157, 314, 471, 628]
    kedu2 = []
    for kk in kedu:
        offset = np.pi if kk <= 314 else 3 * np.pi
        if kk == 314:
            kedu2.append('±' + str(abs(np.round(kk * jdjd - offset, 2))))
        else:
            kedu2.append(np.round(kk * jdjd - offset, 2))
    sub2.set_xticks(kedu)
    sub2.set_xticklabels(kedu2)
    sub2.set_ylim(bottom=0.)

    return plt2np(plt)


#=== '将 matplotlib 图像转为 numpy RGB 数组' ===#
def plt2np(plt):
    """将当前 matplotlib 图像渲染为 numpy RGB 数组。

    Parameters
    ----------
    plt : module
        matplotlib.pyplot 模块。

    Returns
    -------
    np.ndarray
        RGB 图像数组 (H, W, 3)。
    """
    from matplotlib.backends.backend_agg import FigureCanvasAgg
    import PIL.Image as Image
    canvas = FigureCanvasAgg(plt.gcf())
    canvas.draw()
    w, h = canvas.get_width_height()
    buf = np.frombuffer(canvas.tostring_argb(), dtype=np.uint8)
    buf.shape = (w, h, 4)
    buf = np.roll(buf, 3, axis=2)
    image = Image.frombytes("RGBA", (w, h), buf.tobytes())
    return np.asarray(image)[:, :, :3]


#=== '将相位直方图延拓到两个周期并用 EMD 拟合' ===#
def extend(Initial_phase_curve, j, phase_bin_width):
    """将 -π~π 的相位直方图延拓到两个周期 (-π~3π)，用 EMD 提取峰值。

    根据直方图峰值的比率（rate = max/mean）自适应选择 EMD 的 IMF 层数。

    Parameters
    ----------
    Initial_phase_curve : np.ndarray
        单周期相位直方图。
    j : int
        级次编号。
    phase_bin_width : float
        直方图的 bin 宽度。

    Returns
    -------
    fai, curve_4pi, EMD_curve, rate, idx_max : float, np.ndarray, np.ndarray, float, np.ndarray
    """
    IPC = Initial_phase_curve
    IPC_4pi = np.concatenate((IPC, np.copy(IPC)), axis=0)
    emd = EMD()
    imf = emd(IPC_4pi)

    rate = np.max(IPC_4pi) / np.sum(IPC)
    if rate > 0.02:            # 极高信噪比
        EMD_curve = np.sum(imf[:, :], 0)
    elif rate > 0.013:         # 高信噪比
        EMD_curve = np.sum(imf[1:, :], 0)
    elif rate > 0.008:         # 中信噪比
        EMD_curve = np.sum(imf[2:, :], 0)
    else:                       # 低信噪比
        EMD_curve = np.sum(imf[3:, :], 0)

    nx = IPC_4pi.reshape(-1).shape
    EMD_curve_pre = np.copy(EMD_curve)
    EMD_curve_pre[int(nx[0] / 2):] = 0
    idx_max = np.where(EMD_curve_pre == np.max(EMD_curve_pre))
    fai = np.mean(idx_max) * phase_bin_width - np.pi
    if fai < -2:  # 落入第二周期
        EMD_curve_later = np.copy(EMD_curve)
        EMD_curve_later[:int(nx[0] / 2)] = 0
        idx_max = np.where(EMD_curve_later == np.max(EMD_curve_later))
        fai = np.mean(idx_max) * phase_bin_width - 3 * np.pi
        return fai, IPC_4pi, EMD_curve_later, rate, idx_max
    return fai, IPC_4pi, EMD_curve_pre, rate, idx_max


# ===========================================================================
# 顶层估计循环
# ===========================================================================

#=== '初始化参数估计的中间列表' ===#
def _init_pe_lists(opt):
    """在 ``opt`` 上初始化用于保存参数估计中间结果的列表。"""
    opt.lihe2d = []
    opt.overlap_mask2d = []
    opt.abscm2d = []
    opt.angcm2d = []
    opt.lihe3d = []
    opt.lihe3dxy = []
    opt.overlap_mask3d = []
    opt.abscm3d = []
    opt.angcm3d = []


#=== '组装每个方向的分量堆栈 (RL 为遗留/未使用)' ===#
def _prep_rl_output(ck, Norders, RL=False, opt=None):
    """组装每个方向的分量堆栈。

    RL 反卷积分支为遗留代码，RL 必须保持 False。

    Parameters
    ----------
    ck : np.ndarray or torch.Tensor
        某方向的分离分量。
    Norders : int
        级次数。
    RL : bool
        是否启用 RL 反卷积（必须为 False）。
    opt : Namespace
        参数对象。

    Returns
    -------
    np.ndarray
        组装后的分量堆栈。
    """
    try:
        ck = ck.numpy()
    except AttributeError:
        pass
    if RL:
        RL_output = []
        for j in range(Norders):
            RL_output.append(_U.RL_deconvolve(ck[j], opt.OTF, fre=True))
    else:
        RL_output = [ck[j] for j in range(Norders)]
    return np.array(RL_output)


#=== '3D 多阶参数估计主循环' ===#
def parameter_estimation3(opt, ck, PGxy, filename='', RL=False, Debug=False,
                          run_parameter='', jieshu=[1, 2, 3, 4, 5, 6]):
    """3D 多阶参数估计的顶层循环。

    对每个方向的每个阶次，依次估计 PGz 和 cfai。
    支持 MP（7 阶）和 3D-SIM（5 阶）模式。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    ck : np.ndarray or torch.Tensor
        分离后的 4D 频域分量 (21, nz, nx, ny) 或 (15, nz, nx, ny)。
    PGxy : np.ndarray
        已估计的 XY 波矢 (3, Norders, 2)。
    filename : str
        文件名前缀。
    RL : bool
        是否使用 RL 反卷积（必须为 False）。
    Debug : bool
        调试标志。
    run_parameter : dict
        运行参数。
    jieshu : list
        需要处理的阶次列表。

    Returns
    -------
    cfai, PGxy, PGz, plong, pgz : np.ndarray, np.ndarray, np.ndarray, float, float
    """
    assert len(ck.shape) == 4
    if run_parameter['pg'] != 0:
        pg = run_parameter['pg']
        opt.pg = run_parameter['pg']
        opt.fanwei = run_parameter['fanwei']
    else:
        pg = int(opt.pxy)
        opt.pg = int(opt.pxy)
        opt.fanwei = run_parameter['fanwei']

    opt.cutoff = 1e-4
    opt.pgz = round(opt.pz + opt.Zpadding + 2)
    opt.fanweiz = 0

    if (opt.flag_N == 'MP' and opt.Norders == 7 and opt.nz != 1
            and (opt.fanweiz < 0 or opt.pgz >= opt.nz_re)):
        print('pgz=', opt.pgz)
        print("fanweiz=", opt.fanweiz)
        raise ValueError('fanweiz 错误')
    elif opt.flag_N == 'MP' and opt.Norders == 7 and opt.nz == 1:
        opt.pgz = 0
        opt.fanweiz = 0

    PGz = np.zeros((opt.Nangles, opt.Norders))
    cfai = np.zeros((opt.Nangles, opt.Norders, 3))
    pgz = 0
    z_expand_pe = 2 if (opt.flag_N == 'MP' and opt.Norders == 7) else 1
    nz = opt.nz_re

    try:
        ck = ck.numpy()
    except AttributeError:
        pass

    _init_pe_lists(opt)
    starttime = datetime.datetime.now()
    for i in range(3):
        RL_output = _prep_rl_output(ck[i * opt.Norders:(i + 1) * opt.Norders],
                                    opt.Norders, RL=RL, opt=opt)
        assert len(RL_output.shape) == 4
        cfai[i, 0, 0] = 1

        for j in jieshu:
            pgx = PGxy[i, j, 0]
            pgy = PGxy[i, j, 1]
            if j <= 1:  # ±2 级
                c, fai, c_EMD = cal_c_fai(opt, i, j, RL_output[0],
                                          RL_output[j], pgx / (2 * opt.nx),
                                          pgy / (2 * opt.ny),
                                          run_parameter=run_parameter)
                cfai[i, j, :] = np.array([c, fai, c_EMD])
            elif j == 2:
                cfai[i, j, 0] = cfai[i, 1, 0]
                cfai[i, j, 2] = cfai[i, 1, 2]
                cfai[i, j, 1] = -cfai[i, 1, 1]
            elif 3 <= j <= 4 and opt.flag_N == 'MP' and opt.Norders == 7:
                if run_parameter['pzzz'] == 0:
                    opt.pg = pg // 2
                    pzint, pxint, pyint = get_intpz(opt, RL_output[0],
                                                    RL_output[j], i, j,
                                                    methods='FAN')
                    pgz = get_subpz(opt, i, j, RL_output[0], RL_output[j],
                                    pgx, pgy, pzint, m=j, search_range=7,
                                    func=LiheXYZ)
                    pgz = get_subpz(opt, i, j, RL_output[0], RL_output[j],
                                    pgx, pgy, pgz, m=j, precision=0.01,
                                    search_range=6, func=LiheXYZ)
                elif run_parameter['pzzz'] != 0 and run_parameter['pzzz_range'] != 0:
                    opt.pg = pg // 2
                    pzint, pxint, pyint = get_intpz(opt, RL_output[0],
                                                    RL_output[j], i, j,
                                                    methods='FAN')
                    if j in (3, 5):
                        pgz = -run_parameter['pzzz']
                    elif j in (4, 6):
                        pgz = run_parameter['pzzz']
                    pgz = get_subpz(opt, i, j, RL_output[0], RL_output[j],
                                    pgx, pgy, pzint, m=j, search_range=7,
                                    func=LiheXYZ)
                    pgz = get_subpz(opt, i, j, RL_output[0], RL_output[j],
                                    pgx, pgy, pgz, m=j, precision=0.01,
                                    search_range=6, func=LiheXYZ)
                elif run_parameter['pzzz'] != 0 and run_parameter['pzzz_range'] == 0:
                    if j in (3, 5):
                        pgz = -run_parameter['pzzz']
                    elif j in (4, 6):
                        pgz = run_parameter['pzzz']
                else:
                    raise ValueError('参数错误')

                c, fai, c_EMD = cal_c_fai(opt, i, j, RL_output[0],
                                          RL_output[j], pgx / (2 * opt.nx),
                                          pgy / (2 * opt.ny), pgz / nz,
                                          run_parameter=run_parameter)
                cfai[i, j, :] = np.array([c, fai, c_EMD])
                PGz[i, j] = pgz
            elif j >= 5 and opt.Norders == 7:
                if j == 5:
                    cfai[i, j, 0] = cfai[i, 4, 0]
                    cfai[i, j, 2] = cfai[i, 4, 2]
                    cfai[i, j, 1] = -cfai[i, 4, 1]
                    PGz[i, j] = PGz[i, 3]
                elif j == 6:
                    cfai[i, j, 0] = cfai[i, 3, 0]
                    cfai[i, j, 2] = cfai[i, 3, 2]
                    cfai[i, j, 1] = -cfai[i, 3, 1]
                    PGz[i, j] = PGz[i, 4]
                else:
                    raise ValueError('j 错误')
            elif j == 3 and opt.flag_N == 'MP' and opt.Norders == 5:
                c, fai, c_EMD = cal_c_fai(opt, i, j, RL_output[0],
                                          RL_output[j], pgx / (2 * opt.nx),
                                          pgy / (2 * opt.ny),
                                          run_parameter=run_parameter)
                cfai[i, j, :] = np.array([c, fai, c_EMD])
                PGz[i, j] = pgz
            elif j == 4 and opt.flag_N == 'MP' and opt.Norders == 5:
                cfai[i, j, 0] = cfai[i, 3, 0]
                cfai[i, j, 2] = cfai[i, 3, 2]
                cfai[i, j, 1] = -cfai[i, 3, 1]

    # 修复 NaN C 值：负 z 位移方向的调制深度估计可能失败，
    # 此时用同一波瓣对的正 z 方向 C 值替代（C 应一致）
    for i in range(3):
        if np.isnan(cfai[i, 3, 0]):
            cfai[i, 3, 0] = cfai[i, 4, 0]
        if np.isnan(cfai[i, 6, 0]):
            cfai[i, 6, 0] = cfai[i, 5, 0]

    endtime = datetime.datetime.now()
    plong = _plong_from_pgxy(opt, PGxy)

    del opt.overlap_mask3d, opt.abscm3d, opt.angcm3d
    return cfai, PGxy, PGz, plong, pgz


#=== '仅估计 ±2 级的 PGxy' ===#
def parameter_estimationP2(opt, ck, filename='', RL=False, Debug=False,
                           run_parameter=''):
    """仅估计 ±2 级分量的 PGxy（ck 形状为 (3, 5, ...)）。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    ck : np.ndarray or torch.Tensor
        5 带分离结果 (15, nz, nx, ny)。
    filename : str
        文件名前缀。
    RL : bool
        是否使用 RL（必须为 False）。
    Debug : bool
        调试标志。
    run_parameter : dict
        运行参数。

    Returns
    -------
    PGxy : np.ndarray
        估计的 XY 波矢 (3, 5, 2)。
    """
    assert len(ck.shape) == 4
    Norders = 5
    PGxy = np.zeros((opt.Nangles, Norders, 2))
    if run_parameter['pg'] != 0:
        pg = run_parameter['pg']
        opt.pg = run_parameter['pg']
        opt.fanwei = run_parameter['fanwei']
    else:
        pg = int(opt.pxy)
        opt.pg = int(opt.pxy)
        opt.fanwei = run_parameter['fanwei']

    try:
        ck = ck.numpy()
    except AttributeError:
        pass

    _init_pe_lists(opt)
    starttime = datetime.datetime.now()
    for i in range(3):
        RL_output = _prep_rl_output(ck[i * Norders:(i + 1) * Norders],
                                    Norders, RL=RL, opt=opt)
        assert len(RL_output.shape) == 4

        for j in [1, 2]:
            if j == 1:
                opt.pg = pg
                pxint, pyint = get_intpxy(opt, RL_output[0], RL_output[j],
                                          i, j, methods='FAN')
                print(f'±2 整数估计: {pxint, pyint},'
                      f'长度: {np.sqrt(pxint ** 2 + pyint ** 2)}')
                pgx, pgy = get_subpxy(opt, i, j, RL_output[0], RL_output[j],
                                      pxint, pyint, func=LiheXYZ)
                print(f'±2 亚像素估计 {pgx, pgy},'
                      f'长度: {np.sqrt(pgx ** 2 + pgy ** 2)}')
                PGxy[i, j, :] = np.array([pgx, pgy])
            elif j == 2:
                PGxy[i, j, :] = -PGxy[i, 1, :]

    lihe2d = np.array(opt.lihe2d)
    kzz, kxx, kyy = lihe2d.shape
    lihe2d[:, kxx // 2, kyy // 2] = 0.1
    lihe2d = np.insert(lihe2d, 0, values=np.max(lihe2d, axis=0), axis=0)
    lihe2d = np.insert(lihe2d, 0, values=np.min(lihe2d, axis=0), axis=0)
    return PGxy


#=== '估计 ±2 级的 cfai' ===#
def parameter_estimation_02(opt, ck, PGxy, Norders, filename='', RL=False,
                            Debug=False, run_parameter=''):
    """基于已知 PGxy 估计 ±2 级分量的 cfai（形状 (3, 3, 3)）。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    ck : np.ndarray or torch.Tensor
        分离后的数据。
    PGxy : np.ndarray
        已估计的 XY 波矢 (3, Norders, 2)。
    Norders : int
        阶次数。
    filename : str
        文件名前缀。
    RL : bool
        是否使用 RL（必须为 False）。
    Debug : bool
        调试标志。
    run_parameter : dict
        运行参数。

    Returns
    -------
    cfai : np.ndarray
        估计的 cfai (3, 3, 3)。
    """
    assert len(ck.shape) == 4
    cfai = np.zeros((opt.Nangles, 3, 3))
    try:
        ck = ck.numpy()
    except AttributeError:
        pass

    _init_pe_lists(opt)
    starttime = datetime.datetime.now()
    for i in range(3):
        RL_output = _prep_rl_output(ck[i * Norders:(i + 1) * Norders],
                                    Norders, RL=RL, opt=opt)
        assert len(RL_output.shape) == 4
        cfai[i, 0, 0] = 1

        for j in range(1, Norders):
            pgx = PGxy[i, j, 0]
            pgy = PGxy[i, j, 1]
            if j <= 1:  # ±2 级
                c, fai, c_EMD = cal_c_fai(opt, i, j, RL_output[0],
                                          RL_output[j], pgx / (2 * opt.nx),
                                          pgy / (2 * opt.ny), filename=filename,
                                          run_parameter=run_parameter)
                cfai[i, j, :] = np.array([c, fai, c_EMD])
            elif j == 2:
                cfai[i, j, 0] = cfai[i, 1, 0]
                cfai[i, j, 2] = cfai[i, 1, 2]
                cfai[i, j, 1] = -cfai[i, 1, 1]
    return cfai
