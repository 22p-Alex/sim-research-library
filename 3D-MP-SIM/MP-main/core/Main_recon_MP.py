"""3D-MP-SIM 重建主流水线

编排完整重建流程：原始数据加载 → OTF/掩膜准备 → 频带分离 →
参数估计 → Wiener 重建。
"""
import numpy as np
from pathlib import Path

import DataProcess as _DP
import Para_Estimate as _PE
import Seperate_CK as _SC
import Utils as _U
import Wiener_Reconstruction as _WR
import WindowF as _WF


#=== '组装最终的参数集合' ===#
def parameter_Finalsetting(opt, PGxy, cfai_02_ck1, cfai_1jie, cfai_02_ck2,
                           run_parameter):
    """将各阶段估计的参数组装为最终的 (PGxy, cfai, PGz, ...) 参数集。

    合并二阶 cfai (ck1/ck2) 和一阶 cfai，填充 PGz 并计算 Plong。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    PGxy : np.ndarray
        各阶 XY 波矢 (3, 7, 2)。
    cfai_02_ck1 : np.ndarray
        ck1 的二阶 cfai (3, 3, 3)。
    cfai_1jie : np.ndarray
        一阶 cfai (3, 4, 3)，对应级次 3-6。
    cfai_02_ck2 : np.ndarray
        ck2 的二阶 cfai (3, 3, 3)。
    run_parameter : dict
        运行参数，含 ``pzzz``, ``remove2`` 等。

    Returns
    -------
    PGxy, cfai, cfai_save, cfai_02, cfai_02_save, PGz, P_long, Plong
    """
    cfai = np.zeros((3, 7, 3))
    cfai[:, [0, 1, 2], :] = cfai_02_ck1
    cfai[:, [3, 4, 5, 6], :] = cfai_1jie

    cfai_02 = np.copy(cfai_02_ck2)
    cfai[:, 0, 2] = 1

    PGz = np.zeros((3, 7))
    if run_parameter['pzzz'] != 0 and opt.flag_N == 'MP':
        PGz[:, [3, 5]] = -run_parameter['pzzz']
        PGz[:, [4, 6]] = run_parameter['pzzz']

    P_long = np.sqrt(PGxy[:, :, 0] ** 2 + PGxy[:, :, 1] ** 2).round(2)
    Plong = np.mean(P_long[:, 1])

    cfai_save = np.copy(cfai)
    cfai_02_save = np.copy(cfai_02_ck2)
    if run_parameter['remove2'] == 1:
        cfai[:, [0, 1, 2], 1] = 0
        cfai_02[:, [0, 1, 2], 1] = 0
    return (PGxy, cfai, cfai_save, cfai_02, cfai_02_save, PGz, P_long, Plong)


# ===========================================================================
# 流水线各步骤的辅助函数
# ===========================================================================

#=== '加载主/副原始数据对' ===#
def _load_dr_pair(opt, p1_i, p1_i_, run_parameter, isdebug):
    """加载主原始数据栈（以及 55 模式下的副栈）。

    对 55 序列模式（15+15），额外加载同一目录下的下一个文件作为副数据。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    p1_i : Path
        主数据文件路径。
    p1_i_ : int
        主数据文件的迭代索引。
    run_parameter : dict
        运行参数。
    isdebug : dict
        调试标志。

    Returns
    -------
    Dr, Dr_2, opt : np.ndarray, np.ndarray or None, Namespace
        主数据、副数据（可能为 None）、更新后的参数。
    """
    Dr4D_ZPA, opt = _DP.loadANDprocess_Dr(opt, p1_i, run_parameter)
    Dr = _DP.Image_zpadding(opt, Dr4D_ZPA, edge_coeff=run_parameter['pad_coeff'])
    del Dr4D_ZPA

    if isdebug['loa'] == 1:
        movex = run_parameter['movex']
        movey = run_parameter['movey']
        _U.save_tif_v21(rf'WF8-rawdataSUM-{movex, movey}.tif',
                        np.mean(Dr, axis=0), run_parameter)
        _U.save_tif_v21('Dr.tif', Dr[[0, 1, 2]], run_parameter)

    Dr_2 = None
    if opt.sequence in (55, 5343, 5352):
        idx = p1_i_ + 1
        siblings = list(p1_i.parent.iterdir())
        p2_i = siblings[idx]
        Dr4D_ZPA2, opt = _DP.loadANDprocess_Dr(opt, p2_i, run_parameter)
        Dr_2 = _DP.Image_zpadding(opt, Dr4D_ZPA2,
                                  edge_coeff=run_parameter['pad_coeff'])
        del Dr4D_ZPA2
        if isdebug['loa'] == 1:
            _U.save_tif_v21('Dr_2.tif', Dr_2[[0, 1, 2]], run_parameter)
    return Dr, Dr_2, opt


