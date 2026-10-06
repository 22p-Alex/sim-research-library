"""Wiener 重建模块：频谱移动、OTF 移位与最终逆 FFT

负责将分离后的各阶频域分量移回正确位置、构建加权的 Wiener 滤波
分子/分母，并执行逆 FFT 得到最终的超分辨重建图像。
"""
import numpy as np
import torch

import Utils as _U
import WindowF as _WF

# torch FFT 简写（已含 shift 的版本）
tfftn = _U.tfftn
tifftn = _U.tifftn
tfftshift = torch.fft.fftshift
tifftshift = torch.fft.ifftshift


# ===========================================================================
# 每个（方向，级次）的频移相位矩阵
# ===========================================================================

#=== '生成每个 (方向, 级次) 的频移相位矩阵' ===#
def IrTEST(opt, PGxy, PGz, xy_expand=2, z_expand=2, Zchushu=0, pz_true=0):
    """为每个（方向, 级次）组合生成频谱移动所需的相位因子矩阵。

    Parameters
    ----------
    opt : Namespace
        含 ``nz``, ``nx``, ``ny``, ``Zpadding``, ``Nangles``, ``Norders``。
    PGxy : np.ndarray
        XY 波矢 (Nangles, Norders, 2)。
    PGz : np.ndarray
        Z 波矢 (Nangles, Norders)。
    xy_expand : int
        XY 扩展倍数。
    z_expand : int
        Z 扩展倍数。
    Zchushu : int
        Z 方向除数（遗留参数）。
    pz_true : int
        真实的 pz 值（遗留参数）。

    Returns
    -------
    Irtest : list of np.ndarray
        每个 (方向, 级次) 对应的相位矩阵列表。
    """
    nz = (opt.nz + 2 * opt.Zpadding) * z_expand
    nx = opt.nx * xy_expand
    ny = opt.ny * xy_expand
    ZV, XV, YV = _U.meshgrid(opt, xy_expand=xy_expand, z_expand=z_expand)
    Irtest = []
    for i in range(opt.Nangles):
        Pxy_abs = PGxy[i] / nx
        Pz_abs = PGz[i] / nz
        for j in range(opt.Norders):
            Pxy = Pxy_abs[j]
            Pz = Pz_abs[j]
            shift_phase = np.exp(2j * np.pi * (Pxy[0] * XV + Pxy[1] * YV
                                               + Pz * ZV),
                                 dtype=opt.dtype_com)
            Irtest.append(shift_phase)
    return Irtest


#=== '根据重建标志选择需要处理的级次列表' ===#
def choose_jiesu(opt, flagg):
    """根据重建标志返回需要处理的阶次列表。

    标志含义：
    - 0: 仅 0 级
    - 1: 仅 ±1 级
    - 2: 仅 ±2 级
    - 3: 0 级 + ±1 级
    - 4: 0 级 + ±2 级
    - 5: ±1 级 + ±2 级
    - 6: 全阶

    Parameters
    ----------
    opt : Namespace
        含 ``Norders``, ``flag_N`` 属性。
    flagg : int
        重建标志。

    Returns
    -------
    list of int
        需要处理的阶次编号列表。

    Raises
    ------
    ValueError
        若标志未知或阶次配置不匹配。
    """
    if flagg == 0:
        return [0]
    if flagg in (1, 3):
        if opt.Norders == 5:
            jiesu = [3, 4]
        elif opt.flag_N == 'MP' and opt.Norders == 7:
            jiesu = [3, 4, 5, 6]
        else:
            raise ValueError('阶次错误：无一阶分量')
        if flagg == 3:
            jiesu.insert(0, 0)
        return jiesu
    if flagg == 2:
        return [1, 2]
    if flagg == 4:
        return [0, 1, 2]
    if flagg in (5, 6):
        if opt.Norders == 5:
            jiesu = [1, 2, 3, 4]
        elif opt.flag_N == 'MP' and opt.Norders == 7:
            jiesu = [1, 2, 3, 4, 5, 6]
        elif opt.Norders == 3 and opt.flag_N == '2D':
            jiesu = [1, 2]
        if flagg == 6:
            jiesu.insert(0, 0)
        return jiesu
    raise ValueError(f'未知阶次标志: {flagg}')


