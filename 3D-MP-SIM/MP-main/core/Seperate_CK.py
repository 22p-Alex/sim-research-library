"""3D-MP-SIM 的频带分离模块

生成基于相移的分离矩阵，对原始傅里叶堆栈进行频带分离，
并将两个时间点的 5 带堆栈合并为最终的 7 级分量数组。
"""
import numpy as np

import Utils as _U


#=== '生成 5 相位分离矩阵' ===#
def SepMatrix5(faiXY, order):
    """生成 5 相位分离矩阵，每个方向重复一份。

    矩阵维度为 (3, 5, 5)，每行 (3 行对应 3 个条纹方向) 通过复指数
    相位因子将 5 个相移图像分离为 ±2 / ±1 / 0 级分量。

    Parameters
    ----------
    faiXY : float
        横向相移间距（以 π 为单位），如 2/5 表示 2π/5。
    order : list
        各分量的级次列表，如 [0, 1, 2, 3, 4]。

    Returns
    -------
    cp : np.ndarray
        形状为 (3, 5, 5) 的分离矩阵。
    """
    faiPi = faiXY * np.pi
    ps = faiPi * np.array(order)
    cp = np.array([[1, 1, 1, 1, 1],
                   [1, np.exp(2j * ps[1]), np.exp(-2j * ps[1]),
                    np.exp(1j * ps[1]), np.exp(-1j * ps[1])],
                   [1, np.exp(2j * ps[2]), np.exp(-2j * ps[2]),
                    np.exp(1j * ps[2]), np.exp(-1j * ps[2])],
                   [1, np.exp(2j * ps[3]), np.exp(-2j * ps[3]),
                    np.exp(1j * ps[3]), np.exp(-1j * ps[3])],
                   [1, np.exp(2j * ps[4]), np.exp(-2j * ps[4]),
                    np.exp(1j * ps[4]), np.exp(-1j * ps[4])]])
    return np.repeat(cp[np.newaxis, :, :], 3, axis=0)


#=== '向量化逆分离矩阵乘法' ===#
def _apply_sep(cp_inv, Dr, Nangles, Nshifts):
    """使用 batched einsum 执行逆分离矩阵的向量化乘法。

    将 (Nangles, Nshifts, Nshifts) 的逆矩阵乘以重排后的数据，
    实现高效的批量频带分离。

    Parameters
    ----------
    cp_inv : np.ndarray
        形状为 (Nangles, Nshifts, Nshifts) 的逆分离矩阵。
    Dr : np.ndarray
        4D 频域数据 (Nangles*Nshifts, nz, nx, ny)。
    Nangles : int
        条纹方向数。
    Nshifts : int
        每个方向的相移步数。

    Returns
    -------
    Cr : np.ndarray
        分离后的 4D 数据。
    """
    nc, nz, nx, ny = Dr.shape
    Dr_1D = Dr.reshape(Nangles, Nshifts, -1)
    Cr_1D = np.einsum('ijk,ikl->ijl', cp_inv, Dr_1D)
    Cr = Cr_1D.reshape(Nangles, Nshifts, nz, nx, ny)
    return Cr.reshape(nc, nz, nx, ny)


#=== '频带分离（使用 opt 中的角度/相移数）' ===#
def Matual(opt, Dr, cp):
    """使用 ``opt.Nangles`` / ``opt.Nshifts`` 执行频带分离。

    对每个条纹方向分别应用分离矩阵进行逐方向解混。

    Parameters
    ----------
    opt : Namespace
        含 ``Nangles``, ``Nshifts`` 属性。
    Dr : np.ndarray
        4D 频域数据 (Nangles*Nshifts, nz, nx, ny)。
    cp : np.ndarray
        形状为 (Nangles, Nshifts, Nshifts) 的分离矩阵（或其逆）。

    Returns
    -------
    np.ndarray
        分离后的 4D 数据。
    """
    nc, nz, nx, ny = Dr.shape
    Cr = np.zeros((opt.Nangles, opt.Nshifts, nz, nx, ny), dtype=np.complex64)
    Dr_1D = Dr.reshape(opt.Nangles, opt.Nshifts, -1)
    print(Cr.shape, Dr_1D.shape)
    for i in range(opt.Nangles):
        temp = cp[i] @ Dr_1D[i]
        Cr[i] = temp.reshape(opt.Nshifts, nz, nx, ny)
    return Cr.reshape(nc, nz, nx, ny)


#=== '频带分离（显式指定角度/相移数）' ===#
def Matual_self(opt, Dr, cp, Nangles=3, Nshifts=5):
    """使用显式指定的角度/相移数执行频带分离。

    Parameters
    ----------
    opt : Namespace
        参数对象（当前未直接使用）。
    Dr : np.ndarray
        4D 频域数据。
    cp : np.ndarray
        分离矩阵。
    Nangles : int
        条纹方向数。
    Nshifts : int
        相移步数。

    Returns
    -------
    np.ndarray
        分离后的 4D 数据。
    """
    nc, nz, nx, ny = Dr.shape
    Cr = np.zeros((Nangles, Nshifts, nz, nx, ny), dtype=np.complex64)
    Dr_1D = Dr.reshape(Nangles, Nshifts, -1)
    print(Cr.shape, Dr_1D.shape)
    for i in range(Nangles):
        temp = cp[i] @ Dr_1D[i]
        Cr[i] = temp.reshape(Nshifts, nz, nx, ny)
    return Cr.reshape(nc, nz, nx, ny)