#=== '准备 OTF 与掩膜' ===#
def _prepare_otf_and_mask(opt, otf_files, run_parameter, isdebug):
    """加载 OTF 文件，生成掩膜并填充到 ``opt`` 中。

    OTF 和掩膜会被横向扩展 2 倍、轴向扩展 2 倍后存入 opt。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    otf_files : list of Path
        OTF 文件列表。
    run_parameter : dict
        运行参数。
    isdebug : dict
        调试标志。
    """
    print()
    print("2 加载 OTF ---------")
    if run_parameter['createOTF'] == 0:
        for p2_k in otf_files:
            if not p2_k.is_file():
                continue
            OTF3D, OTF2D, psf = _DP.load_OTF(opt, p2_k, Debug=isdebug['loa'])
            OTF3D[abs(OTF3D) < 1e-10] = 0
            OTF2D[abs(OTF2D) < 1e-10] = 0
            if isdebug['loa'] == 1:
                _U.save_tif_v21('OTF3D_load.tif', abs(OTF3D), run_parameter)
                _U.save_tif_v21('OTF2D_load.tif', abs(OTF2D), run_parameter)
    else:
        raise ValueError("无法生成 3DSIM OTF，请提供 OTF 文件")

    # 若有 Z 填充则进行轴向插值
    if opt.nz != 1 and opt.Zpadding != 0:
        nz, nx, ny = OTF3D.shape
        OTF3D = _U.Interpolate(OTF3D, nx=nx, ny=ny,
                               nz=opt.nz + 2 * opt.Zpadding)

    print()
    print("3 生成 OTF 掩膜 ---------")
    OTFmask3D, OTFmask2D = _DP.generatemask(opt, isdebug)
    assert len(OTFmask3D.shape) == 3  # (nz_re, 2nx, 2ny)
    assert len(OTFmask2D.shape) == 2  # (2nx, 2ny)
    if isdebug['loa'] == 1:
        _U.save_tif_v21('OTFmask3D.tif', OTFmask3D, run_parameter)

    # 横向×2，轴向×2 填充入 opt
    opt.OTF = _U.pad_or_cut(OTF3D, x=2 * opt.nx, y=2 * opt.ny, z=opt.nz_re)
    opt.OTF2D = _U.pad_or_cut(OTF2D, x=2 * opt.nx, y=2 * opt.ny, z=1)
    opt.OTFmask3D = _U.pad_or_cut(OTFmask3D, x=2 * opt.nx, y=2 * opt.ny,
                                  z=opt.nz_re)
    opt.OTFmask2D = _U.pad_or_cut(OTFmask2D, x=2 * opt.nx, y=2 * opt.ny, z=1)
    if isdebug['loa'] == 1:
        _U.save_tif_v21('opt.OTF.tif', abs(opt.OTF), run_parameter)
        _U.save_tif_v21('opt.OTF2D.tif', abs(opt.OTF2D), run_parameter)
        _U.save_tif_v21('opt.OTFmask3D.tif', opt.OTFmask3D, run_parameter)
        _U.save_tif_v21('opt.OTFmask2D.tif', opt.OTFmask2D, run_parameter)


