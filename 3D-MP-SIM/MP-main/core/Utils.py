"""3D-MP-SIM 重建的工具函数集

整合了 FFT 辅助函数、数组维度变换/填充/裁剪、形态学运算、
插值以及 tif 文件读写等全流水线共用的基础功能。
"""
import math
import re
import gc

import numpy as np
import torch
import cv2
from pathlib import Path
from tifffile import imread, imwrite, TiffWriter


# ===========================================================================
# FFT 辅助函数 (numpy + torch，均包含 fftshift)
# ===========================================================================

#=== 'Numpy 前向 FFT（含 fftshift）' ===#
def fftn(data, axes=None):
    """numpy 前向 FFT，自动执行 fftshift。

    Parameters
    ----------
    data : np.ndarray
        输入数组（实/复数）。
    axes : tuple or None
        进行 FFT 的轴，None 表示全部轴。

    Returns
    -------
    np.ndarray
        fftshift 后的频域数据。
    """
    return np.fft.fftshift(np.fft.fftn(data, axes=axes))


#=== 'Numpy 逆向 FFT（含 ifftshift）' ===#
def ifftn(data, axes=None):
    """numpy 逆向 FFT，自动执行 ifftshift。

    Parameters
    ----------
    data : np.ndarray
        频域输入数组。
    axes : tuple or None
        进行 IFFT 的轴。

    Returns
    -------
    np.ndarray
        IFFT 后的空域数据。
    """
    return np.fft.ifftn(np.fft.ifftshift(data), axes=axes)


#=== 'Numpy fftshift' ===#
def fftshift(data):
    """numpy 的 fftshift 封装。

    Parameters
    ----------
    data : np.ndarray
        输入频域数组。

    Returns
    -------
    np.ndarray
        零频移到中心后的数组。
    """
    return np.fft.fftshift(data)


#=== 'Torch 前向 FFT（含 fftshift）' ===#
def tfftn(data, axes=None):
    """torch 前向 FFT，自动执行 fftshift。

    Parameters
    ----------
    data : torch.Tensor
        输入张量。
    axes : tuple or None
        进行 FFT 的维度。

    Returns
    -------
    torch.Tensor
        fftshift 后的频域张量。
    """
    return torch.fft.fftshift(torch.fft.fftn(data, dim=axes))


#=== 'Torch 逆向 FFT（含 ifftshift）' ===#
def tifftn(data, axes=None):
    """torch 逆向 FFT，自动执行 ifftshift。

    Parameters
    ----------
    data : torch.Tensor
        频域输入张量。
    axes : tuple or None
        进行 IFFT 的维度。

    Returns
    -------
    torch.Tensor
        IFFT 后的空域张量。
    """
    return torch.fft.ifftn(torch.fft.ifftshift(data, dim=axes), dim=axes)


#=== '对数可视化' ===#
def visual(ik):
    """对数幅度可视化辅助函数。

    Parameters
    ----------
    ik : np.ndarray
        频域复数数组。

    Returns
    -------
    np.ndarray
        log(|ik| + 1)，便于显示动态范围。
    """
    return np.log(np.abs(ik) + 1)


# ===========================================================================
# Tensor ↔ numpy 转换
# ===========================================================================

#=== 'numpy 转 torch 张量' ===#
def ToTensor(arr):
    """安全地将 numpy 数组转为 torch 张量。

    若输入已是 torch.Tensor 则原样返回。

    Parameters
    ----------
    arr : np.ndarray or torch.Tensor
        输入数组。

    Returns
    -------
    torch.Tensor
    """
    if isinstance(arr, np.ndarray):
        return torch.from_numpy(arr)
    return arr


#=== 'torch 张量转 numpy' ===#
def ToNumpy(tensor):
    """安全地将 torch 张量转为 numpy 数组。

    若输入已是 np.ndarray 则原样返回。

    Parameters
    ----------
    tensor : torch.Tensor or np.ndarray
        输入张量/数组。

    Returns
    -------
    np.ndarray
    """
    if isinstance(tensor, torch.Tensor):
        return tensor.detach().cpu().numpy()
    return tensor


# ===========================================================================
# 维度重塑
# ===========================================================================

