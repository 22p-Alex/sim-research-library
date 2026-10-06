"""原始数据加载、OTF 处理与 OTF 支撑域掩膜生成

负责从 tif 文件加载原始 SIM 数据、进行 Z 方向填充/窗函数处理、
加载系统 OTF 并生成用于频带分离和 Wiener 重建的支撑域掩膜。
"""
import numpy as np
import torch
from pathlib import Path
from tifffile import imread

import Utils as _U
import WindowF as _WF


# ===========================================================================
# 光学 / 离散化参数推导
# ===========================================================================

#=== '从原始数据推导光学和离散化参数' ===#
def GetParams(opt, Dr_read, Debug=False):
    """根据加载的原始数据推导并设置 ``opt`` 上的光学和离散化参数。

    计算内容包括：数据类型与设备、OTF 截止频率、照明波矢、
    Z 填充后的网格尺寸等。

    Parameters
    ----------
    opt : Namespace
        待填充的参数对象。
    Dr_read : np.ndarray
        原始数据，用于检查 GPU 和推断尺寸。
    Debug : bool
        是否打印中间参数。

    Returns
    -------
    opt : Namespace
        更新后的参数对象。
    """
    # 数据类型设置
    opt.dtype_real = np.float32
    opt.dtype_com = np.complex64
    opt.tdtype_real = torch.float32
    opt.tdtype_com = torch.complex64

    # 设备选择（优先级：CUDA > CPU，MPS 复数兼容性太差不使用）
    opt.gpu_ids = 1
    if opt.gpu_ids and torch.cuda.is_available():
        opt.device = torch.device("cuda:0")
    else:
        opt.device = torch.device("cpu")

    # 扩展倍数
    opt.xy_expand = 2
    if opt.flag_N == "2D":
        opt.z_expand = 1
        opt.Zpadding = 0
        opt.nz_re = 1
    elif opt.flag_N == "3D":
        opt.z_expand = 1
        opt.nz_re = opt.z_expand * (opt.nz + 2 * opt.Zpadding)
    elif opt.flag_N == "MP":
        opt.z_expand = 2
        opt.nz_re = opt.z_expand * (opt.nz + 2 * opt.Zpadding)

    # 微米换算系数
    opt.eps = np.finfo(float).eps
    opt.cyclesPerMicron = 1 / ((opt.nx * opt.dx) * 1e-3)

    # OTF 截止频率（像素单位）
    opt.fcXYnm = 2 * opt.NAjs / opt.Wjs
    opt.fcZnm = opt.NAjs ** 2 / (2 * opt.Wjs)
    opt.fc = opt.dx * opt.nx * opt.fcXYnm
    opt.fc_z = opt.dz * (opt.nz + 2 * opt.Zpadding) * opt.fcZnm

    # 照明波矢（像素单位）
    opt.kxynm = 2 * opt.NAzm / opt.Wzm
    opt.kznm = opt.n * (1 - np.cos(opt.theta)) / opt.Wzm
    opt.pxy = opt.dx * opt.nx * opt.kxynm
    opt.pz = opt.dz * (opt.nz + 2 * opt.Zpadding) * opt.kznm

    # 有效扩展边缘
    opt.EEdge = opt.fc + opt.pxy

    if Debug:
        print('GetParams: opt.fc={},\n opt.fc_z={},\n opt.pxy={},\n '
              'opt.pz={}'.format(np.round(opt.fc, 2), np.round(opt.fc_z, 2),
                                 np.round(opt.pxy, 2), np.round(opt.pz, 2)))
    return opt


# ===========================================================================
# 原始数据加载 / 预处理
# ===========================================================================

#=== '加载原始 tif 并填充为正方形' ===#
def load_RAW_DATA(path_filename, Debug=False):
    """加载原始 tif 文件，若 XY 不等则零填充为正方形。

    Parameters
    ----------
    path_filename : str or Path
        tif 文件的路径。
    Debug : bool
        是否打印中间信息。

    Returns
    -------
    Dr_read_F : np.ndarray
        填充后的 3D 数据 (nz, nx, ny)，XY 为正方形。
    nx, ny : int
        原始的 X/Y 尺寸。
    """
    Dr_read = imread(path_filename)
    Dr_read = _U.image_reshape(Dr_read, dim=3)
    nz, nx, ny = Dr_read.shape
    if nx != ny:
        max_side = max(nx, ny)
        print(f'load_RAW_DATA: 0-填充 shape->{(nz, nx, ny)}->'
              f'{(nz, max_side, max_side)}')
        Dr_read_F = _U.pad_or_cut(Dr_read, x=max_side, y=max_side, z=nz)
    else:
        Dr_read_F = Dr_read
    assert len(Dr_read_F.shape) == 3
    return Dr_read_F, nx, ny