#=== '执行双栈频带分离' ===#
def _separate_and_combine(opt, Dr, Dr_2, run_parameter, isdebug):
    """对 55 模式下的两个时间栈执行频带分离。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    Dr, Dr_2 : np.ndarray
        两个 4D 空域数据栈，第一维大小均为 15。
    run_parameter : dict
        运行参数。
    isdebug : dict
        调试标志。

    Returns
    -------
    ck1, ck2 : np.ndarray
        分离后的两个频域分量，形状均为 (15, nz, nx, ny)。
    """
    assert opt.sequence == 55
    assert Dr.shape[0] == 15
    assert Dr_2.shape[0] == 15
    print("第一个数据分离中.....")
    ck1 = _SC.separate_step_one(opt, Dr, run_parameter, Nshifts=5,
                                Debug=isdebug['sep'])
    print("第二个数据分离中.....")
    ck2 = _SC.separate_step_one(opt, Dr_2, run_parameter, Nshifts=5,
                                Debug=isdebug['sep'])
    return ck1, ck2


#=== '估计/加载 ±2 级 PGxy 和 cfai' ===#
def _estimate_second_order(opt, ck1, ck2, file_name3, filename,
                           run_parameter, isdebug):
    """估计或从文件加载 ±2 级的 PGxy 和 cfai。

    根据 ``loadflag`` 选择：重新估计(0)、全部加载(1)、只加载 PGxy(3)、
    自动判断(4/5)。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    ck1, ck2 : np.ndarray
        两个分离后的频域分量。
    file_name3 : Path
        参数文件目录。
    filename : str
        文件名前缀。
    run_parameter : dict
        运行参数。
    isdebug : dict
        调试标志。

    Returns
    -------
    PGxy, PGxy_2, cfai_02_ck1, cfai_02_ck2, flag_temp
    """
    print("4-1 参数估计 - 一级 ----- 主要针对二阶 PGxy -----------")
    flag_temp = 0
    cfai = None
    cfai02 = None

    if run_parameter['loadflag'] == 0:
        PGxy = _PE.parameter_estimationP2(opt, ck1, Debug=isdebug['est'],
                                          filename=filename + '5x5',
                                          run_parameter=run_parameter)
    elif run_parameter['loadflag'] == 1:
        cfai, PGxy, _, _ = _PE.loadparameter(opt, file_name3, run_parameter)
        if (run_parameter['remove2'] == 1
                or run_parameter['joint_deconvolution'] == 1):
            cfai02 = _PE.loadparameter4(opt, file_name3, run_parameter)
        flag_temp = 1
    elif run_parameter['loadflag'] == 3:
        PGxy, _, _ = _PE.loadparameter2(opt, file_name3, run_parameter)
    elif run_parameter['loadflag'] == 4:
        try:
            PGxy, _, _ = _PE.loadparameter2(opt, file_name3, run_parameter)
        except Exception:
            pass
        if flag_temp == 0:
            PGxy = _PE.parameter_estimationP2(opt, ck1, Debug=isdebug['est'],
                                              filename=filename + '5x5',
                                              run_parameter=run_parameter)
    elif run_parameter['loadflag'] == 5:
        try:
            cfai, PGxy, _, _ = _PE.loadparameter(opt, file_name3,
                                                 run_parameter)
            if (run_parameter['remove2'] == 1
                    or run_parameter['joint_deconvolution'] == 1):
                cfai02 = _PE.loadparameter4(opt, file_name3, run_parameter)
            flag_temp = 1
        except Exception:
            pass
        if flag_temp == 0:
            PGxy = _PE.parameter_estimationP2(opt, ck1, Debug=isdebug['est'],
                                              filename=filename + '5x5',
                                              run_parameter=run_parameter)

    PGxy_2 = PGxy[:, [0, 1, 2], :]  # (3, 3, 2)

    print("4-1 参数估计 - 一级 ----- 主要针对二阶 cfai -----------")
    if flag_temp == 0:
        cfai_02_ck1 = _PE.parameter_estimation_02(
            opt, ck1[[0, 1, 2, 5, 6, 7, 10, 11, 12]], PGxy_2, Norders=3,
            Debug=isdebug['est'], filename=filename + "-ck1",
            run_parameter=run_parameter)
        cfai_02_ck2 = _PE.parameter_estimation_02(
            opt, ck2[[0, 1, 2, 5, 6, 7, 10, 11, 12]], PGxy_2, Norders=3,
            Debug=isdebug['est'], filename=filename + "-ck2",
            run_parameter=run_parameter)
    else:
        cfai_02_ck1 = cfai[:, [0, 1, 2], :]
        cfai_02_ck2 = cfai02
    return PGxy, PGxy_2, cfai_02_ck1, cfai_02_ck2, flag_temp


