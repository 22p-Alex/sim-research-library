"""488nm 通道的参数配置与重建启动脚本

设定光学参数、重建参数、运行参数，并启动整个重建流水线。
支持 488nm 和 561nm 两个通道。
"""
from . import Run_recon_MP as _RUN1
import argparse
import numpy as np
from pathlib import Path
from . import Utils as _U


#=== '设定 488nm 光学参数' ===#
def opt_opical_parameter1():
    """设定 488nm 激发/525nm 发射通道的光学参数。

    包括折射率、照明角度、激发/发射波长、数值孔径等。

    Returns
    -------
    opt_op : Namespace
        光学参数对象。
    """
    # 488-525 油镜
    opt_op = argparse.Namespace()

    opt_op.n = 1.33                                    # 样品折射率
    opt_op.theta = 72.7 * (np.pi / 180)                # 照明角度（弧度）

    opt_op.NAzm = opt_op.n * np.sin(opt_op.theta)      # 照明光路 NA
    opt_op.NAjs = 1.33                                 # 接收光路 NA
    opt_op.na = opt_op.NAjs
    opt_op.namin = min(opt_op.NAjs, opt_op.n)           # 最小 NA

    opt_op.Wzm = 488                                    # 激发波长 (nm)
    opt_op.Wjs = 525                                    # 发射波长 (nm)

    opt_op.n_mask = 1.33                                # 掩膜计算用折射率

    opt_op.waterN = 1.33                                # 水折射率
    opt_op.lamdex = 488                                 # 激发波长
    opt_op.lamdem = 525                                 # 发射波长

    return opt_op


#=== '设定重建参数 (MP 5+5 模式)' ===#
def opt_RUN1_parameter1(opt_1):
    """设定 MP 5+5 模式的三维结构光照明显微镜重建参数。

    Parameters
    ----------
    opt_1 : Namespace
        待填充的重建参数对象。

    Returns
    -------
    opt_1 : Namespace
        更新后的参数对象。
    """
    # 基础 MP 5+5 模式
    opt_1.flag_N = "MP"          # 成像模式：MP=7 阶
    opt_1.Nshifts = 5            # 每个方向的相移步数
    opt_1.Norders = 7            # 分离后的总级次数：0，±2，(±1,±1) 3D-MP=7
    opt_1.Nangles = 3            # 条纹方向数
    opt_1.nc = opt_1.Nangles * opt_1.Norders
    opt_1.nz = 8
    opt_1.nx = 462
    opt_1.ny = 462
    opt_1.sequence = 55          # 15+15 模式
    opt_1.faiXY = 2 / 5          # XY 横向相移间距
    opt_1.faiZ = 0.52            # Z 轴向相移间距
    opt_1.order7 = [0, 1, 2, 3, 4, 0, 2]  # 52(3×7) [2/5 π] 模式级次
    opt_1.order5 = [0, 1, 2, 3, 4]        # c15+15 [2/5 π] 模式级次

    # 像素尺寸
    opt_1.dx = 60                # 横向像素尺寸 (nm)
    opt_1.dz = 193.8             # 轴向像素尺寸 (nm)

    # 切趾函数参数
    opt_1.Apoz = 830             # 切趾函数的轴向范围
    opt_1.fcxs = 1.2             # 切趾函数轴向范围参数 1
    opt_1.plongxs = 1.2          # 切趾函数轴向范围参数 2

    opt_1.W = [1e-4]             # Wiener 常数

    return opt_1


#=== '设定运行参数' ===#
def define_run_parameter():
    """定义重建运行参数的完整字典。

    包括 OTF 加载方式、参数加载标志、陷波参数、重建阶次等。

    Returns
    -------
    run_parameter : dict
        运行参数字典。
    """
    run_parameter = dict(
        createOTF=0,        # 0: 加载 OTF   1: 生成 OTF
        loadflag=0,         # 0: 重新计算参数并保存文件
                            # 1: 加载全部参数
                            # 2: 仅加载波矢 P，计算调制深度和相位并保存
                            # 3: 仅加载波矢 P，计算调制深度和相位不保存
                            # 4: [0 或 3]
                            # 5: [0 或 1]
        just_cfai=0,        # 1: 仅估计参数    0: 重建图像

        fanwei=20,          # 计算波矢的搜索范围（通常用 20）

        pzzzs=[0],          # 理论 pz 长度
        pzzz_range=0,       # pz 搜索范围

        # ---- 陷波参数 ----
        notch=[0],          # 0: 关闭一/二级陷波   1: 开启一/二级陷波
                            # 注：此参数不控制零级陷波
        # 零级陷波
        notch0ths=[0.6],    # 零级陷波抑制强度 (0-1)
        attFWHM0s=[1.5],    # 零级陷波宽度
        # 二级陷波
        attStrFZs=[0.8],    # 二级陷波抑制强度 (0-1)
        attFWHMFZs=[1.5],   # 二级陷波宽度
        # 一级陷波
        attStrs=[0.8],      # 一级陷波抑制强度 (0-1)
        attFWHMs=[1.5],     # 一级陷波宽度
        notch1st_pangs=[1], # 一级旁瓣参数（通常为 1）

        directions=[[0, 1, 2]],          # 重建方向
        orderForRe=[6],                  # 重建阶次：0=零级 1=±1级 2=±2级 3=0±1 4=0±2 5=±1±2 6=全部
        Method_c=[5],                    # 调制深度消除方法（5: 默认）
        Msum_maskMove=1,                 # Msum 掩膜：1=生成（默认） 2=移动

        joint_deconvolution=1,           # 联合反卷积：0=关闭  1=开启
        joints=0,                        # 联合反卷积作用的阶次：0=(0,2阶)  1=(2阶)
        remove2=1,                       # 移除二阶相位
        Dr_sub="01",                     # 重建子文件标识

        pad_coeff=0,                     # Z 填充系数

        # 文件保存
        save=0,                          # 保存中间文件
        fast=0,                          # 快速模式
        chazhi=0,                        # 是否执行自动轴向插值

        XZ_save=0,
        YZ_save=0,

        piancha=0,                       # 面参数估计时的移动量
        flagV=1,                         # 是否执行自动轴向插值
        pg=0,                            # 估计时的参数尺寸：0 表示自动使用 opt.pxy
    )
    return run_parameter