#=== '第一级分离：获得 0/±2/±1 分量' ===#
def separate_step_one(opt, Dr, run_parameter, Debug=0, Nshifts=5):
    """第一级频带分离：通过 5×5 伪逆矩阵获得 0、±2、±1 级分量。

    流程：对原始空域数据做 3D FFT → 使用分离矩阵的伪逆进行批量解混。

    Parameters
    ----------
    opt : Namespace
        含 ``faiXY``, ``order5``, ``Nangles`` 等参数。
    Dr : np.ndarray
        4D 空域数据，第一维大小必须为 15 (3 方向 × 5 相移)。
    run_parameter : dict
        运行参数（用于调试保存）。
    Debug : int
        若为 1 则保存中间频域图像。
    Nshifts : int
        相移步数，默认 5。

    Returns
    -------
    ck : np.ndarray
        分离后的 4D 频域数据（复数）。
    """
    assert Dr.shape[0] == 15
    cp = SepMatrix5(opt.faiXY, opt.order5)
    # 批量伪逆 (3, 5, 5)
    cp_inv = np.linalg.pinv(cp)

    nc = opt.Nangles * 5
    assert nc == Dr.shape[0]

    # 批量 3D FFT + fftshift
    Dk = np.fft.fftshift(np.fft.fftn(Dr, axes=(1, 2, 3)), axes=(1, 2, 3))
    Dk = Dk.astype(opt.dtype_com)

    if Debug == 1:
        _U.save_tif_v21('RAW-DATA-K—ori123-.TIF', np.abs(Dk[[0]]),
                        run_parameter)

    ck = Matual_self(opt, Dk, cp_inv, Nangles=3, Nshifts=Nshifts)
    return ck


#=== '一阶分量的 2×2 轴向分离' ===#
def comb1jie(opt, ckk1, ckk2, fai7XY=0.52 * np.pi):
    """对一阶分量对执行 2×2 分离，得到两个轴向波瓣。

    使用两个相位编码的叠加（相位差由 ``fai7XY`` 决定），
    通过伪逆矩阵将混合的两个轴向分量分离。

    Parameters
    ----------
    opt : Namespace
        参数对象，用于确定数据类型。
    ckk1, ckk2 : np.ndarray
        来自两个时间点的一阶分量对，形状 (nz, nx, ny)。
    fai7XY : float
        两个时间点之间的相位差，默认 0.52π。

    Returns
    -------
    lobe_a, lobe_b : np.ndarray
        分离后的两个轴向波瓣，形状均为 (nz, nx, ny)。
    """
    psz = np.array([0, fai7XY])
    cp = np.array([[np.exp(1j * psz[0]), np.exp(-1j * psz[0])],
                   [np.exp(1j * psz[1]), np.exp(-1j * psz[1])]])
    cp_inv = np.linalg.pinv(cp)

    nz, nx, ny = ckk1.shape
    stack_ = np.zeros((2, nz, nx, ny), dtype=opt.dtype_com)
    stack_[0] = ckk1
    stack_[1] = ckk2

    Dr_1D = stack_.reshape(2, -1)
    temp = cp_inv @ Dr_1D
    Ck_1jie = temp.reshape(2, nz, nx, ny)
    return Ck_1jie[0], Ck_1jie[1]


#=== '合并两个 5 带堆栈为 7 级分量数组' ===#
def GETck(opt, ck1, ck2, run_parameter):
    """将两个时间点的 5 带分离堆栈合并为 21 带的 7 级分量数组。

    每个方向的 7 个分量为：
    0 级、-2 级、+2 级、(-1,-1)、(-1,+1)、(+1,+1)、(+1,-1)。

    Parameters
    ----------
    opt : Namespace
        参数对象，含 ``faiZ`` 轴向相位差。
    ck1, ck2 : np.ndarray
        两个时间点的 5 带堆栈，形状均为 (15, nz, nx, ny)。
    run_parameter : dict
        运行参数。

    Returns
    -------
    ck : np.ndarray
        合并后的 21 带分量数组 (21, nz, nx, ny)。
    """
    _, nz, nx, ny = ck1.shape
    ck = np.zeros((21, nz, nx, ny), dtype=np.complex64)
    for i in range(3):
        for j in range(5):
            if j < 3:  # 0 / ±2 级
                ck[i * 7 + j] = ck1[i * 5 + j]
            elif j == 3:  # 一阶分量 3,4
                ck[i * 7 + 3], ck[i * 7 + 4] = comb1jie(
                    opt, ck1[i * 5 + j], ck2[i * 5 + j], opt.faiZ * np.pi)
            elif j == 4:  # 一阶分量 5,6
                ck[i * 7 + 5], ck[i * 7 + 6] = comb1jie(
                    opt, ck1[i * 5 + j], ck2[i * 5 + j], opt.faiZ * np.pi)
    return ck