#=== '构建 7 阶 ck 分量数组' ===#
def _build_ck7(opt, ck1, ck2, cfai_02_ck1, cfai_02_ck2, run_parameter):
    """将两个 5 带堆栈合并为 7 阶 ck 分量，可选地移除二阶相位。

    若启用联合反卷积，额外准备 ck_02 二阶分量。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    ck1, ck2 : np.ndarray
        两个 5 带分离结果 (15, nz, nx, ny)。
    cfai_02_ck1, cfai_02_ck2 : np.ndarray
        两个栈的二阶 cfai。
    run_parameter : dict
        运行参数，含 ``remove2``, ``joint_deconvolution``。

    Returns
    -------
    ck : np.ndarray
        7 阶分量数组 (21, nz, nx, ny)。
    ck_02 : np.ndarray or None
        联合反卷积用的二阶分量，若未启用则为 None。
    """
    if run_parameter['remove2'] == 1:
        cfai_021_ck1 = np.zeros((3, 5, 3))
        cfai_021_ck2 = np.zeros((3, 5, 3))
        for k in range(3):
            cfai_021_ck1[k, 0:3] = cfai_02_ck1[k, 0:3]
            cfai_021_ck1[k, 3:5] = cfai_02_ck1[k, 1:3] / 2
            cfai_021_ck2[k, 0:3] = cfai_02_ck2[k, 0:3]
            cfai_021_ck2[k, 3:5] = cfai_02_ck2[k, 1:3] / 2
        ck1_wofai = _WR.removefai(opt, ck1, cfai_021_ck1)
        ck2_wofai = _WR.removefai(opt, ck2, cfai_021_ck2)
        ck = _SC.GETck(opt, ck1_wofai, ck2_wofai, run_parameter)
    else:
        ck = _SC.GETck(opt, ck1, ck2, run_parameter)

    ck_02 = None
    if opt.sequence == 55 and run_parameter['joint_deconvolution'] == 1:
        ck_02 = np.zeros_like(ck[0:9])
        for iii in range(3):
            for jjj in [0, 1, 2]:
                if run_parameter['remove2'] == 1:
                    ck_02[3 * iii + jjj] = np.copy(ck2_wofai[iii * 5 + jjj])
                else:
                    ck_02[3 * iii + jjj] = np.copy(ck2[iii * 5 + jjj])
    return ck, ck_02


#=== '对分离后的分量施加 OTF 支撑域掩膜' ===#
def _apply_mask(opt, ck, ck_02, run_parameter):
    """对每个分离后的频域分量施加 OTF 支撑域掩膜，滤除域外噪声。

    Parameters
    ----------
    opt : Namespace
        含 ``OTFmask3D``。
    ck : np.ndarray
        7 阶分量数组。
    ck_02 : np.ndarray or None
        二阶分量数组。
    run_parameter : dict
        含 ``use_mask``, ``meas``, ``joint_deconvolution``。
    """
    if run_parameter['use_mask'] != 1:
        return
    if run_parameter['meas'] == 1:
        jieshu = [0]
        jieshu2 = [0]
    else:
        jieshu = [0, 1, 2, 3, 4, 5, 6]
        jieshu2 = [0, 1, 2]
    mask = _U.pad_or_cut(opt.OTFmask3D, opt.nx, opt.ny,
                         opt.nz + 2 * opt.Zpadding)
    for dir_idx in range(3):
        for order_idx in jieshu:
            ck[dir_idx * 7 + order_idx] = ck[dir_idx * 7 + order_idx] * mask
        if run_parameter['joint_deconvolution'] == 1:
            for order_idx in jieshu2:
                ck_02[dir_idx * 3 + order_idx] = (ck_02[dir_idx * 3 + order_idx]
                                                  * mask)