#=== '移除每个分量的初始相位' ===#
def removefai(opt, ck, cfai):
    """从分离后的各分量中移除初始相位。

    Parameters
    ----------
    opt : Namespace
        含 ``Nangles`` 属性。
    ck : np.ndarray
        4D 频域分量 (Nangles*Norders, nz, nx, ny)。
    cfai : np.ndarray
        各阶的调制深度和相位 (Nangles, Norders, 3)。

    Returns
    -------
    sk : np.ndarray
        移除初始相位后的分量数组。
    """
    assert len(ck.shape) == 4
    nc, nz, nx, ny = ck.shape
    Norders = nc // opt.Nangles
    sk = np.empty_like(ck)
    for i in range(opt.Nangles):
        for j in range(Norders):
            if j == 0:
                assert cfai[i, j, 0] == 1 and cfai[i, j, 1] == 0
            sk[i * Norders + j] = ck[i * Norders + j] / np.exp(
                1j * cfai[i, j, 1])
    return sk


# ===========================================================================
# 共享辅助函数
# ===========================================================================

#=== '在指定设备上移动频谱' ===#
def _move_spectrum(ck_pad, tIrtest, device):
    """将填充后的频谱按相位矩阵在指定设备上平移。

    流程：IFFT(ck_pad) × 相位矩阵 → FFT → 返回 CPU 张量。

    Parameters
    ----------
    ck_pad : torch.Tensor
        已填充的频域分量。
    tIrtest : torch.Tensor
        相位移动因子。
    device : torch.device
        计算设备。

    Returns
    -------
    torch.Tensor
        移动后的频域张量（位于 CPU）。
    """
    ck_gpu = ck_pad.to(device=device)
    spat = tifftn(ck_gpu)
    # MPS 不支持复杂乘法，临时移 CPU 运算
    if device.type == 'cpu':
        result = spat * tIrtest
    else:
        result = (spat.cpu() * tIrtest.cpu()).to(device)
    return tfftn(result).cpu()


#=== '计算某阶的陷波衰减' ===#
def _atteg_for_order(opt, PGxy, PGz, cfai, run_parameter, notch, i, j):
    """计算方向 ``i`` 的第 ``j`` 阶的陷波衰减系数。

    根据阶次类型选择不同的衰减参数：
    - j=0 → 零级陷波
    - 0<j≤2 → 二级陷波
    - j>2 → 一级陷波

    Parameters
    ----------
    opt : Namespace
        参数对象。
    PGxy, PGz : np.ndarray
        XY 和 Z 波矢。
    cfai : np.ndarray
        调制深度与相位。
    run_parameter : dict
        运行参数，含各级陷波的强度和宽度。
    notch : int
        陷波模式（0=关闭, 1=开启）。
    i, j : int
        方向与级次索引。

    Returns
    -------
    np.ndarray
        衰减系数数组。
    """
    px, py, pz = PGxy[i, j, 0], PGxy[i, j, 1], PGz[i, j]
    if j == 0:
        return _WF.valAttenuation(opt, px, py, pz=pz,
                                  Astr=run_parameter['notch0th'],
                                  fwhm=run_parameter['attFWHM0'])
    if notch == 0:
        return _WF.valAttenuation(opt, px, py, pz=pz, Astr=0, fwhm=1)
    if notch == 1 and 0 < j <= 2:  # 二级陷波
        return _WF.valAttenuation(opt, px, py, pz=pz,
                                  Astr=run_parameter['attStrFZ'],
                                  fwhm=run_parameter['attFWHMFZ'])
    if notch == 1 and j > 2:       # 一级陷波
        return _WF.valAttenuation(opt, px, py, pz=pz,
                                  Astr=run_parameter['attStr'],
                                  fwhm=run_parameter['attFWHM'])
    return _WF.valAttenuation(opt, px, py, pz=pz, Astr=0, fwhm=1)