#=== '通用维度调整' ===#
def image_reshape(image, dim=4):
    """将数组调整为指定的维度数。

    多余的起始维度合并到第 0 轴，不足的维度在前补 1。

    Parameters
    ----------
    image : np.ndarray
        输入数组，任意维度。
    dim : int
        目标维度数，默认 4。

    Returns
    -------
    np.ndarray
        调整维度后的数组。
    """
    cur_dim = len(image.shape)
    if cur_dim == dim:
        return image
    while cur_dim < dim:
        image = np.expand_dims(image, axis=0)
        cur_dim = len(image.shape)
    while cur_dim > dim:
        s = list(image.shape)
        image = image.reshape((s[0] * s[1],) + tuple(s[2:]))
        cur_dim = len(image.shape)
    return image


# ===========================================================================
# 填充 / 裁剪
# ===========================================================================

#=== '计算中心填充所需的左右边距' ===#
def pad_or_cut_cal(target_length, raw_length):
    """计算中心填充到目标长度所需的左右边距。

    Parameters
    ----------
    target_length : int
        目标长度。
    raw_length : int
        原始长度。

    Returns
    -------
    left, right : int
        左右各自需要填充的像素数。
    """
    left = right = 0
    if target_length > raw_length:
        diff = target_length - raw_length
        left = right = diff // 2
        if diff % 2 == 1:
            left += 1
    return int(left), int(right)


#=== '中心裁剪' ===#
def crop(image, scale=0.5, nx=0, ny=0, nz=0, biasx=0, biasy=0):
    """对 3D/4D 数组执行中心裁剪。

    Parameters
    ----------
    image : np.ndarray
        输入数组，会被调整为 4D。
    scale : float
        裁剪比例，仅在未显式指定 nx/ny 时生效。
    nx, ny, nz : int
        裁剪后的 x, y, z 尺寸，0 表示不裁剪该维度。
    biasx, biasy : int
        裁剪起始位置的偏移量（像素）。

    Returns
    -------
    np.ndarray
        裁剪后的数组。
    """
    image = image_reshape(image, dim=4)
    _, raw_nz, raw_nx, raw_ny = image.shape
    if scale == 0.5 and nx == 0 and ny == 0:
        nx = raw_nx // 2
        ny = raw_ny // 2
    nz_s = int(np.ceil((raw_nz - nz) / 2))
    nx_s = int(np.ceil((raw_nx - nx) / 2))
    ny_s = int(np.ceil((raw_ny - ny) / 2))
    return image[:, nz_s:nz_s + nz, nx_s + biasx:nx_s + nx + biasx,
                 ny_s + biasy:ny_s + ny + biasy]


#=== '中心填充或裁剪' ===#
def pad_or_cut(image, x=512, y=512, z=1, mode='constant', biasx=0, biasy=0):
    """对数组执行中心零填充或中心裁剪，统一到 ``(z, x, y)`` 尺寸。

    支持 numpy 和 torch 输入，自动处理类型转换。

    Parameters
    ----------
    image : np.ndarray or torch.Tensor
        输入数组。
    x, y, z : int
        目标尺寸。
    mode : str
        填充模式，默认 'constant'（零填充）。
    biasx, biasy : int
        裁剪偏移。

    Returns
    -------
    np.ndarray or torch.Tensor
        处理后的数组，类型与输入一致。
    """
    is_torch = isinstance(image, torch.Tensor)
    dim_before = len(image.shape)

    arr = image.numpy() if is_torch else image
    arr = image_reshape(arr, dim=4)
    raw_nz, raw_nx, raw_ny = arr.shape[1:]

    nz_l, nz_r = pad_or_cut_cal(z, raw_nz)
    nx_l, nx_r = pad_or_cut_cal(x, raw_nx)
    ny_l, ny_r = pad_or_cut_cal(y, raw_ny)

    arr = np.pad(arr, ((0, 0), (nz_l, nz_r), (nx_l, nx_r), (ny_l, ny_r)),
                 mode=mode)

    if x < raw_nx or y < raw_ny or z < raw_nz:
        arr = crop(arr, nx=x, ny=y, nz=z, biasx=biasx, biasy=biasy)

    arr = image_reshape(arr, dim=dim_before)
    return torch.from_numpy(arr) if is_torch else arr