#=== '执行 Wiener 重建' ===#
def _reconstruct(opt, PGxy, PGz, cfai, cfai_02, ck, ck_02, run_parameter,
                 isdebug, filename, p1_i_):
    """遍历方向/阶次/陷波参数，执行 Wiener 重建。

    流程：生成频移矩阵 → 构建移位 OTF → 组装频谱 →
    计算 Wiener 分子/分母 → 切趾 → 逆 FFT 保存结果。

    Parameters
    ----------
    opt : Namespace
        参数对象。
    PGxy, PGz : np.ndarray
        XY 和 Z 波矢。
    cfai, cfai_02 : np.ndarray
        调制参数与二阶调制参数。
    ck, ck_02 : np.ndarray
        7 阶分量与二阶分量。
    run_parameter : dict
        运行参数。
    isdebug : dict
        调试标志。
    filename : str
        输出文件名前缀。
    p1_i_ : int
        文件序号。
    """
    print()
    print(" 5 准备重建 --------")
    print(" 5-1 生成 Ir -------")
    Irtest = _WR.IrTEST(opt, PGxy, PGz, z_expand=opt.z_expand,
                        Zchushu=opt.z_expand * (opt.nz + 2 * opt.Zpadding))

    directions = run_parameter['directions']
    BattStrFZs = run_parameter['attStrFZs']
    BattFWHMFZs = run_parameter['attFWHMFZs']
    BattStrs = run_parameter['attStrs']
    BattFWHMts = run_parameter['attFWHMs']

    for direction in directions:
        for order_flag in run_parameter['orderForRe']:
            for Method_c in run_parameter['Method_c']:
                for notch in run_parameter['notch']:
                    if notch == 0:
                        run_parameter['attStrFZs'] = [0]
                        run_parameter['attFWHMFZs'] = [1]
                        run_parameter['attStrs'] = [0]
                        run_parameter['attFWHMs'] = [1]
                    else:
                        run_parameter['attStrFZs'] = BattStrFZs
                        run_parameter['attFWHMFZs'] = BattFWHMFZs
                        run_parameter['attStrs'] = BattStrs
                        run_parameter['attFWHMs'] = BattFWHMts

                    FZotf, FZotfmask = _WR.GetFZotf(
                        opt, Irtest, order_flag=order_flag,
                        run_parameter=run_parameter, PGxy=PGxy, PGz=PGz,
                        direction=direction)
                    FZotf = abs(FZotf)
                    if isdebug['mov'] == 1:
                        _U.save_tif_v21(r'FZotf-abs.tif',
                                        abs(FZotf[[0, 1, 2, 3, 4]]),
                                        run_parameter)

                    if run_parameter['joint_deconvolution'] == 0:
                        FZall = _WR.GetFZ(opt, ck, Irtest,
                                          order_flag=order_flag,
                                          run_parameter=run_parameter,
                                          direction=direction)
                    elif opt.sequence == 55 and \
                            run_parameter['joint_deconvolution'] == 1:
                        FZall, FZall_02 = _WR.GetFZ_Joint(
                            opt, ck, ck_02, Irtest, order_flag=order_flag,
                            run_parameter=run_parameter, direction=direction)
                    if isdebug['mov'] == 1:
                        _U.save_tif_v21(r'FZall.tif',
                                        abs(FZall[[0, 1, 2, 3, 4]]),
                                        run_parameter)

                    # 将列表参数转为标量
                    run_parameter['notch0th'] = run_parameter['notch0ths'][0]
                    run_parameter['attFWHM0'] = run_parameter['attFWHM0s'][0]
                    run_parameter['notch1st_pang'] = \
                        run_parameter['notch1st_pangs'][0]
                    run_parameter['attStrFZ'] = run_parameter['attStrFZs'][0]
                    run_parameter['attFWHMFZ'] = run_parameter['attFWHMFZs'][0]
                    run_parameter['attStr'] = run_parameter['attStrs'][0]
                    run_parameter['attFWHM'] = run_parameter['attFWHMs'][0]

                    if run_parameter['joint_deconvolution'] == 0:
                        Wiener1 = _WR.GetWiener1(
                            opt, _U.ToNumpy(FZall), _U.ToNumpy(FZotf),
                            PGxy, PGz, cfai, 1, order_flag, run_parameter,
                            notch, direction=[0, 1, 2])
                    elif opt.sequence == 55 and \
                            run_parameter['joint_deconvolution'] == 1:
                        Wiener1 = _WR.GetWiener1_Joint(
                            opt, _U.ToNumpy(FZall), _U.ToNumpy(FZall_02),
                            _U.ToNumpy(FZotf), PGxy, PGz, cfai, cfai_02, 1,
                            order_flag, run_parameter, notch,
                            direction=[0, 1, 2])
                    if isdebug['wie'] == 1:
                        _U.save_tif_v21('Wiener1-k-.tif', abs(Wiener1),
                                        run_parameter)

                    for w2 in opt.W:
                        if run_parameter['joint_deconvolution'] == 0:
                            filename2 = filename
                            Msum_all = _WR.GetWiener2(
                                opt, _U.ToNumpy(Wiener1), _U.ToNumpy(FZotf),
                                PGxy, PGz, cfai, w2, order_flag,
                                run_parameter, notch, direction=[0, 1, 2])
                        elif opt.sequence == 55 and \
                                run_parameter['joint_deconvolution'] == 1:
                            filename2 = filename + 'J'
                            Msum_all = _WR.GetWiener2_Joint(
                                opt, _U.ToNumpy(Wiener1), _U.ToNumpy(FZotf),
                                PGxy, PGz, cfai, cfai_02, w2, order_flag,
                                run_parameter, notch, direction=[0, 1, 2])

                        Apo = _WF.bhs_3D_Z(opt, opt.plongxs * opt.plong,
                                            opt.fcxs * opt.fc,
                                            z_expand=opt.z_expand,
                                            Zjust=opt.Apoz)
                        Wiener2 = Wiener1 / Msum_all
                        Wiener2 = Wiener2 * Apo

                        _WR.Final_ifft(opt, _U.ToNumpy(Wiener2), Method_c, w2,
                                       notch, order_flag, direction,
                                       run_parameter=run_parameter,
                                       filename=filename2, p1_i_=p1_i_)


