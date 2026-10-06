"""顶层重建驱动器：遍历所有 'raw data' 子文件夹并执行重建。"""
import Utils as _U
from pathlib import Path
import Main_recon_MP as _MMP


#=== '遍历原始数据子文件夹执行重建' ===#
def main(opt, run_parameter, savepath0, OTFone, FANWEI=[1]):
    """遍历指定路径下所有含 'raw data' 的子文件夹，逐个执行 3D-MP-SIM 重建。

    Parameters
    ----------
    opt : Namespace
        光学和重建参数对象。
    run_parameter : dict
        运行参数字典。
    savepath0 : str or Path
        原始数据的根目录路径。
    OTFone : str or Path
        OTF 文件目录路径。
    FANWEI : list
        范围参数（接口占位）。
    """
    isdebug = run_parameter['DEBUG']

    # 版本与测量模式设置
    opt.version = 'V0.1'
    run_parameter['ver'] = opt.version

    if run_parameter['meas'] == 1:
        opt.Apoz = 600
        opt.fcxs = 1.7
        opt.plongxs = 1.7
        run_parameter['note'] = 'ma60'
    elif run_parameter['meas'] == 2:
        opt.Apoz = 830
        opt.fcxs = 1.2
        opt.plongxs = 1.2
        run_parameter['note'] = ''
    elif run_parameter['meas'] == 0:
        opt.Apoz = 750
        opt.fcxs = 1.2
        opt.plongxs = 1.2
        run_parameter['note'] = 'simu'

    data_name = str(Path(str(savepath0)).name)
    run_parameter['data_name'] = data_name
    print(data_name)

    for i, ldr_i in enumerate(Path(str(savepath0)).iterdir(), start=1):
        dir_name = ldr_i.parts[-1]

        if ldr_i.is_dir() != 1:
            print('Loop-FILE-skip 3', dir_name)
            continue
        if 'raw data' not in dir_name:
            print('Loop-FILE-skip 4', dir_name)
            continue

        savepath1 = ldr_i / 'Dr' / run_parameter['Dr_sub']
        savepath2 = OTFone
        savepath3 = ldr_i / 'parameter' / run_parameter['W_order']
        if not savepath3.parent.exists():
            savepath3.parent.mkdir()
        if not savepath3.exists():
            savepath3.mkdir()

        print('Loop-FILE-Process ', dir_name)
        run_parameter['dir_name'] = dir_name

        _MMP.main(opt, savepath1, savepath2, savepath3, run_parameter,
                  isdebug=isdebug)