#=== '重排数据为 (相位, 方向, nz) 布局' ===#
def Transfer2NPD(opt, Dr_read):
    """将原始数据从 (nz, 相位*方向, nx, ny) 转为 (相位*方向, nz, nx, ny)。

    Parameters
    ----------
    opt : Namespace
        含 ``Nangles``, ``Nshifts``, ``nz``, ``nx``, ``ny``。
    Dr_read : np.ndarray
        3D 原始数据 (nz, Nangles*Nshifts, nx, ny)。

    Returns
    -------
    np.ndarray
        重排后的 4D 数据 (Nangles*Nshifts, nz, nx, ny)。
    """
    num_channels = opt.Nangles * opt.Nshifts
    nz, nx, ny = opt.nz, opt.nx, opt.ny
    assert len(Dr_read.shape) == 3
    Dr_PAZ = Dr_read.reshape(nz, num_channels, nx, ny)
    return np.swapaxes(Dr_PAZ, 0, 1)


#=== 'Z 方向边缘延拓填充' ===#
def Image_zpadding(opt, Dr_zpd, edge_coeff=0):
    """沿 Z 方向进行零填充，首尾用边缘值延拓。

    在 Z 方向两端各填充 ``Zp`` 层，填充值 = 边缘值 × ``edge_coeff``。

    Parameters
    ----------
    opt : Namespace
        含 ``Nangles``, ``Nshifts``, ``nz``, ``nx``, ``ny``, ``Zpadding``。
    Dr_zpd : np.ndarray
        待填充的 4D 数据 (Nangles*Nshifts, nz_original, nx, ny)。
    edge_coeff : float
        边缘延拓系数，0 表示纯零填充。

    Returns
    -------
    np.ndarray
        Z 填充后的数据 (Nangles*Nshifts, nz+2*Zpadding, nx, ny)。
    """
    num_channels = opt.Nangles * opt.Nshifts
    nz = opt.nz + 2 * opt.Zpadding
    nx, ny = opt.nx, opt.ny
    Zp = opt.Zpadding

    Dr_zpadding = np.zeros((num_channels, nz, nx, ny), dtype=opt.dtype_real)
    print(f'Dr_zpadding={Dr_zpadding.shape},Dr_zpd={Dr_zpd.shape}')
    Dr_zpadding[:, 0:Zp] = edge_coeff * Dr_zpd[:, 0:1]
    Dr_zpadding[:, Zp:nz - Zp] = Dr_zpd
    Dr_zpadding[:, nz - Zp:] = edge_coeff * Dr_zpd[:, -1:]
    return Dr_zpadding


#=== '对待填充数据施加边缘锥化窗' ===#
def windows(opt, data, nx_raw, ny_raw):
    """对加载的原始数据施加边缘锥化窗函数。

    使用 9 次方窗以增强边缘衰减，抑制傅里叶变换的振铃效应。

    Parameters
    ----------
    opt : Namespace
        参数对象（当前未直接使用）。
    data : np.ndarray
        4D 数据 (channels, z, x, y)。
    nx_raw, ny_raw : int
        原始 XY 尺寸，用于生成匹配的窗函数。

    Returns
    -------
    np.ndarray
        加窗后的数据。
    """
    mask = _WF.mask2_self(nx_raw, ny_raw, sigma=0.25)
    _, _, nx, ny = data.shape
    if nx != nx_raw or ny != ny_raw:
        mask = _U.pad_or_cut(mask, x=nx, y=ny)
    print(data.shape, mask.shape)
    return data * (mask ** 9)


