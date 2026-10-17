# fairSIM 参数估计最小实操

从项目根目录运行，需要 Node 与 JDK 11+：

```sh
node scripts/fairsim-parameter-estimation/run.cjs
```

该脚本直接编译本地固定提交 `711afd12cb8c4fd4207bbca7ee7610c5aed4f732` 的 fairSIM 参数估计源码。FFT 使用项目已有的 `tests/fairsim-reference/JTransformsConnector.java` 适配器；没有构建或启动完整的 ImageJ 插件，也没有改写估计算法。

## 怎样读代码

1. `sample()` 生成周期边界下的非负荧光微球样品。
2. `capture()` 用三个方向、每方向三个等间隔相位照明样品，再乘 OTF，得到九帧相机图像的傅里叶变换。
3. 新建 `SimParam`，仅提供成像配置与 OTF，不提供真实波矢、相位偏移或调制度。
4. 调用 `SimAlgorithm.estimateParameters(param, inFFT, 1, .3, null, 0, null)`，运行临时分离、粗定位、亚像素搜索与比例估计。
5. 用 `px(1)`、`py(1)`、`getPhaOff()`、`getRawModulations()` 读结果，并与生成数据时使用的参数比较。

估计器实际只收到 `param` 与九帧数据；已知真值仅用于数据生成和误差核对。

## 本例的数学模型

令数组行坐标向下，照明频率用 FFT 像素表示：

$$
D_{d,j}=\mathcal F^{-1}\left\{H\,\mathcal F\left[S(x,y)\left(1+\mu\cos\left(\frac{2\pi}{N}(k_{x,d}x+k_{y,d}y)+\frac{2\pi j}{3}+\phi_{\Delta,d}\right)\right)\right]\right\}.
$$

此例直接保留右侧逆 FFT 之前的量，因为 `estimateParameters` 接收的就是 `inFFT`。OTF 为人为设置的理想圆孔模型，截止频率为 1 cycle/µm；图像为 64×64、像素尺寸为 0.3125 µm，故截止半径为 20 个 FFT 像素。波矢选为整数，从而与周期边界相容；每方向的调制度均为 0.8。

fairSIM 使用向上的 y 轴，所以它读出的 `py(1)` 与生成器数组坐标的 y 分量符号相反。照明相位的原点固定在数组左上角；误差用模 2π 的差计算。

## 2026-10-13 数值核对

| 方向 | 真值波矢，fairSIM 坐标 | 估计波矢 | 真值相位 / rad | 估计相位 / rad | 估计调制度 |
|---|---|---|---|---|---|
| 0 | (12, −5) | (12.011111, −5.011111) | 0.7 | 0.627842 | 0.799809 |
| 1 | (−4, −13) | (−4.011111, −12.988889) | −0.4 | −0.328196 | 0.786412 |
| 2 | (9, 10) | (9.011111, 9.988889) | 1.1 | 1.027845 | 0.781825 |

最大波矢误差约 0.015713 个频率像素，最大相位误差约 0.072158 rad，最大调制度绝对误差约 0.018175。末位数可能受浮点运算影响。

这是无噪声且 OTF 匹配的 API 实验，不能当作真实样本上的性能结论。原版 `fitPeak` 三轮搜索每轮为 10×10 个候选点，半宽为 2.5、0.5、0.1 个频率像素；最后一轮每轴网格间隔为 0.2/9，且偶数个点不包含中心。有限位移精度会影响相位与幅度，公共区域掩膜也采用部分整数索引近似；因此理想参数关系不意味着实际输出逐项精确。示例中的误差断言仅用于检查这个固定案例是否明显异常。

## 换成真实数据

保留 `SimParam.create` 与估计器调用，把 `capture()` 换为读取真实相机帧：先核对帧顺序、扣除测得的背景、做边缘窗，再对每帧正 FFT。`inFFT[方向][相位]` 必须正确对应采集顺序。背景和窗口大小应根据数据选择，不能直接抄作者示例中的 200 与 15。

对两束二维模型，`nrBands=2`，产生零级、正一级、负一级三个分量，通常每方向三帧，`fitBand=1`。作者 `StepByStep.java` 的默认示例为 `nrBands=3`、三方向五相位共十五帧；它不是本例的九帧配置。

`fitExclude=.3` 表示粗找峰时排除截止半径的 30% 以内；这不是丢掉相机数据，也不是最终公共区域的 OTF 阈值。`null, 0, null` 关闭中间图显示和计时记录。

如果相位步进并非等间隔，可在波矢估计后调用 `estimateAbsolutePhases(param, inFFT, null)` 估计各帧相位。该函数要求波矢已足够准确；它不会联合求解所有未知参数，也不会自动重新估计调制度。

比较调制度时同时检查 `getRawModulations()` 与 `getModulations()`：当前固定源码对小于 0.4 或大于 1.1 的数值采用 0.65 的回退值，保存的估计值与重建采用值可能不同。

## 来源

- [fairSIM 2016 主文](https://www.nature.com/articles/ncomms10980) 与本地补充材料的 Supplementary Note 1，PDF 第 10—11 页。
- `Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/SimAlgorithm.java`：`estimateParameters` 与 `estimateAbsolutePhases`。
- 同目录 `Correlation.java`：`fitPeak`、`commonRegion`、`getPeak`。
- 同目录 `BandSeparation.java`：临时分离采用旁带系数 0.5。
- 同目录 `SimParam.java`：参数单位、相位、调制度回退。
- [Wicker 2013，非迭代逐帧相位估计](https://doi.org/10.1364/OE.21.024692)。不要与同年另一篇 *Phase optimisation for structured illumination microscopy*，DOI `10.1364/OE.21.002032` 混为同一方法。
