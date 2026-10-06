"""窗函数、切趾函数与陷波衰减滤波器

提供 3D-MP-SIM 重建所需的边缘平滑窗、Blackman-Harris 式切趾函数、
以及用于抑制伪影的高斯陷波衰减滤波器。
"""
import math

import numpy as np
import torch

import Utils as _U


#=== '2D 边缘锥化窗函数 (基于 opt 参数)' ===#
def mask2(opt, xy_expand=1, sigma=0.25, padsize=0):
    """生成基于 Sigmoid 的 2D 边缘锥化窗，尺寸由 ``opt`` 决定。

    使用 Sigmoid 函数在 x/y 两方向产生平滑的边缘衰减，避免傅里叶变换中的振铃效应。

    Parameters
    ----------
    opt : Namespace
        光学参数对象，需包含 ``nx``, ``ny`` 属性。
    xy_expand : int
        XY 方向的扩展倍数。
    sigma : float
        Sigmoid 函数的陡峭度，值越小边缘越平滑。
    padsize : int
        预留参数，当前未使用。

    Returns
    -------
    mask2d : np.ndarray
        形状为 (ny * xy_expand, nx * xy_expand) 的 2D 窗函数。
    """
    ny = opt.nx * xy_expand
    nx = opt.ny * xy_expand
    x = torch.arange(1, nx + 1).reshape(1, -1)
    y = torch.arange(1, ny + 1).reshape(-1, 1)
    mask2d = ((torch.sigmoid(sigma * x) - torch.sigmoid(sigma * (x - ny - 1)))
              .repeat(nx, 1)
              * (torch.sigmoid(sigma * y) - torch.sigmoid(sigma * (y - nx - 1)))
              .repeat(1, ny))
    return mask2d.numpy()


#=== '2D 边缘锥化窗函数 (显式尺寸)' ===#
def mask2_self(nx, ny, xy_expand=1, sigma=0.25, padsize=0):
    """生成基于 Sigmoid 的 2D 边缘锥化窗，显式指定 ``(nx, ny)``。

    与 :func:`mask2` 功能相同，但不依赖 ``opt`` 对象，直接接收尺寸参数。

    Parameters
    ----------
    nx : int
        X 方向像素数。
    ny : int
        Y 方向像素数。
    xy_expand : int
        XY 方向的扩展倍数。
    sigma : float
        Sigmoid 陡峭度。
    padsize : int
        预留参数。

    Returns
    -------
    mask2d : np.ndarray
        2D 窗函数数组。
    """
    x = torch.arange(1, nx + 1).reshape(-1, 1)
    y = torch.arange(1, ny + 1).reshape(1, -1)
    mask2d = ((torch.sigmoid(sigma * x) - torch.sigmoid(sigma * (x - nx - 1)))
              * (torch.sigmoid(sigma * y) - torch.sigmoid(sigma * (y - ny - 1))))
    return mask2d.numpy()


#=== '3D Blackman-Harris 频率空间切趾函数' ===#
def bhs_3D_Z(opt, plong, fc, xy_expand=2, z_expand=1, Debug=0, Zjust=300):
    """生成 3D Blackman-Harris 风格的频率空间切趾函数。

    该切趾函数用于抑制重建频谱中的高频噪声，基于 cos(π·ρ) 形式，
    其中 ρ 为归一化频率半径。超出 OTF 截止频率的区域置零。

    Parameters
    ----------
    opt : Namespace
        包含 ``nx``, ``ny``, ``nz``, ``na``, ``dz``, ``Wjs`` 等参数。
    plong : float
        照明波矢的均值（像素单位）。
    fc : float
        OTF 的横向截止频率。
    xy_expand : int
        XY 方向扩展倍数，默认 2。
    z_expand : int
        Z 方向扩展倍数，默认 1。
    Debug : int
        若为 1 则保存中间结果 tif。
    Zjust : int
        Z 方向调整参数。

    Returns
    -------
    apodiz : np.ndarray
        3D 切趾函数数组，非零区域为 cos² 锥形分布。
    """
    nx = opt.nx * xy_expand
    ny = opt.ny * xy_expand
    nz = (opt.nz + 2 * opt.Zpadding) * z_expand
    NA = opt.na
    pixelsizeZ = opt.dz / (2 * Zjust)
    wavelength = opt.Wjs / 1000

    zv, xv, yv = _U.meshgrid(opt, xy_expand=xy_expand, z_expand=z_expand)

    # 频率轴步长
    dpz = 1 / (nz * pixelsizeZ)
    # 横向与轴向截止频率（像素单位）
    k_xymax = plong + fc
    k_zmax = 2 * (NA ** 2 / (2 * wavelength)) / dpz
    k_xy = np.sqrt(xv ** 2 + yv ** 2)
    k_z = np.sqrt(zv ** 2)

    # 归一化频率坐标 ρ = sqrt(ρx² + ρy² + ρz²)
    rhox = np.abs(xv) / (2 * k_xymax)
    rhoy = np.abs(yv) / (2 * k_xymax)
    rhoz = np.abs(zv) / (2 * k_zmax)
    rho = np.sqrt(rhox ** 2 + rhoy ** 2 + rhoz ** 2)

    # cos 锥形切趾
    apodiz = np.cos(np.pi * rho)
    # 超出截止频率的区域置零
    msk = (k_xy > k_xymax) | (k_z > k_zmax)
    apodiz[msk] = 0
    apodiz[apodiz < 0] = 0
    apodiz = apodiz ** 2

    if Debug == 1:
        _U.save_tif('apodiz1.tif', apodiz)
    return apodiz