# ===========================================================================
# 坐标网格
# ===========================================================================

#=== '3D 稀疏网格 (z, x, y)' ===#
def meshgrid(opt, xy_expand=1, z_expand=1, index='ij'):
    """生成重建区域的稀疏网格坐标 (z, x, y)。

    Parameters
    ----------
    opt : Namespace
        包含 ``nx``, ``ny``, ``nz_re`` 等参数。
    xy_expand : int
        XY 方向扩展倍数。
    z_expand : int
        Z 方向扩展倍数。
    index : str
        meshgrid 的 indexing 参数，默认 'ij'。

    Returns
    -------
    zv, xv, yv : np.ndarray
        三个稀疏网格坐标数组。
    """
    nx = opt.nx * xy_expand
    ny = opt.ny * xy_expand
    nz = opt.nz_re
    x = np.arange(np.ceil(-nx / 2), np.ceil(nx / 2))
    y = np.arange(np.ceil(-ny / 2), np.ceil(ny / 2))
    z = np.arange(np.ceil(-nz / 2), np.ceil(nz / 2))
    return np.meshgrid(z, x, y, indexing=index, sparse=True)


#=== '2D 稀疏网格 (x, y)' ===#
def meshgridxy(opt, xy_expand=1, z_expand=1, index='ij'):
    """生成重建区域的 2D 稀疏网格 (x, y)。

    Parameters
    ----------
    opt : Namespace
        含 ``nx``, ``ny`` 等参数。
    xy_expand : int
        XY 扩展倍数。
    index : str
        indexing 参数。

    Returns
    -------
    xv, yv : np.ndarray
        两个稀疏网格坐标数组。
    """
    nx = opt.nx * xy_expand
    ny = opt.ny * xy_expand
    x = np.arange(np.ceil(-nx / 2), np.ceil(nx / 2))
    y = np.arange(np.ceil(-ny / 2), np.ceil(ny / 2))
    return np.meshgrid(x, y, indexing=index, sparse=True)


#=== '3D 稀疏网格 (自定尺寸)' ===#
def meshgridxy_self(nx, ny, nz=1, index='ij'):
    """生成自定尺寸的 3D 稀疏网格。

    Parameters
    ----------
    nx, ny : int
        X, Y 方向点数。
    nz : int
        Z 方向点数。
    index : str
        indexing 参数。

    Returns
    -------
    zv, xv, yv : np.ndarray
        稀疏网格坐标。
    """
    x = np.arange(np.ceil(-nx / 2), np.ceil(nx / 2))
    y = np.arange(np.ceil(-ny / 2), np.ceil(ny / 2))
    z = np.arange(np.ceil(-nz / 2), np.ceil(nz / 2))
    return np.meshgrid(z, x, y, indexing=index, sparse=True)


#=== '频移相位矩阵' ===#
def shiftmat(opt, kx=0, ky=0, kz=0):
    """生成频谱移动所需的相位因子矩阵。

    Parameters
    ----------
    opt : Namespace
        含 ``xv``, ``yv``, ``zv`` 网格属性。
    kx, ky, kz : float
        各方向的频移量（归一化频率）。

    Returns
    -------
    np.ndarray
        exp(2πi·(kx·xv + ky·yv + kz·zv)) 复相位矩阵。
    """
    return np.exp(2j * np.pi * (kx * opt.xv + ky * opt.yv)) * \
        np.exp(2j * np.pi * kz * opt.zv)


# ===========================================================================
# 插值 (torch 实现，支持复数)
# ===========================================================================

#=== '3D 插值 (支持复数)' ===#
def Interpolate(image, nx, ny, nz, strt='trilinear'):
    """使用 torch 对图像执行 3D 插值，支持复数数据。

    复数数据通过分别对实部和虚部插值实现。

    Parameters
    ----------
    image : np.ndarray
        输入数组。
    nx, ny, nz : int
        插值后的目标尺寸。
    strt : str
        插值模式，'trilinear' 或 'nearest' 等。

    Returns
    -------
    np.ndarray
        插值后的数组。
    """
    before_dim = len(image.shape)
    arr = image_reshape(image, dim=5)
    t = ToTensor(arr)
    kw = dict(size=[nz, nx, ny], mode=strt, align_corners=False)
    if not torch.is_complex(t):
        out = torch.nn.functional.interpolate(t, **kw)
    else:
        out = torch.nn.functional.interpolate(t.real, **kw) + \
            1j * torch.nn.functional.interpolate(t.imag, **kw)
    return image_reshape(ToNumpy(out), dim=before_dim)