# ===========================================================================
# 移位后的 OTF 组装
# ===========================================================================

#=== '生成各阶移位后的 OTF' ===#
def GetFZotf(opt, Irtest, order_flag, run_parameter, PGxy, PGz,
             direction=[0, 1, 2]):
    """读取 opt.OTF 并生成每个阶次移位后的 OTF。

    对需要移位的分量，将 PSF 经相位因子调制后再 FFT 得到移位 OTF。

    Parameters
    ----------
    opt : Namespace
        含 OTF, OTFmask3D, 网格尺寸等。
    Irtest : list
        各阶的频移相位矩阵。
    order_flag : int
        重建阶次标志。
    run_parameter : dict
        运行参数。
    PGxy, PGz : np.ndarray
        波矢参数。
    direction : list
        处理的方向列表。

    Returns
    -------
    FZotf : torch.Tensor
        各阶移位后的 OTF (nc, nz_re, 2*nx, 2*ny)。
    FZotfmask : np.ndarray
        对应的布尔掩膜（当前为零填充）。
    """
    nx = opt.nx * opt.xy_expand
    ny = opt.ny * opt.xy_expand
    nz = opt.nz_re
    Norders = opt.Norders
    nc = opt.nc

    if run_parameter['meas'] != 1:
        opt.OTF = opt.OTF * opt.OTFmask3D

    OTF3D = _U.ToTensor(opt.OTF).to(device=opt.device)
    PSF3D = tfftshift(tifftn(OTF3D)).real
    OTF3D_cpu = OTF3D.cpu()

    dtype = (opt.tdtype_com if torch.is_complex(OTF3D_cpu)
             else opt.tdtype_real)
    FZotf = torch.zeros((nc, nz, nx, ny), dtype=dtype)
    FZotfmask = np.zeros((nc, nz, nx, ny), dtype=np.bool_)

    jiesu = choose_jiesu(opt, order_flag)
    for i in direction:
        for j in jiesu:
            if j == 0:
                FZotf[i * Norders + j] = OTF3D_cpu
            else:
                tIrtest = _U.ToTensor(Irtest[i * Norders + j]).to(
                    device=opt.device)
                # PSF3D 实数 × tIrtest 复数，MPS 不支持 → CPU 运算
                if opt.device.type == 'cpu':
                    shifted = PSF3D * tIrtest
                else:
                    shifted = (PSF3D.cpu() * tIrtest.cpu()).to(opt.device)
                OTF_move = abs(tfftn(tifftshift(shifted))).cpu()
                OTF_move = _U.normalize(OTF_move)
                FZotf[i * Norders + j] = OTF_move
    return FZotf, FZotfmask


# ===========================================================================
# 移位后的频谱组装
# ===========================================================================

#=== '将分离的各分量移入扩展频谱' ===#
def GetFZ(opt, ck, Irtest, order_flag, run_parameter, direction=[0, 1, 2]):
    """将每个分离的频域分量 ``ck`` 移动到扩展频谱的正确位置。

    Parameters
    ----------
    opt : Namespace
        含 ``device``, 网格尺寸, ``nc``, ``Norders``。
    ck : np.ndarray or torch.Tensor
        分离后的频域分量 (nc, nz_orig, nx, ny)。
    Irtest : list
        频移相位矩阵列表。
    order_flag : int
        重建阶次标志。
    run_parameter : dict
        运行参数。
    direction : list
        处理的方向列表。

    Returns
    -------
    FZall : torch.Tensor
        组装后的频谱 (nc, nz_re, 2*nx, 2*ny)，复数类型。
    """
    if opt.device != 'cpu':
        _U.release_device_cache(opt.device)
    nx = opt.nx * opt.xy_expand
    ny = opt.ny * opt.xy_expand
    nz = opt.nz_re
    nc = opt.nc
    Norders = opt.Norders

    ck = _U.ToTensor(ck)
    FZall = torch.zeros((nc, nz, nx, ny), dtype=torch.complex64)

    jiesu = choose_jiesu(opt, order_flag)
    for i in direction:
        for j in jiesu:
            ck_pad = _U.pad_or_cut(ck[i * Norders + j], x=nx, y=ny, z=nz)
            if j == 0:
                FZall[i * Norders + j] = ck_pad
            else:
                tIrtest = _U.ToTensor(Irtest[i * Norders + j]).to(
                    device=opt.device)
                FZall[i * Norders + j] = _move_spectrum(ck_pad, tIrtest,
                                                        opt.device)
    return FZall