#=== '完整的原始数据加载流水线' ===#
def loadANDprocess_Dr(opt, p_i, run_parameter):
    """加载、正方形填充、重排、加窗并裁剪一个原始数据栈。

    这是原始数据预处理的主入口函数。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    p_i : Path
        原始 tif 文件的路径。
    run_parameter : dict
        运行参数字典，含 ``movex``, ``movex_long``, ``movey``。

    Returns
    -------
    Dr4D_ZPA_crop_p : np.ndarray
        处理完毕的 4D 数据 (channels, nz, nx, ny)。
    opt : Namespace
        更新后的参数对象。
    """
    Dr3D_square, nx_raw, ny_raw = load_RAW_DATA(p_i)
    opt = GetParams(opt, Dr3D_square)
    Dr4D_ZPA = Transfer2NPD(opt, Dr3D_square)
    Dr4D_ZPA = windows(opt, Dr4D_ZPA, nx_raw, ny_raw)

    # 裁剪 ROI 区域
    x_start = run_parameter['movex']
    x_length = run_parameter['movex_long']
    y_start = run_parameter['movey']
    y_length = run_parameter['movex_long']
    Dr4D_ZPA_crop = Dr4D_ZPA[:, :, x_start:x_start + x_length,
                             y_start:y_start + y_length]
    Dr4D_ZPA_crop_p = _U.pad_or_cut(Dr4D_ZPA_crop, opt.nx, opt.ny, opt.nz)
    Dr4D_ZPA_crop_p = Dr4D_ZPA_crop_p.astype(opt.dtype_real)
    assert len(Dr4D_ZPA_crop_p.shape) == 4
    return Dr4D_ZPA_crop_p, opt


# ===========================================================================
# OTF 加载
# ===========================================================================