#=== '设置文件路径' ===#
def Get_path(run_parameter, para=''):
    """设置输入数据和 OTF 的文件路径。

    自动根据本文件所在位置解析 OTF 目录的绝对路径，
    避免因当前工作目录不同导致 OTF 找不到。

    Parameters
    ----------
    run_parameter : dict
        运行参数字典。
    para : dict
        含 ``data_path`` 键的参数字典。

    Returns
    -------
    savepath0 : str
        数据根目录路径。
    OTFone : str
        OTF 目录的绝对路径。
    run_parameter : dict
        更新后的运行参数。
    """
    # OTF 目录 = 本文件所在目录的上级目录 (MP-main/) / OTF 或 OTF_561
    project_root = Path(__file__).resolve().parent.parent
    OTFone = str(project_root / 'OTF')
    run_parameter['data_path'] = para['data_path']
    run_parameter['OTFname'] = OTFone
    savepath0 = para['data_path']
    return savepath0, OTFone, run_parameter


#=== '启动重建（支持 488/561 通道）' ===#
def Run_recon(para, w, Channel=488):
    """初始化参数并启动 3D-MP-SIM 重建。

    根据通道选择不同的光学参数和数据子目录。

    Parameters
    ----------
    para : dict
        含 ``data_path`` 的参数字典。
    w : float
        Wiener 正则化常数。
    Channel : int
        激发波长通道：488 或 561。

    Raises
    ------
    ValueError
        若通道不是 488 或 561。
    """
    # 初始化光学和运行参数
    opt = opt_opical_parameter1()       # 488 油镜
    opt = opt_RUN1_parameter1(opt)
    run_parameter = define_run_parameter()
    savepath0, OTFone, run_parameter = Get_path(run_parameter, para)

    # 通道相关设置
    if Channel == 561:
        opt.Wzm = 561
        opt.Wjs = 600
        opt.lamdex = 561
        opt.lamdem = 600
        project_root = Path(__file__).resolve().parent.parent
        OTFone = str(project_root / 'OTF_561')
        pz = 2.6
        Dr_sub_1 = "01-561-AVG"
        Dr_sub_2 = "01-561"
        W_order = "561-AVG-P"
    elif Channel == 488:
        pz = 3
        Dr_sub_1 = "01-488"
        Dr_sub_2 = "01-488"
        W_order = "488-P"
    else:
        raise ValueError('通道只能是 488 或 561')

    # 通用运行设置
    run_parameter['movex'] = 0
    run_parameter['movey'] = 0
    run_parameter['movex_long'] = 462
    run_parameter['movey_long'] = 462
    run_parameter['use_mask'] = 1
    run_parameter['meas'] = 2

    opt.nz = 8
    opt.nx = 462
    opt.ny = 462
    opt.W = [w]
    pz8 = pz                  # 轴向层数太少导致互相关不准，使用理论值
    opt.Zpadding = 4          # Z 填充，避免循环卷积导致首尾层混叠
    run_parameter['DEBUG'] = dict(save=1, loa=1, sep=1, est=1, mov=1, wie=1)

    # ================================================================
    # 1. 预平均数据（需要 Z 填充时先计算参数）
    # ================================================================
    # run_parameter['Dr_sub'] = Dr_sub_1
    # run_parameter['W_order'] = W_order
    # run_parameter['loadflag'] = 0
    # run_parameter['pzzz'] = pz8 / 8 * (opt.nz + 2 * opt.Zpadding)
    # run_parameter['just_cfai'] = 1
    # _RUN1.main(opt, run_parameter, savepath0, OTFone)

    # ================================================================
    # 2. 正式重建
    # ================================================================
    run_parameter['Dr_sub'] = Dr_sub_2           # 单时间点数据
    run_parameter['W_order'] = W_order           # 参数文件目录

    run_parameter['notch'] = [0]
    run_parameter['notch0ths'] = [0.6]
    run_parameter['loadflag'] = 5                # 加载已有参数
    run_parameter['pzzz'] = pz8 / 8 * (opt.nz + 2 * opt.Zpadding)
    run_parameter['just_cfai'] = 0               # 执行重建

    _RUN1.main(opt, run_parameter, savepath0, OTFone)