#=== '联合反卷积版频谱组装（同时移动二阶分量）' ===#
def GetFZ_Joint(opt, ck, ck_02, Irtest, order_flag, run_parameter,
                direction=[0, 1, 2]):
    """联合反卷积版频谱组装：同时移动 ck 和 ck_02（二阶分量）。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    ck : np.ndarray or torch.Tensor
        主频域分量 (nc, nz_orig, nx, ny)。
    ck_02 : np.ndarray or torch.Tensor
        二阶频域分量 (9, nz_orig, nx, ny)。
    Irtest : list
        相位矩阵列表。
    order_flag : int
        阶次标志。
    run_parameter : dict
        运行参数。
    direction : list
        方向列表。

    Returns
    -------
    FZall : torch.Tensor
        主分量的扩展频谱。
    FZall_02 : torch.Tensor
        二阶分量的扩展频谱。
    """
    if opt.device != 'cpu':
        _U.release_device_cache(opt.device)
    nx = opt.nx * opt.xy_expand
    ny = opt.ny * opt.xy_expand
    nz = opt.nz_re
    nc = opt.nc
    Norders = opt.Norders

    ck = _U.ToTensor(ck)
    ck_02 = _U.ToTensor(ck_02)
    FZall = torch.zeros((nc, nz, nx, ny), dtype=torch.complex64)
    FZall_02 = torch.zeros((3 * 3, nz, nx, ny), dtype=torch.complex64)

    jiesu = choose_jiesu(opt, order_flag)
    for i in direction:
        for j in jiesu:
            if j == 0:
                ck_pad = _U.pad_or_cut(ck[i * Norders + j], x=nx, y=ny, z=nz)
                FZall[i * Norders + j] = ck_pad
                ck_02_pad = _U.pad_or_cut(ck_02[i * 3 + 0], x=nx, y=ny, z=nz)
                FZall_02[i * 3 + 0] = ck_02_pad
            elif j < 3:
                ck_pad = _U.pad_or_cut(ck[i * Norders + j], x=nx, y=ny, z=nz)
                ck_02_pad = _U.pad_or_cut(ck_02[i * 3 + j], x=nx, y=ny, z=nz)
                tIrtest = _U.ToTensor(Irtest[i * Norders + j]).to(
                    device=opt.device)
                FZall[i * Norders + j] = _move_spectrum(ck_pad, tIrtest,
                                                        opt.device)
                FZall_02[i * 3 + j] = _move_spectrum(ck_02_pad, tIrtest,
                                                     opt.device)
            else:
                ck_pad = _U.pad_or_cut(ck[i * Norders + j], x=nx, y=ny, z=nz)
                tIrtest = _U.ToTensor(Irtest[i * Norders + j]).to(
                    device=opt.device)
                FZall[i * Norders + j] = _move_spectrum(ck_pad, tIrtest,
                                                        opt.device)
    return FZall, FZall_02


# ===========================================================================
# Wiener 分子 / 分母
# ===========================================================================