#=== '加载并归一化系统 OTF' ===#
def load_OTF(opt, path_filename, Debug=False):
    """加载 OTF tif 文件，归一化并提取 2D 中心切片与 PSF。

    Parameters
    ----------
    opt : Namespace
        参数对象，OTF 的 XY 尺寸需与 ``opt.nx``, ``opt.ny`` 匹配。
    path_filename : str or Path
        OTF tif 文件路径。
    Debug : bool
        是否输出调试信息。

    Returns
    -------
    OTF_n_3D : np.ndarray
        归一化的 3D OTF。
    OTF_n_2D : np.ndarray
        OTF 的中心 2D 切片。
    PSF : np.ndarray
        由 OTF 逆傅里叶变换得到的 PSF（负值已截断为 0）。
    """
    OTFload = imread(path_filename)
    nz, nx, ny = OTFload.shape
    assert nx == opt.nx and ny == opt.ny
    PSF = np.fft.fftshift(_U.ifftn(OTFload))
    PSF[PSF < 0] = 0
    OTF = OTFload

    OTF_n = _U.normalize(OTF)
    OTF_n_3D = _U.image_reshape(OTF_n, dim=3)
    nz, nx, ny = OTF_n_3D.shape
    OTF_n_2D = OTF_n_3D[nz // 2]
    return OTF_n_3D, OTF_n_2D, PSF


# ===========================================================================
# OTF 支撑域掩膜（统一核心，替代原 formula/2/3 三个变体）
# ===========================================================================

#=== '解析 NA 掩膜参数' ===#
def _resolve_NA(opt):
    """从 ``opt`` 中解析用于 OTF 掩膜计算的 NA 相关参数。

    优先使用 ``opt.na_mask`` / ``opt.n_mask``，若不存在则回退到
    ``opt.na`` / ``opt.n`` / ``opt.namin``。

    Returns
    -------
    NA, refmed, NAmin : float
        数值孔径、参考折射率、最小 NA。
    """
    try:
        NA = opt.na_mask
        refmed = opt.n_mask
        NAmin = min(NA, refmed)
    except AttributeError:
        NA = opt.na
        refmed = opt.n
        NAmin = opt.namin
    return NA, refmed, NAmin


#=== 'OTF 支撑域计算核心（torch 实现）' ===#
def _otf_mask_core(opt, nx, ny, nz, PGxy, PGz, qx_mode, qz_mode,
                   pixel_scale=1.0, pixel_scale_z=1.0, Debug=0):
    """OTF 支撑域掩膜的统一计算核心。

    通过轴向截止频率公式判定每个频点是否在 OTF 支撑域内。
    支持不同的频率轴范围模式（完整/半轴/双倍轴）。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    nx, ny, nz : int
        三个维度的点数。
    PGxy : list
        XY 方向的频移 [pgx, pgy]。
    PGz : list
        Z 方向的频移 [pgz]。
    qx_mode : str
        ``'full'`` 表示 X 范围为 [-nx, nx)，``'half'`` 为 [-nx/2, nx/2)。
    qz_mode : str
        ``'full'`` 表示 Z 范围为 [-nz/2, nz/2)，``'double'`` 为 [-nz, nz)。
    pixel_scale : float
        XY 方向像素缩放因子（formula3 使用 0.5）。
    pixel_scale_z : float
        Z 方向像素缩放因子。
    Debug : int
        是否保存中间结果。

    Returns
    -------
    otf_mask : np.ndarray
        3D OTF 支撑域二值掩膜（布尔/uint8）。
    """
    _NA, refmed, NAmin = _resolve_NA(opt)
    lamdem = opt.Wjs
    dx = opt.dx

    if opt.nz == 1:
        nz = 2

    # 频率轴步长
    Dqx = 1.0 / ((nx) * (dx * pixel_scale))
    Dqy = 1.0 / ((ny) * (dx * pixel_scale))
    Dqz = 1.0 / (nz * opt.dz * pixel_scale_z)

    # 根据模式构建频率坐标
    if qx_mode == 'full':
        QX = torch.arange(np.ceil(-nx), np.ceil(nx)) * Dqx
        QY = torch.arange(np.ceil(-ny), np.ceil(ny)) * Dqy
    else:  # 'half'
        QX = torch.arange(np.ceil(-nx / 2), np.ceil(nx / 2)) * Dqx
        QY = torch.arange(np.ceil(-ny / 2), np.ceil(ny / 2)) * Dqy

    if qz_mode == 'double':
        QZ = torch.arange(np.ceil(-nz), np.ceil(nz)) * Dqz
    else:  # 'full'
        QZ = torch.arange(np.ceil(-nz / 2), np.ceil(nz / 2)) * Dqz

    qz, qx, qy = torch.meshgrid(QZ, QX, QY, indexing='ij')

    # OTF 轴向截止频率计算
    q0 = refmed / lamdem
    NA1 = NAmin / lamdem
    NB1 = np.sqrt(q0 ** 2 - NA1 ** 2)

    qpar = torch.sqrt((qx - PGxy[0] * Dqx) ** 2 + (qy - PGxy[1] * Dqx) ** 2)
    axial_cutoff = torch.sqrt(q0 ** 2 - (qpar - NA1) ** 2) - NB1
    axial_cutoff = (qpar <= 2 * NA1) * axial_cutoff

    otf_mask = (axial_cutoff + Dqz / 2 >= torch.abs(qz - PGz[0] * Dqz))
    otf_mask = (qpar <= 2 * NA1) * otf_mask
    otf_mask = otf_mask.to(torch.uint8).numpy()

    # 对于单层 Z 的特殊处理：保留最大均值层
    if opt.nz == 1:
        nz_, nx_, ny_ = otf_mask.shape
        max_index = int(np.argmax([np.mean(otf_mask[i])
                                   for i in range(nz_)]))
        otf_mask = otf_mask[max_index]

    if Debug == 1:
        _U.save_tif('④otf_mask--mask0.tif', otf_mask.astype(bool))
    return _U.image_reshape(otf_mask, dim=3)


#=== 'OTF 支撑域掩膜（完整 XY / 完整 Z）' ===#
def otf_mask_formula(opt, nx, ny, nz, PGxy=[0, 0], PGz=[0], Debug=0,
                     xy_expand=1):
    """OTF 支撑域：QX/QY 为完整范围 (2*nx)，QZ 为完整范围 (nz)。"""
    return _otf_mask_core(opt, nx, ny, nz, PGxy, PGz,
                          qx_mode='full', qz_mode='full',
                          pixel_scale=1.0, pixel_scale_z=1.0, Debug=Debug)


#=== 'OTF 支撑域掩膜（完整 XY / 双倍 Z）' ===#
def otf_mask_formula2(opt, nx, ny, nz, PGxy=[0, 0], PGz=[0], Debug=0,
                      xy_expand=1):
    """OTF 支撑域：QX/QY 为完整范围 (2*nx)，QZ 为双倍范围 (2*nz)。"""
    return _otf_mask_core(opt, nx, ny, nz, PGxy, PGz,
                          qx_mode='full', qz_mode='double',
                          pixel_scale=1.0, pixel_scale_z=1.0, Debug=Debug)


#=== 'OTF 支撑域掩膜（半轴 XY / 完整 Z，支持像素缩放）' ===#
def otf_mask_formula3(opt, nx, ny, nz, PGxy=[0, 0], PGz=[0], pixel_scale=1,
                      pixel_scale_z=1, Debug=0):
    """OTF 支撑域：QX/QY 为半范围 (nx)，QZ 为完整范围 (nz)，支持缩放。"""
    return _otf_mask_core(opt, nx, ny, nz, PGxy, PGz,
                          qx_mode='half', qz_mode='full',
                          pixel_scale=pixel_scale, pixel_scale_z=pixel_scale_z,
                          Debug=Debug)


#=== '构建对称的 3D/2D OTF 支撑域掩膜' ===#
def otf_mask_3d_2d(opt, Debug, z_expand=2, PGxy=[0, 0], PGz=[0]):
    """构建在 Z 方向对称的 3D OTF 支撑域掩膜及其中心 2D 切片。

    将原始掩膜的上半部分镜像到下半部分，确保 Z 对称性。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    Debug : int
        调试标志。
    z_expand : int
        Z 方向扩展倍数，=1 使用 formula，=2 使用 formula2。
    PGxy, PGz : list
        频移量。

    Returns
    -------
    OTFmask3D : np.ndarray
        对称化并填充后的 3D 掩膜。
    OTFmask2D : np.ndarray
        中心层的 2D 掩膜。
    OTFmask3D_raw : np.ndarray
        未经对称化处理的原始掩膜。
    """
    # 根据轴向扩展倍数选择掩膜生成公式
    if z_expand == 1:
        OTFmask3D_raw = otf_mask_formula(opt, nx=opt.nx, ny=opt.ny,
                                         nz=opt.nz, PGxy=PGxy, PGz=PGz,
                                         Debug=Debug, xy_expand=1)
    else:
        OTFmask3D_raw = otf_mask_formula2(opt, nx=opt.nx, ny=opt.ny,
                                          nz=opt.nz, PGxy=PGxy, PGz=PGz,
                                          Debug=Debug, xy_expand=1)

    # 沿 Z 方向对称化：上半部分镜像到下半部分
    OTFmask3D = np.zeros_like(OTFmask3D_raw)
    nz, nx, ny = OTFmask3D_raw.shape
    nz_mid = nz // 2
    OTFmask3D[nz_mid:] = OTFmask3D_raw[nz_mid:]
    for ii in range(nz_mid):
        OTFmask3D[ii + 1] = OTFmask3D_raw[-(ii + 1)]

    # 扩展填充到重建网格尺寸
    OTFmask3D = _U.pad_or_cut(OTFmask3D, x=2 * opt.nx, y=2 * opt.ny,
                              z=opt.z_expand * opt.nz)

    # 若存在 Z 填充，插值调整掩膜尺寸
    if opt.Zpadding != 0:
        nx2 = opt.xy_expand * opt.nx
        ny2 = opt.xy_expand * opt.ny
        nz2 = opt.nz_re
        OTFmask3D = _U.Interpolate(OTFmask3D.astype(np.float32),
                                   nx2, ny2, nz2)
        OTFmask3D[OTFmask3D < 0.1] = 0
        OTFmask3D[OTFmask3D != 0] = 1
        OTFmask3D = OTFmask3D.astype(np.uint8)

    OTFmask2D = OTFmask3D[opt.nz_re // 2]
    return OTFmask3D, OTFmask2D, OTFmask3D_raw


#=== 'Z 方向对称镜像' ===#
def duicehng(data):
    """将 3D 掩膜的上半部分沿 Z 轴镜像到下半部分。

    Parameters
    ----------
    data : np.ndarray
        3D 输入数组。

    Returns
    -------
    np.ndarray
        对称化后的数组。
    """
    assert len(data.shape) == 3
    nz = data.shape[0]
    nz_mid = nz // 2
    data_out = np.zeros_like(data)
    for i in range(nz - nz_mid):
        data_out[nz_mid - i] = data[nz_mid + i]
        data_out[nz_mid + i] = data[nz_mid + i]
    return data_out


#=== '参数估计专用 OTF 支撑域掩膜' ===#
def otf_mask_PE(opt, Debug, PGxy=[0, 0], PGz=[0], flag=0):
    """生成参数估计阶段使用的 OTF 支撑域掩膜。

    支持两种网格模式：原始分辨率 (flag=0) 与扩展分辨率 (flag=1)。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    Debug : int
        调试标志。
    PGxy, PGz : list
        频移量。
    flag : int
        0 = 原始分辨率网格，1 = 两倍分辨率网格。

    Returns
    -------
    OTFmask3D_raw : np.ndarray
        3D 掩膜。
    OTFmask2D : np.ndarray
        中心 2D 切片。
    """
    if flag == 0:
        OTFmask3D_raw = otf_mask_formula3(opt, nx=opt.nx, ny=opt.ny,
                                          nz=opt.nz + 2 * opt.Zpadding,
                                          PGxy=PGxy, PGz=PGz,
                                          pixel_scale=1, pixel_scale_z=1,
                                          Debug=Debug)
    else:
        OTFmask3D_raw = otf_mask_formula3(opt, nx=2 * opt.nx, ny=2 * opt.ny,
                                          nz=opt.nz_re, PGxy=PGxy, PGz=PGz,
                                          pixel_scale=0.5, pixel_scale_z=0.5,
                                          Debug=Debug)
    if PGz[0] == 0:
        OTFmask3D_raw = duicehng(OTFmask3D_raw)
    nz = OTFmask3D_raw.shape[0]
    OTFmask2D = OTFmask3D_raw[nz // 2]
    return OTFmask3D_raw, OTFmask2D


#=== '从原始堆栈中选出指定帧' ===#
def drawDr(Dr, Nshift=8, number=[0, 1, 2, 3, 4]):
    """从原始数据的每个方向上选取指定的相位帧。

    Parameters
    ----------
    Dr : np.ndarray
        堆叠的原始数据 (总帧数, ...)。
    Nshift : int
        每个方向的相移步数。
    number : list
        需要选取的帧索引。

    Returns
    -------
    np.ndarray
        选取后的子集数据。
    """
    Drout = np.zeros_like(Dr[:3 * len(number)])
    for i in range(3):
        ii = i * Nshift + np.array(number)
        Drout[i * len(number):(i + 1) * len(number)] = np.copy(Dr[ii])
    return Drout


#=== '生成最终的重建用 OTF 支撑域掩膜' ===#
def generatemask(opt, isdebug):
    """构建用于最终 Wiener 重建的 3D/2D OTF 支撑域掩膜。

    通过合并两个不同 NA 的掩膜（1.21 和 1.3），并去除中心附近受
    轴向照明影响的小区域，得到更精确的支撑域。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    isdebug : dict
        调试标志字典，键 'loa' 控制是否保存中间结果。

    Returns
    -------
    OTFmask3D : np.ndarray
        合并后的 3D OTF 支撑域掩膜。
    OTFmask2D : np.ndarray
        对应的 2D 中心切片。
    """
    # 生成 NA=1.21 的掩膜
    opt.na_mask = 1.21
    OTFmask3D_121, OTFmask2D = otf_mask_PE(opt, Debug=isdebug['loa'])
    # 生成 NA=1.3 的掩膜
    opt.na_mask = 1.3
    OTFmask3D_13, _ = otf_mask_PE(opt, Debug=isdebug['loa'])

    # 计算差异区域并清除中心附近的伪影
    center_x = OTFmask3D_13.shape[1] // 2
    center_y = OTFmask3D_13.shape[2] // 2
    y, x = np.ogrid[:OTFmask3D_13.shape[1], :OTFmask3D_13.shape[2]]
    distance_from_center = np.sqrt((x - center_x) ** 2 + (y - center_y) ** 2)
    mask_diff = OTFmask3D_13 - OTFmask3D_121
    z_mid = mask_diff.shape[0] // 2
    mask_diff[int(z_mid - opt.pz / 1):int(z_mid + opt.pz / 1) + 2,
              distance_from_center < 30] = 0
    # 合并掩膜：NA1.21 + 差异区域
    OTFmask3D = OTFmask3D_121 + mask_diff
    OTFmask3D[z_mid + 1:] = np.flip(OTFmask3D[1:z_mid], axis=0)
    OTFmask3D[OTFmask3D > 1] = 1
    return OTFmask3D, OTFmask2D