# ===========================================================================
# 归一化
# ===========================================================================

#=== '幅值归一化' ===#
def normalize(data):
    """将数据除以其最大绝对值实现归一化。

    支持 torch.Tensor、np.ndarray 和标量复数。

    Parameters
    ----------
    data : torch.Tensor, np.ndarray or complex
        输入数据。

    Returns
    -------
    归一化后的数据，类型与输入一致。
    """
    if isinstance(data, torch.Tensor):
        return data / torch.max(torch.abs(data))
    if isinstance(data, np.ndarray):
        return data / np.max(np.abs(data))
    mag = abs(data)
    return data / mag


#=== '垃圾回收释放显存' ===#
def release():
    """手动触发 Python 垃圾回收，释放不再使用的 GPU/CPU 内存。"""
    gc.collect()


#=== '跨平台设备缓存释放' ===#
def release_device_cache(device):
    """根据设备类型释放 GPU 缓存（CUDA / MPS / CPU）。

    Parameters
    ----------
    device : torch.device or str
        计算设备。
    """
    device_str = str(device)
    if 'cuda' in device_str:
        torch.cuda.empty_cache()
    elif 'mps' in device_str:
        torch.mps.empty_cache()
    gc.collect()


#=== 'Richardson-Lucy 反卷积桩' ===#
def RL_deconvolve(ck, otf, fre=True, iterations=10):
    """Richardson-Lucy 反卷积的接口占位函数。

    原代码库中参数估计的 RL 分支引用了此函数，但从未实际实现。
    此处声明以保持接口完整性；若被调用则抛出 NotImplementedError。

    Raises
    ------
    NotImplementedError
        始终抛出。
    """
    raise NotImplementedError(
        'RL_deconvolve 未实现；请在参数估计调用中保持 RL=False。')


#=== '数字补零格式化' ===#
def fill0(data, num=1):
    """将数字转为定长字符串，不足位补零。

    Parameters
    ----------
    data : int or str
        待格式化的数字。
    num : int
        目标长度。

    Returns
    -------
    str
        补零后的字符串。
    """
    if data > 1:
        return str(data).zfill(num)
    return str(data).ljust(num, '0')


# ===========================================================================
# 形态学操作 (向量化圆形结构元素)
# ===========================================================================

#=== '生成圆形结构元素' ===#
def _circular_kernel(size):
    """构建指定尺寸的圆形结构元素。

    Parameters
    ----------
    size : int
        结构元素尺寸（正方形边长）。为 0 时返回 None。

    Returns
    -------
    np.ndarray or None
        圆形二值核，(size, size)。
    """
    if size == 0:
        return None
    r = size // 2
    yy, xx = np.ogrid[:size, :size]
    kernel = (np.sqrt((xx - r) ** 2 + (yy - r) ** 2) <= r).astype(np.uint8)
    return kernel


#=== '圆形腐蚀 (2D)' ===#
def Cir_Erode(data, size=3):
    """对 2D 数据执行圆形结构元素的腐蚀操作。

    Parameters
    ----------
    data : np.ndarray
        2D 输入数据。
    size : int
        结构元素尺寸，默认为 3。

    Returns
    -------
    np.ndarray
        腐蚀后的数据。
    """
    if size == 0:
        return data
    kernel = _circular_kernel(size)
    data_erode = cv2.erode(data, kernel)
    if np.mean(data) != 0 and np.mean(data_erode) == 0:
        print('3D 腐蚀过度，需要减小结构元素尺寸。')
    return data_erode