# ===========================================================================
# 主入口
# ===========================================================================

#=== '3D-MP-SIM 重建主流程' ===#
def main(opt, file_name1, file_name2, file_name3, run_parameter,
         isdebug=False):
    """3D-MP-SIM 重建的主工作流入口。

    完整流程：
    1. 加载原始时序/切片数据 (Dr) + Z 填充/加窗
    2. 加载或合成系统 OTF
    3. 频带分离 (Separate CK) 获取高频分量
    4. 参数估计 (PGxy, PGz, 调制相位)
    5. Wiener 反卷积并组装扩展 3D 频谱 → 超分辨重建

    Parameters
    ----------
    opt : Namespace
        光学和重建参数对象。
    file_name1 : str or Path
        原始数据文件目录。
    file_name2 : str or Path
        OTF 文件目录。
    file_name3 : str or Path
        参数文件保存目录。
    run_parameter : dict
        运行参数字典。
    isdebug : dict
        调试标志字典。
    """
    # 预先收集 OTF 文件（避免迭代器在多轮循环中耗尽）
    otf_dir = Path(str(file_name2))
    if otf_dir.is_dir() and not any(otf_dir.iterdir()):
        raise ValueError('在 OTF 路径下未找到 OTF 文件')
    otf_files = [f for f in otf_dir.iterdir()]

    same_region_fai = []
    same_region_pxy = []
    p1_i_ = -1
    for p1_i in Path(str(file_name1)).iterdir():
        if not p1_i.is_file():
            continue
        p1_i_ += 1
        if opt.sequence == 55 and p1_i_ % 2 == 1:
            print("跳过:", p1_i)
            continue

        print("p1_i:", p1_i)
        filename = p1_i.name[-15:-11]
        run_parameter['filename'] = filename

        # ---- 1. 加载原始数据 ----
        print()
        print("1 加载原始数据 ------------")
        Dr, Dr_2, opt = _load_dr_pair(opt, p1_i, p1_i_, run_parameter, isdebug)

        # ---- 2/3. OTF + 掩膜 ----
        _prepare_otf_and_mask(opt, otf_files, run_parameter, isdebug)

        # ---- 4. 频带分离 ----
        print()
        print("4 频带分离 ------------")
        if opt.sequence != 55:
            raise ValueError('序列错误')
        ck1, ck2 = _separate_and_combine(opt, Dr, Dr_2, run_parameter, isdebug)

        PGxy, PGxy_2, cfai_02_ck1, cfai_02_ck2, flag_temp = \
            _estimate_second_order(opt, ck1, ck2, file_name3, filename,
                                   run_parameter, isdebug)

        ck, ck_02 = _build_ck7(opt, ck1, ck2, cfai_02_ck1, cfai_02_ck2,
                               run_parameter)
        _apply_mask(opt, ck, ck_02, run_parameter)

        filename = p1_i.name[-8:-4]
        assert len(ck.shape) == 4  # (21, nz, nx, ny)

        del ck1, ck2

        # ---- 5. 一阶参数估计 ----
        print()
        print("4-2 参数估计 二级 ----- 主要针对一阶 cfai -----------")
        PGxy = np.zeros((3, 7, 2))
        PGxy[:, 0:3, :] = PGxy_2
        PGxy[:, 3, :] = PGxy[:, 1, :] / 2
        PGxy[:, 4, :] = PGxy[:, 1, :] / 2
        PGxy[:, 5, :] = PGxy[:, 2, :] / 2
        PGxy[:, 6, :] = PGxy[:, 2, :] / 2

        if flag_temp == 0:
            cfai_1jie7, _, _, _, _ = _PE.parameter_estimation3(
                opt, ck, PGxy, Debug=isdebug['est'],
                filename=filename + '2 level', run_parameter=run_parameter,
                jieshu=[3, 4, 5, 6])
            cfai_1jie = cfai_1jie7[:, [3, 4, 5, 6], :]
        else:
            cfai_1jie = cfai[:, [3, 4, 5, 6], :]

        (PGxy, cfai, cfai_save, cfai_02, cfai_02_save, PGz, P_long,
         plong) = parameter_Finalsetting(opt, PGxy, cfai_02_ck1, cfai_1jie,
                                         cfai_02_ck2, run_parameter)

        same_region_fai.append(cfai)
        same_region_pxy.append(PGxy)

        opt.plong = plong
        run_parameter['PGz_avg'] = np.mean(abs(PGz[:, -4:])).round(3)

        if run_parameter['just_cfai']:
            break

        # ---- 6. Wiener 重建 ----
        _reconstruct(opt, PGxy, PGz, cfai, cfai_02, ck, ck_02, run_parameter,
                     isdebug, filename, p1_i_)

        if run_parameter['just_cfai'] == 1 or run_parameter['fast'] == 1:
            break

    if run_parameter['just_cfai']:
        print(r'参数计算完成')
        return
    return