#=== '构建 Wiener 滤波分子（加权频谱求和）' ===#
def GetWiener1(opt, FZall, FZotf, PGxy, PGz, cfai, w1, order_flag,
               run_parameter, notch, direction=[0, 1, 2]):
    """将各方向/各阶的加权频谱相加，构建 Wiener 滤波的分子。

    每个分量加权方式：衰减系数 × OTF 共轭 × 调制幅度共轭。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    FZall : torch.Tensor or np.ndarray
        组装后的频谱。
    FZotf : torch.Tensor or np.ndarray
        移位后的 OTF。
    PGxy, PGz : np.ndarray
        波矢参数。
    cfai : np.ndarray
        调制深度与相位。
    w1 : float
        Wiener 常数。
    order_flag : int
        阶次标志。
    run_parameter : dict
        运行参数。
    notch : int
        陷波模式。
    direction : list
        方向列表。

    Returns
    -------
    out_K_all : np.ndarray
        Wiener 分子的频域数组（复数）。
    """
    Norders = opt.Norders
    nz, nx, ny = FZall.shape[1:]
    out_K_all = np.zeros((nz, nx, ny), dtype=np.complex64)

    jiesu = choose_jiesu(opt, order_flag)
    for i in direction:
        FZ_dir = np.zeros((nz, nx, ny), dtype=np.complex64)
        for j in jiesu:
            Atteg1 = _atteg_for_order(opt, PGxy, PGz, cfai, run_parameter,
                                      notch, i, j)
            amp = cfai[i, j, 0] * np.exp(1j * cfai[i, j, 1])
            scale = Atteg1 * FZotf[i * Norders + j].conj() * np.conj(amp)
            FZ_dir += FZall[i * Norders + j] * scale
        out_K_all += FZ_dir
    return out_K_all


#=== '联合反卷积 Wiener 分子（含二阶贡献）' ===#
def GetWiener1_Joint(opt, FZall, FZall_02, FZotf, PGxy, PGz, cfai, cfai_02,
                     w1, order_flag, run_parameter, notch,
                     direction=[0, 1, 2]):
    """联合反卷积版 Wiener 分子，额外叠加二阶分量的贡献。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    FZall, FZall_02 : np.ndarray
        主频谱与二阶频谱。
    FZotf : np.ndarray
        移位 OTF。
    PGxy, PGz : np.ndarray
        波矢。
    cfai, cfai_02 : np.ndarray
        调制参数与二阶调制参数。
    w1 : float
        Wiener 常数。
    order_flag : int
        阶次标志。
    run_parameter : dict
        运行参数，含 ``joints`` 控制哪些阶次参与联合。
    notch : int
        陷波模式。
    direction : list
        方向列表。

    Returns
    -------
    out_K_all : np.ndarray
        Wiener 分子频域数组。
    """
    Norders = opt.Norders
    nz, nx, ny = FZall.shape[1:]
    out_K_all = np.zeros((nz, nx, ny), dtype=np.complex64)

    jiesu = choose_jiesu(opt, order_flag)
    for i in direction:
        FZ_dir = np.zeros((nz, nx, ny), dtype=np.complex64)
        for j in jiesu:
            Atteg1 = _atteg_for_order(opt, PGxy, PGz, cfai, run_parameter,
                                      notch, i, j)
            amp = cfai[i, j, 0] * np.exp(1j * cfai[i, j, 1])
            scale = Atteg1 * FZotf[i * Norders + j].conj() * np.conj(amp)
            FZ_dir += FZall[i * Norders + j] * scale

            if j < 3 and j >= run_parameter['joints']:
                amp_02 = cfai_02[i, j, 0] * np.exp(1j * cfai_02[i, j, 1])
                scale_02 = (Atteg1 * FZotf[i * Norders + j].conj()
                            * np.conj(amp_02))
                FZ_dir += FZall_02[i * 3 + j] * scale_02
        out_K_all += FZ_dir
    return out_K_all