#=== '圆形膨胀 (2D)' ===#
def Cir_dilate(data, size=3):
    """对 2D 数据执行圆形结构元素的膨胀操作。

    Parameters
    ----------
    data : np.ndarray
        2D 输入数据。
    size : int
        结构元素尺寸。

    Returns
    -------
    np.ndarray
        膨胀后的数据。
    """
    if size == 0:
        return data
    return cv2.dilate(data, _circular_kernel(size))


#=== '圆形腐蚀 (逐层 3D)' ===#
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

    Raises
    ------
    ValueError
        若腐蚀过度（几乎所有层均值变为 0）。
    """
    data2 = image_reshape(data, dim=3)
    nz = data2.shape[0]
    num_zero_layers = 0
    for i in range(nz):
        data2[i] = Cir_Erode(data[i], size=size)
        if np.mean(data[i]) != 0 and np.mean(data2[i]) == 0:
            num_zero_layers += 1
    if num_zero_layers >= nz - 2:
        save_tif(r'查看腐蚀之后data2.tif', data2)
        raise ValueError('3D 腐蚀过度，请减小结构元素尺寸。')
    return data2


#=== '圆形膨胀 (逐层 3D)' ===#
def Cir_dilate_3D(data, size=3):
    """对 3D 数据逐层执行圆形膨胀。

    Parameters
    ----------
    data : np.ndarray
        3D 输入数据。
    size : int
        结构元素尺寸。

    Returns
    -------
    np.ndarray
        膨胀后的 3D 数据。
    """
    data2 = image_reshape(data, dim=3)
    for i in range(data2.shape[0]):
        data2[i] = Cir_dilate(data[i], size=size)
    return data2


# ===========================================================================
# 翻转操作
# ===========================================================================

#=== '180° 翻转 (左右或上下)' ===#
def flip180(arr, direction):
    """对 2D/3D 数组执行含 Z 反转的 180° 翻转。

    Parameters
    ----------
    arr : np.ndarray
        输入数组（会被调整为 3D）。
    direction : str
        ``'lr'`` 为左右翻转 + Z 反转，``'ud'`` 为上下翻转 + Z 反转。

    Returns
    -------
    np.ndarray
        翻转后的数组。
    """
    arr3D = image_reshape(arr, dim=3)
    nz = arr3D.shape[0]
    out = np.zeros_like(arr3D)
    if direction == 'lr':
        for i in range(nz):
            out[-i - 1] = np.fliplr(arr3D[i])
    elif direction == 'ud':
        for i in range(nz):
            out[-i - 1] = np.flipud(arr3D[i])
    return out


#=== '从文本中提取日期' ===#
def find_dates(text):
    """从文本中提取 YYYYMMDD 格式的日期字符串。

    Parameters
    ----------
    text : str
        待搜索的文本。

    Returns
    -------
    list of str
        匹配到的日期字符串列表。
    """
    pattern = r"(\d{4})(\d{2})(\d{2})"
    return [f"{y}{m}{d}" for y, m, d in re.findall(pattern, text)]


# ===========================================================================
# Tif / txt 文件读写
# ===========================================================================

#=== '保存 tif（占位函数）' ===#
def save_tif(filename, data):
    """tif 保存占位函数，当前版本为空操作。

    保留以维持 API 兼容性。
    """
    return


#=== '保存 tif v21（占位函数）' ===#
def save_tif_v21(filename, data, run_parameter, sub_filename='',
                 datatype=np.float32):
    """tif v21 保存占位函数，当前版本为空操作。

    保留以维持 API 兼容性。
    """
    return


#=== '保存 txt（占位函数）' ===#
def save_txt(filename, data):
    """txt 保存占位函数，当前版本为空操作。

    保留以维持 API 兼容性。
    """
    return


#=== '保存 ImageJ 超栈 tif' ===#
def save_hyperstack(path_filename, data, colormap=''):
    """将数据保存为 ImageJ 兼容的超栈 tif 文件。

    数据先归一化到 [0, 65535] 再保存为 uint16 格式。

    Parameters
    ----------
    path_filename : str
        保存路径。
    data : np.ndarray
        待保存的数据。
    colormap : str
        色彩映射表名（可选）。

    Returns
    -------
    int
        始终返回 0。
    """
    data = data / np.max(data) * 65535
    data = data.astype(np.uint16)
    imwrite(path_filename, data, imagej=True,
            metadata={'axes': 'TZYX', 'unit': 'um'})
    return 0


#=== '保存单张 tif（自动创建目录）' ===#
def save_tif_self(pathname, data):
    """将数据保存为单张 tif 文件，自动创建父目录。

    Parameters
    ----------
    pathname : str or Path
        保存路径。
    data : np.ndarray
        待保存的数据。
    """
    path = Path(str(pathname))
    parent_dir = path.parent
    if not parent_dir.exists():
        parent_dir.mkdir()
        print(f' 创建新文件夹：{parent_dir}')
    imwrite(path, data, photometric='minisblack')
    print(f"数据已成功保存至 ({path})")
    return


#=== '保存 ImageJ 兼容 tif（含元数据）' ===#
def save_tif_self3(path_data_dir, data, sub_filename='', subsub_filename='',
                   filename='', axes='ZYX', min_val=0, max_val=255):
    """将结果保存为 ImageJ 兼容的 tif 文件，支持多级子目录。

    Parameters
    ----------
    path_data_dir : str or Path
        数据输出的根目录。
    data : np.ndarray or torch.Tensor
        待保存的数据。
    sub_filename : str
        一级子目录名（可选）。
    subsub_filename : str
        二级子目录名（可选）。
    filename : str
        输出文件名。
    axes : str
        ImageJ 轴标签，如 'ZYX'、'TZYX'。
    min_val, max_val : float
        显示范围的最小/最大值。
    """
    if axes == 'ZYX':
        data = image_reshape(data, dim=3)
    try:
        path_data_dir = Path(path_data_dir)
    except Exception:
        pass
    if sub_filename != '':
        path_data_dir = path_data_dir / sub_filename
        if not path_data_dir.exists():
            path_data_dir.mkdir()
    if subsub_filename != '':
        path_data_dir = path_data_dir / subsub_filename
        if not path_data_dir.exists():
            path_data_dir.mkdir()
    savefile = path_data_dir / filename
    try:
        data = data.numpy()
    except Exception:
        pass
    with TiffWriter(savefile, imagej=True) as tif:
        tif.write(data.astype(np.float32),
                  metadata={'axes': axes, 'min': min_val, 'max': max_val})
    return


#=== '构建带版本号的保存路径' ===#
def save_path(filename, run_parameter, sub_filename=''):
    """根据运行参数构建标准化的输出路径。

    路径结构：``dataOut/<data_name>/<dir_name>-<ver>/<sub>/<filename>``

    Parameters
    ----------
    filename : str
        文件名。
    run_parameter : dict
        运行参数字典，需含 ``data_name``, ``dir_name``, ``ver``。
    sub_filename : str
        可选的子目录名。

    Returns
    -------
    Path
        完整的保存路径。
    """
    path = Path.cwd() / 'dataOut'
    if not path.exists():
        path.mkdir()
    path_data = path / run_parameter['data_name']
    if not path_data.exists():
        path_data.mkdir()
    path_data_dir = path_data / (run_parameter['dir_name'] + "-" +
                                 run_parameter['ver'])
    if not path_data_dir.exists():
        path_data_dir.mkdir()
    if sub_filename != '':
        path_data_dir = path_data_dir / sub_filename
        if not path_data_dir.exists():
            path_data_dir.mkdir()
    return path_data_dir / filename


#=== '构建 v22 格式的输出目录路径' ===#
def save_tif_v22_path(run_parameter):
    """构建 v22 版本的输出目录路径。

    路径结构：``dataOut/<data_name>_only/<dir_name>-<ver>/``

    Parameters
    ----------
    run_parameter : dict
        含 ``data_name``, ``dir_name``, ``ver`` 等。

    Returns
    -------
    Path
        输出目录路径。
    """
    path = Path.cwd() / 'dataOut'
    if not path.exists():
        path.mkdir()
    path_data = path / (run_parameter['data_name'] + "_only")
    if not path_data.exists():
        path_data.mkdir()
    path_data_dir = path_data / (run_parameter['dir_name'] + "-" +
                                 run_parameter['ver'])
    if not path_data_dir.exists():
        path_data_dir.mkdir()
    return path_data_dir