#=== '衰减滤波器的共享频率网格' ===#
def _freq_grid(opt):
    """构建陷波衰减滤波器共用的频率坐标网格。

    Parameters
    ----------
    opt : Namespace
        需包含 ``nz_re``, ``nx``, ``ny`` 属性。

    Returns
    -------
    zv, xv, yv : np.ndarray
        稀疏网格坐标（indexing='ij'）。
    """
    nz, nx, ny = opt.nz_re, opt.nx * 2, opt.ny * 2
    x = np.arange(np.ceil(-nx / 2), np.ceil(nx / 2))
    y = np.arange(np.ceil(-ny / 2), np.ceil(ny / 2))
    z = np.arange(np.ceil(-nz / 2), np.ceil(nz / 2))
    zv, xv, yv = np.meshgrid(z, x, y, indexing='ij', sparse=True)
    return zv, xv, yv


#=== '二维高斯陷波衰减 (仅横向)' ===#
def valAttenuation(opt, px=0, py=0, pz=0, Astr=1, fwhm=1):
    """生成横向平面的高斯陷波衰减滤波器。

    用于在重组频谱时衰减特定频率分量（如零级或±1级旁瓣）。

    Parameters
    ----------
    opt : Namespace
        光学参数对象。
    px, py, pz : float
        陷波中心位置（像素单位）。
    Astr : float
        衰减强度，取值范围 [0, 1]。1 表示完全衰减该频率。
    fwhm : float
        高斯陷波的半高全宽（像素单位）。

    Returns
    -------
    va : np.ndarray
        衰减系数数组，1 表示无衰减，0 表示完全抑制。
    """
    zv, xv, yv = _freq_grid(opt)
    # 计算到陷波中心的径向距离（微米单位）
    rad1 = np.sqrt((xv - px) ** 2 + (yv - py) ** 2) * opt.cyclesPerMicron
    # 高斯衰减：va = 1 - Astr * exp(-r² / (0.5*FWHM)²)
    va = 1 - Astr * np.exp(-np.power(rad1, 2) / np.power(0.5 * fwhm, 2))
    # 注：原代码中 opt.flag_N 为字符串（"MP"/"3D"/"2D"），恒等分支，保留不动
    return 1 - (1 - va)


#=== '四阶横向高斯陷波衰减 (含轴向项)' ===#
def getotfAtt(opt, px=0, py=0, pz=0, Astr=1, fwhm=1):
    """生成带轴向项的 4 阶横向高斯陷波衰减。

    相比于 :func:`valAttenuation`，使用 4 阶指数使陷波更陡峭，
    并额外乘以轴向权重项。

    Parameters
    ----------
    opt : Namespace
        光学参数对象。
    px, py, pz : float
        陷波中心位置。
    Astr : float
        衰减强度 [0, 1]。
    fwhm : float
        半高全宽。

    Returns
    -------
    attenuation : np.ndarray
        3D 衰减系数数组。
    """
    zv, xv, yv = _freq_grid(opt)
    rad1 = np.sqrt((xv - px) ** 2 + (yv - py) ** 2) * opt.cyclesPerMicron
    # 轴向距离（归一化到最大值）
    rad2 = np.sqrt((zv - pz) ** 2) * opt.cyclesPerMicron
    rad2 = rad2 / np.max(rad2)
    # 4 阶高斯衰减（比 2 阶更陡峭的陷波）
    va = 1 - Astr * np.exp(-np.power(rad1, 4) / (2 * np.power(fwhm, 4)))
    _ = build_gaussian_z(opt, z=opt.nz_re, x=opt.nx * 2, y=opt.ny * 2)
    return 1 - (1 - va) * (1 - rad2)


#=== 'Z 方向 3D 高斯权重 (遗留辅助函数)' ===#
def build_gaussian_z(opt, z, x, y, pz=0, mean=0, std=1, lenz=2):
    """沿 Z 轴构建 3D 高斯权重函数（遗留辅助）。

    Parameters
    ----------
    opt : Namespace
        参数对象（当前未直接使用）。
    z, x, y : int
        三个维度的尺寸。
    pz : float
        Z 方向偏移。
    mean : float
        高斯均值。
    std : float
        高斯标准差。
    lenz : float
        Z 方向的半跨度。

    Returns
    -------
    zg : np.ndarray
        Z 向高斯权重数组（已归一化）。
    """
    nz, nx, ny = z, x, y
    half = lenz
    xs = np.linspace(-half, half, nx)
    ys = np.linspace(-half, half, ny)
    zs = np.linspace(-half + pz, half + pz, nz)
    _, zg, _ = np.meshgrid(xs, zs, ys)
    zg = np.exp(-((zg - mean) ** 2) / (2 * std ** 2))
    zg = zg / (math.pow(2 * np.pi * std, 2))
    zg = zg / np.max(zg)
    return zg