#=== '构建 Wiener 滤波分母 Msum' ===#
def GetWiener2(opt, Wiener1, FZotf, PGxy, PGz, cfai, w1, order_flag,
               run_parameter, notch, direction=[0, 1, 2]):
    """构建 Wiener 滤波的分母 Msum = w1 + Σ|OTF|²·|amp|²。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    Wiener1 : np.ndarray
        已计算的 Wiener 分子（当前未使用，保留接口）。
    FZotf : np.ndarray
        移位 OTF。
    PGxy, PGz : np.ndarray
        波矢。
    cfai : np.ndarray
        调制参数。
    w1 : float
        Wiener 正则化常数。
    order_flag : int
        阶次标志。
    run_parameter : dict
        运行参数。
    notch : int
        陷波模式。
    direction : list
        方向列表。

    Returns
    -------
    Msum_all : np.ndarray
        Wiener 分母频域数组。
    """
    Norders = opt.Norders
    Msum_all = w1
    jiesu = choose_jiesu(opt, order_flag)
    for i in direction:
        for j in jiesu:
            amp = cfai[i, j, 0] * np.exp(1j * cfai[i, j, 1])
            Msum_all += FZotf[i * Norders + j] ** 2 * abs(amp) ** 2
    return Msum_all


#=== '联合反卷积 Wiener 分母（含二阶功率）' ===#
def GetWiener2_Joint(opt, Wiener1, FZotf, PGxy, PGz, cfai, cfai_02, w1,
                     order_flag, run_parameter, notch, direction=[0, 1, 2]):
    """联合反卷积版 Wiener 分母，叠加二阶分量的功率贡献。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    Wiener1 : np.ndarray
        Wiener 分子（接口占位）。
    FZotf : np.ndarray
        移位 OTF。
    PGxy, PGz : np.ndarray
        波矢。
    cfai, cfai_02 : np.ndarray
        调制参数。
    w1 : float
        Wiener 常数。
    order_flag : int
        阶次标志。
    run_parameter : dict
        运行参数，含 ``joints``。
    notch : int
        陷波模式。
    direction : list
        方向列表。

    Returns
    -------
    Msum_all : np.ndarray
        Wiener 分母频域数组。
    """
    Norders = opt.Norders
    Msum_all = w1
    jiesu = [0, 1, 2, 3, 4, 5, 6]  # 联合反卷积使用全阶次
    for i in direction:
        for j in jiesu:
            amp = cfai[i, j, 0] * np.exp(1j * cfai[i, j, 1])
            Msum_all += (FZotf[i * Norders + j]
                         * FZotf[i * Norders + j].conj()) * abs(amp) ** 2
            if j >= run_parameter['joints'] and j < 3:
                amp_02 = cfai_02[i, j, 0] * np.exp(1j * cfai_02[i, j, 1])
                Msum_all += (FZotf[i * Norders + j]
                             * FZotf[i * Norders + j].conj()) * abs(amp_02) ** 2
    return Msum_all


#=== '逆 FFT 重建并保存结果' ===#
def Final_ifft(opt, fimage_k, chushi, w1, notch, flagg, direction,
               run_parameter, filename, p1_i_):
    """执行逆 FFT，裁剪 Z 填充区域，截断负值并保存重建结果。

    Parameters
    ----------
    opt : Namespace
        参数对象，含 ``Zpadding``。
    fimage_k : np.ndarray
        Wiener 重建后的频域图像。
    chushi : int
        初始值参数（接口占位）。
    w1 : float
        Wiener 常数（接口占位）。
    notch : int
        陷波模式（接口占位）。
    flagg : int
        阶次标志（接口占位）。
    direction : list
        方向列表（接口占位）。
    run_parameter : dict
        运行参数，含 ``data_path`` 保存路径。
    filename : str
        输出文件名。
    p1_i_ : int
        文件序号（接口占位）。
    """
    temp_r = _U.ifftn(fimage_k)
    if opt.Zpadding != 0:
        temp_r_cai = temp_r[2 * opt.Zpadding:-2 * opt.Zpadding].real
    else:
        temp_r_cai = temp_r.real

    # 截断负值为零（物理约束：强度非负）
    temp_r_cai_j = np.copy(temp_r_cai)
    temp_r_cai_j[temp_r_cai_j < 0] = 0

    _U.save_tif_self3(run_parameter['data_path'], temp_r_cai_j,
                      sub_filename='Result', filename='Wiener_results.tif',
                      min_val=np.min(temp_r_cai_j), max_val=np.max(temp_r_cai_j))
    return
