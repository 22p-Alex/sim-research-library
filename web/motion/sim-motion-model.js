/* SIM motion study. Pure lesson data and a reversible, frame-rate-independent
 * playhead. Physics is read from the existing fairSIM-derived atlas core.
 * Demixing is one linear solve at each detector frequency.
 * Equations: Chen et al. (2023), doi:10.1038/s41377-023-01204-4, Eqs. 1–9.
 */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const A = node ? require('../atlas/sim-atlas-core.js') : root.SIMAtlas;
  const F = (node ? require('../shared/sim-band-formulas.js') : root.SIMBandFormulas).formulas;
  const orders = [0, 1, -1];
  const colors = ['#7ad5cd', '#b7a5eb', '#efb879'];
  const phaseLabels = ['0', '2π/3', '4π/3'];
  const demixScenes = [
    {
      chapter: '01 / 观测', label: '三帧观测', title: '一个方程不够，让同三个来源换权重再相加。',
      copy: '保留刚才的第一帧。样品与成像系统固定，只将条纹相位依次增加 2π/3，再拍两帧；三个来源不变，混合权重随相位改变。',
      equation: String.raw`$$d_j=\bigl\{s[1+m\cos(2\pi x/p+\phi_j)]\bigr\}*h$$`,
      note: '相移给同三个未知来源增加独立方程；重复同一相位不会改变混合关系。实际调制度与共同相位稍后由观测估计。',
    },
    {
      chapter: '01 / 观测', label: '固定频率 f', title: '固定同一个 f，读出三个方程的观测值。',
      copy: '三帧分别做 FFT，在同一个检测频率 f 读取 D₀、D₁、D₂。三个复数读数对应同三个来源；接下来回看这些来源从哪里来。',
      equation: String.raw`$$D_0(\mathbf f),\qquad D_1(\mathbf f),\qquad D_2(\mathbf f)$$`,
      note: 'f 表示任一选定的检测频率；三帧必须取同一位置。图像亮度表示 log(1 + 幅度)，实际解混使用完整复数。',
    },
    {
      chapter: '02 / 解混', label: '来源与矩阵', title: '回到叠加前的三份来源，再建立方程组。',
      copy: '沿用 05 的三份未加权移频频谱，经检测后记作 A₀、A₊₁、A₋₁。读取同一个 f，再让三幅图缩到各自的来源项旁，随方程整理进入 A 向量的对应行。',
      equation: F.observation,
      note: 'A 包含检测 OTF，照明系数 m/2 与相位因子留在 M 中。此处只建立符号关系；相位和调制度确定后，才能算出具体权重。',
    },
    {
      chapter: '02 / 解混', label: '求逆与权重', title: '先求出解法，权重中的参数还待确定。',
      copy: '两边左乘 M⁻¹，得到 A = UD，再逐项展开 U。本页等间隔三相位下，0 级权重为 1/3，旁带权重为带反向相位的 2/(3m)；每一行取出一个来源。',
      equation: String.raw`$$\mathbf A(\mathbf f)=U\mathbf D(\mathbf f),\qquad U=M^{-1}$$`,
      weightEquation: F.negativeExtraction,
      note: '闭式结果要求等间隔三相位且 m ≠ 0。此时得到含参数的解法；下一步回到照明模型，从观测确定实际参数。',
    },
    {
      chapter: '02 / 解混', label: '逐点解混', title: '同一行权重，作用于每一个检测频率。',
      copy: '三份观测 Dⱼ(f) 分别乘对应权重，再相加。对每个频率重复这一运算，并分别使用逆矩阵的三行，就得到三份频带。',
      equation: String.raw`$$A_\ell(\mathbf f)=\sum_{j=0}^{2}u_{\ell,j}D_j(\mathbf f),\qquad\ell\in\{0,+1,-1\}$$`,
      note: '使用刚才估计出的相位与调制度计算权重；频带图来自同一批观测的正式解混，仍含 OTF，也尚未归位。',
    },
    {
      chapter: '03 / 归位', label: '搬回原处', title: '带着 OTF，一起回到原处。',
      copy: '+1 级向左 8 格，−1 级向右 8 格。每个频带、OTF 轮廓和选中分量同步移动。',
      equation: String.raw`$$\mathbf q=\mathbf f-\ell\mathbf k,\qquad C_\ell(\mathbf q)=A_\ell(\mathbf q+\ell\mathbf k)$$`,
      note: '虚线是原检测支撑，彩色轮廓是归位后的 OTF 支撑。坐标改变，同一分量的复数值不变。',
    },
    {
      chapter: '04 / 回看', label: '找回高频', title: '高频找回来了，衰减还在。',
      copy: '橙色分量回到最初的样品高频 q，超出宽场截止。它仍带着检测位置 f 处的 OTF 衰减，后面才进入融合。',
      equation: String.raw`$$\mathbf q=\mathbf f+\mathbf k,\qquad C_{-1}(\mathbf q)=A_{-1}(\mathbf f)=H(\mathbf f)S(\mathbf q)$$`,
      note: '解混与归位完成。下一步加入其余方向，扩大覆盖，再对实际复数频带做融合。',
    },
  ];
  const beforeScenes = [
    { label: '样品与频谱', title: '细节，藏在高频里。',
      copy: '从同一张西门子星与点对出发。样品 Sample 经二维傅里叶变换得到频谱 Spectrum；橙色标记选中样品频率 q = (14, 0)。',
      equation: String.raw`$$S(\mathbf q)=\mathcal F\{s(\mathbf r)\},\qquad\mathbf q=(14,0)$$`,
      note: '模拟采集使用给定照明；重建从九帧观测估计波矢、相位与调制度。OTF 由已知成像模型提供。' },
    { label: '宽场的边界', title: '物镜，挡住了一部分细节。',
      copy: '同一次物镜成像：空域与 PSF 卷积，频域乘 OTF。超出截止 10 格的频率无法传递，橙色的 (14, 0) 就在圈外。',
      equation: String.raw`$$D_{\mathrm{WF}}(\mathbf q)=H(\mathbf q)S(\mathbf q),\qquad H(14,0)=0$$`,
      note: '' },
    { label: '条纹照明', title: '三次曝光，分别固定三个相位。',
      copy: '每次曝光中条纹保持固定，帧间切换到 0、2π/3、4π/3。选择下方相位，对照同一点 P 的激发光强与荧光变化。',
      equation: String.raw`$$e_j(x)=s(x)\left[1+m\cos\!\left(\frac{2\pi x}{p}+\phi_j\right)\right]$$`,
      note: 'm 表示调制度，p 表示条纹间距。图像按模拟照明生成；重建所用的实际照明参数稍后从观测中估计。' },
    { label: '频率编码', title: '一对高频，分别从两侧进入通带。',
      copy: 'q 标记样品中的原始频率，k 是照明条纹的频率向量。第 ℓ 级整体移动 ℓk，移频后的位置记作 f。',
      equation: String.raw`$$E_j(\mathbf f)=S(\mathbf f)+\frac m2e^{i\phi_j}S(\mathbf f-\mathbf k)+\frac m2e^{-i\phi_j}S(\mathbf f+\mathbf k)$$`,
      note: 'f 是发射频谱坐标，检测频谱沿用同一坐标；三个移频副本尚未加权，下一步再叠加。' },
    { label: '物镜检测', title: '同一次检测，空域变模糊，频域受衰减。',
      copy: '上排保留刚才混合的发射频谱，下排演示 PSF 卷积与 OTF 衰减。物镜改变传递强弱；在同一个 f，三个来源仍混在一个观测值里。',
      equation: String.raw`$$d_0=e_0*h,\qquad D_0(\mathbf f)=H(\mathbf f)E_0(\mathbf f)$$`,
      note: '一帧在每个 f 只给出一个复数方程，三个来源仍未知。下一步改变相位，让同三个来源以不同权重再次成像。' },
  ];
  const afterScenes = [
    { label: '三个方向', title: '汇合三个方向，各自使用估计参数。',
      copy: '回看同一批九帧：每个方向均独立完成临时分离、参数估计与正式解混。60.3° 来自方向 2 的估计波矢换算；三个方向都用各自估计结果归位。',
      equation: String.raw`$$\theta_d=\operatorname{atan2}(k_{y,d},k_{x,d}),\qquad\theta_2=\operatorname{atan2}(7,4)\approx60.3^\circ$$`,
      note: '方向标签读取估计结果，θ = atan2(kᵧ, kₓ) 表示波矢方向（条纹法线）。采集使用整数频率格，当前无噪声估计可回到这些位置。' },
    { label: '一个方向', title: '一个方向，先覆盖两侧。',
      copy: '先把方向 1 的三个归位 OTF 放在同一张样品频率坐标纸上。0 级居中，+1、−1 级扩展左右覆盖。',
      equation: String.raw`$$H_{d,\ell}(\mathbf q)=H(\mathbf q+\ell\mathbf k_d)$$`,
      note: '圆的位置表示可传递的几何范围。圈内信号仍受 OTF 衰减，边界不等于稳定恢复质量。' },
    { label: '多方向覆盖', title: '加入其余方向，补齐频率覆盖。',
      copy: '同一个样品频率 q，经不同频带到达不同检测位置 f。物镜在这些位置的传递强弱不同；搬回 q 只改坐标，原来乘上的 H 仍留在数据里。',
      equation: String.raw`$$C_{d,\ell}(\mathbf q)=H_{d,\ell}(\mathbf q)S(\mathbf q)$$`,
      note: '青色 q 是多带重叠例；橙色高频仅由方向 1 的 −1 级传递。圆只标通带范围，圈内的 H 也不等于 1。' },
    { label: 'OTF 加权', title: '已有一个 H，再乘共轭 H*。',
      copy: '对同一 q 的各条复数观测，分别乘各自的共轭 OTF。此步形成加权贡献，接着求和、除以累计传递系数，才得到融合结果。',
      equation: String.raw`$$B_{d,\ell}=H_{d,\ell}^{*}C_{d,\ell}=H_{d,\ell}^{*}H_{d,\ell}S=|H_{d,\ell}|^2S$$`,
      note: 'H* 是本步的乘数；连同后续归一化，实际融合权重为 g = H* / (R + w²)，随频率变化。它与前面从三帧提取级次的解混权重 u 不同。' },
    { label: '九项相加', title: '相加之后，还留下一个传递系数。',
      copy: '将九条加权频带相加，记作累计频谱 U。同一频率处的 S 相同，可以从和式中提出；它前面仍乘着各频带 OTF 模平方的总和。',
      equation: String.raw`$$U(\mathbf q)=\sum_{d,\ell}H_{d,\ell}^{*}C_{d,\ell}=\underbrace{\left(\sum_{d,\ell}|H_{d,\ell}|^2\right)}_{\text{仍需补偿的传递系数}}S(\mathbf q)$$`,
      note: '这里 U 表示加权后的累计频谱。要恢复 S，需要对留下的传递系数作归一化；下一步才引入分母。' },
    { label: 'Wiener 滤波', title: '补偿衰减，同时限制反演增益。',
      copy: '前一步留下了 OTF 模平方的累计系数，因此需要归一化。本页按 fairSIM 的计数约定累计分母，记作 R；再加 w²，避免传递很弱时产生过大的反演增益。',
      equation: String.raw`$$\begin{gathered}R(\mathbf q)\coloneqq\sum_d\left(2|H_{d,0}|^2+|H_{d,+1}|^2+|H_{d,-1}|^2\right)\\\widehat S_{\mathrm W}(\mathbf q)=\frac{U(\mathbf q)}{R(\mathbf q)+w^2},\qquad w=0.05\end{gathered}$$`,
      note: '等权基础推导各频带计一次；本页固定 fairSIM 分母额外计入各方向的 0 级模平方。中图显示实际的 1 / (R + w²)。' },
    { label: '乘切趾窗', title: '把频谱边缘，平缓收尾。',
      copy: '最后乘上平滑切趾窗，压低频谱边缘。窗外的频率置零，边缘的信号也会被进一步削弱。',
      equation: String.raw`$$\widehat S(\mathbf q)=P_{\mathrm{apo}}(\mathbf q)\,\widehat S_{\mathrm W}(\mathbf q)$$`,
      note: '切趾截止为检测截止的 1.9 倍，指数 β = 0.8。频谱共用亮度标尺；中图是 0—1 的实数窗。' },
    { label: '逆 FFT', title: '把复数频谱，变回图像。',
      copy: '对切趾后的完整复数频谱做逆 FFT，得到重建图像。此时才从频率坐标回到空间位置。',
      equation: String.raw`$$\widehat s=4\operatorname{Re}\!\left[\mathcal F_{256}^{-1}\{\widehat S\}\right]$$`,
      note: '输出 256 × 256，视野不变。固定因子 4 补偿零填充后的 FFT 归一化；更密采样本身不增加分辨率。' },
    { label: '图像对照', title: '沿同一条线，比较找回的结构。',
      copy: '下方剖面只看 y = 80 一行；图下的 RMSE（均方根误差）则把整幅重建与样品真值逐像素比较，是重建后算出的评价指标。',
      equation: String.raw`$$\mathrm{RMSE}=\sqrt{\frac1{128^2}\sum_{x,y}\big[\widehat s(2x,2y)-s(x,y)\big]^2}$$`,
      note: '128² 是比较的像素数；256² 输出取 (2x, 2y) 与真值对齐。误差平方 → 全图平均 → 开方；同一强度标尺下越小越接近真值，不能单独判定分辨率。' },
    { label: '核对高频', title: '回到最初那一点，检查恢复了多少。',
      copy: '同一个 q = (14, 0)：宽场完全无法传递，SIM 得到非零信号。幅度保留比例由实际重建和真值计算。',
      equation: String.raw`$$\eta=\frac{|\widehat S(\mathbf q)|}{|S(\mathbf q)|},\qquad\Delta\theta=\arg\!\left[\widehat S(\mathbf q)S^*(\mathbf q)\right]$$`,
      note: '真值只用于评价，不参与解混或融合。恢复了部分高频信息，不等于精确恢复全部样品幅度；单点不能代替整幅图的分辨率评价。' },
  ];
  const chapters = [
    { label: '样品与边界', start: 0, end: 1 }, { label: '编码与检测', start: 2, end: 5 },
    { label: '三相位观测', start: 6, end: 7 }, { label: '矩阵解混', start: 8, end: 11 },
    { label: '频带归位', start: 12, end: 13 }, { label: '多方向覆盖', start: 14, end: 16 },
    { label: 'Wiener 融合', start: 17, end: 20 }, { label: '图像与验证', start: 21, end: 23 },
  ];
  // Two-domain formulas describe the same operation. h is the intensity PSF;
  // H is the OTF itself, not a second quantity to convert from the OTF.
  const domainPairs = {
    0: {
      leftLabel: '样品 Sample · 空域',
      left: String.raw`$$s(\mathbf r),\qquad\mathbf r=(x,y)$$`,
      bridgeLabel: '二维傅里叶变换 · Fourier Transform',
      bridge: String.raw`$$S=\mathcal F_N\{s\}$$`,
      rightLabel: '样品频谱 Spectrum · 频域',
      right: String.raw`$$S(\mathbf q),\qquad\mathbf q=(q_x,q_y)$$`,
      guide: '',
    },
    1: {
      leftLabel: '空域 · 与 PSF 卷积',
      left: String.raw`$$d_{\mathrm{WF}}(\mathbf r)=(s*\color{#7ad5cd}{h})(\mathbf r)$$`,
      bridgeLabel: 'PSF → OTF · 傅里叶变换',
      bridge: String.raw`$$\color{#7ad5cd}{H(\mathbf q)}=\mathcal F\{\color{#7ad5cd}{h(\mathbf r)}\}$$`,
      rightLabel: '频域 · 乘 OTF',
      right: String.raw`$$D_{\mathrm{WF}}(\mathbf q)=\color{#7ad5cd}{H(\mathbf q)}S(\mathbf q)$$`,
      rightDetail: String.raw`$$H(14,0)=0$$`,
      guide: 'h 是点扩散函数（PSF），描述一个点怎样成像；H 就是光学传递函数（OTF）。* 表示卷积。两式是同一成像过程的两种表示。',
    },
    3: {
      leftLabel: '空域 · 样品与照明相乘',
      left: String.raw`$$e_j(\mathbf r)=s(\mathbf r)I_j(\mathbf r)$$`,
      bridgeLabel: '空域相乘 → 频域卷积',
      bridge: String.raw`$$E_j=\mathcal F\{e_j\}$$`,
      rightLabel: '频域 · 三个平移项相加',
      right: beforeScenes[3].equation,
      rightDetail: String.raw`$$\mathbf f=\mathbf q+\ell\mathbf k,\qquad\ell\in\{0,+1,-1\}$$`,
      guide: 'f = q + ℓk：每个副本整体平移。两侧高频分别由 −1、+1 级带入通带；加权叠加后，同一 f 将混合三个来源。',
    },
    20: {
      leftLabel: '频域 · 最终复数频谱',
      left: String.raw`$$\widehat S=P_{\mathrm{apo}}\widehat S_{\mathrm W}$$`,
      bridgeLabel: '逆 FFT · 叠加全部频率',
      bridge: String.raw`$$\mathcal F^{-1}_{256}$$`,
      rightLabel: '空域 · 重建图像',
      right: String.raw`$$\widehat s=4\operatorname{Re}\!\left[\mathcal F^{-1}_{256}\{\widehat S\}\right]$$`,
      guide: '解混、频带归位与融合都在频域完成；此处通过逆 FFT 回到空域。逆变换使用完整复数，固定因子 4 补偿零填充后的归一化。',
    },
  };
  function formulaDomain(index) {
    if (index === 0) return '空域 → 频域';
    if (index === 5) return '空域 ↔ 频域';
    if (index === 6) return '空域 · 相移采集';
    if (domainPairs[index]) return index === 20 ? '频域 → 空域' : '空域 ↔ 频域';
    if (index === 2) return '空域 · 荧光激发';
    if (index === 7) return '频域 · 观测';
    if (index >= 8 && index <= 9) return '频域 · 矩阵解混';
    if (index >= 10 && index <= 12) return '频域 · 归位';
    if (index >= 14 && index <= 19) return '频域 · 覆盖与融合';
    if (index === 21) return '空域 · 图像评价';
    if (index === 22) return '频域 · 高频评价';
    return index === 13 ? '采集 → 频域重建' : '频域 · 观测方程';
  }
  const sumScene = { label: '编码叠加', title: '高频带进来了，三个来源也混在了一起。',
    copy: '三份移频频谱按照明权重逐点相加。在标记的同一个 f，三个复数贡献合成一个值；接下来相机只能记录它们经过物镜后的总和。',
    equation: beforeScenes[3].equation,
    note: '零级权重为 1，旁带权重为 (m/2)e^{±iφⱼ}。图像用固定相位演示，公式保留待估参数；下一步经过检测，再设法解开混合。',
    stageIndex: null, encodingSum: true };
  // Stable names are integration anchors; visible step numbers may change.
  const sceneIds = Object.freeze(['sample', 'widefield', 'illumination', 'frequency-encoding',
    'encoding-sum', 'detection', 'phase-acquisition', 'frequency-probe', 'mixed-sources',
    'inverse-demix', 'verify-demix', 'separate-bands', 'relocate-bands',
    'recover-high-frequency', 'directions', 'single-direction-support', 'combined-support',
    'otf-weight', 'sum-contributions', 'wiener', 'apodization', 'inverse-fft', 'image-comparison', 'frequency-audit']);
  const parameterSlot = Object.freeze({ id: 'illumination-estimation', after: 'inverse-demix',
    before: 'verify-demix', direction: 0, estimationOrder: 1,
    requiresProvisionalSplit: true, active: true,
    purpose: '符号求逆之后临时分离并估计参数；用实际权重验证抵消，再正式解混。' });
  const scenes = [...beforeScenes, ...demixScenes, ...afterScenes]
    .flatMap((scene, stageIndex) => stageIndex === 4 ? [sumScene, { ...scene, stageIndex }]
      : [{ ...scene, stageIndex }])
    .map((scene, index) => {
    const position = index >= 10 ? index + 1 : index;
    const chapterIndex = chapters.findIndex(chapter => position >= chapter.start && position <= chapter.end);
    const encodingFormula = scene.stageIndex === 2 || scene.stageIndex === 3 || !!scene.encodingSum;
    const theoryTopic = index === 3 ? 'encoding' : [2, 6, 7, 13].includes(index) ? 'parameters' : index >= 14 && index <= 19 ? 'weights' : index >= 20 ? 'rmse' : null;
    return { ...scene, stageIndex: index >= 10 ? index : scene.stageIndex,
      id: sceneIds[position], theoryTopic, encodingFormula, demixFormula: index >= 8 && index <= 10,
      detectionFormula: index === 5, acquisitionFormula: index === 6,
      domainPair: encodingFormula ? null : domainPairs[index] || null,
      formulaDomain: scene.stageIndex === 2 ? formulaDomain(2) : encodingFormula ? '频域 · 编码与叠加' : index >= 8 && index <= 10 ? '频域 · 矩阵解混' : formulaDomain(index), chapterIndex, chapter: `${String(chapterIndex + 1).padStart(2, '0')} / ${chapters[chapterIndex].label}` };
  }).flatMap((scene, index) => index !== 9 ? [scene] : [scene, {
    ...scene, id: 'verify-demix', label: '验证抵消', title: '按来源合并，两个抵消，一个保留。',
    copy: '沿用刚才算出的 u，将三帧观测式代入加权和，按来源提出相同的 A。三个括号对应已经核对的三列系数和，依次为 0、0、1。',
    equation: String.raw`$$A_{-1}(\mathbf f)=\left(\sum_j u_{-1,j}\right)A_0(\mathbf f)+\left(\frac m2\sum_j u_{-1,j}e^{i\phi_j}\right)A_{+1}(\mathbf f)+\left(\frac m2\sum_j u_{-1,j}e^{-i\phi_j}\right)A_{-1}(\mathbf f)$$`,
    note: '依据 M⁻¹M = I；只要 M 可逆，这个结论就成立。系数和为 0 不表示样品分量为 0，保留下来的 A₋₁(f) 仍带 H(f)。',
  }]);
  const DEMIX_START = 6;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const ramp = (t, a, b) => smooth((t - a) / (b - a));
  // Hold the old geometry while proving the inverse row, then resume it.
  const legacyTime = time => time <= 9 ? time : time <= 10 ? 9 : time - 1;
  const stageTime = time => { const t = legacyTime(time); return t <= 3 ? t : t <= 4 ? 3 : t <= 9 ? t - 1 : t < 10 ? 2 * t - 10 : t; };
  // Introduce the next explanation before its operation, including on replay.
  // One index is shared by the heading, formula group and transport.
  const sceneIndex = time => time >= 2 && time < 3 ? (time < 2.02 ? 2 : 3)
    : time >= 7 && time < 11 ? Math.floor(time) + (time % 1 >= .12 - 1e-9 ? 1 : 0) : Math.round(time);
  // Local playhead progress → elapsed milliseconds. Keep symbol movements short
  // and give the completed equations reading time, on the same reversible clock.
  const transitionPacing = Object.freeze({ 2: Object.freeze([
    [0, 0], [.02, 1500], [.025, 3000], [.04, 11000], [.045, 11600],
    [.06, 19600], [.065, 20200], [.08, 28200], [.085, 29700],
    [.10, 37700], [.105, 39200], [.12, 47200], [.125, 48700], [.14, 56700],
    [.21, 58500], [.235, 63500], [.265, 64700], [.28, 69700],
    [.30, 70700], [.325, 71700], [.345, 75700], [.37, 76900],
    [.385, 81900], [.415, 83100], [.44, 88100], [.46, 92100], [.50, 93900], [1, 111900],
  ].map(Object.freeze)) });
  const transitionDurations = [1500, 1600, transitionPacing[2].at(-1)[1], 6500, 5200, 7000, 2400, 40000, 24000, 11000, 9500, 1650, 1900, 1800, 2400, 1700, 6300, 2300, 2300, 2100, 1700, 1700, 1700];
  const inverseEquations = Object.freeze([
    String.raw`$$\mathbf D(\mathbf f)=M\mathbf A(\mathbf f)$$`,
    String.raw`$$M^{-1}\mathbf D(\mathbf f)=M^{-1}M\mathbf A(\mathbf f)$$`,
    String.raw`$$M^{-1}\mathbf D(\mathbf f)=I\mathbf A(\mathbf f)$$`,
    String.raw`$$M^{-1}\mathbf D(\mathbf f)=\mathbf A(\mathbf f)$$`,
    String.raw`$$\mathbf A(\mathbf f)=M^{-1}\mathbf D(\mathbf f)$$`,
    String.raw`$$\mathbf A(\mathbf f)=U\mathbf D(\mathbf f),\qquad U=M^{-1},\quad U_{\ell j}=u_{\ell,j}$$`,
    String.raw`$$u_{0,j}=\frac13,\qquad u_{\pm1,j}=\frac{2}{3m}e^{\mp i\phi_j},\qquad\phi_j=\phi_\Delta+\frac{2\pi j}{3},\quad m\ne0$$`,
  ]);
  // For equally spaced phases, M = V diag(1,m/2,m/2) and V* V = 3I.
  // Hence U = diag(1,2/m,2/m) V*/3. This includes a common phase offset.
  const inverseWeightTex = (row, j) => row === 0 ? String.raw`\frac13`
    : '\\frac{2}{3m}e^{' + (orders[row] === 1 ? '-' : '+') + 'i\\phi_' + j + '}';
  function inverseState(time) {
    return { multiply: ramp(time, 8.22, 8.30), identity: ramp(time, 8.34, 8.40),
      removeIdentity: ramp(time, 8.42, 8.45), swap: ramp(time, 8.47, 8.53), weights: ramp(time, 8.55, 8.60),
      resolved: orders.map((_, row) => [0, 1, 2].map(j => {
        const start = 8.63 + (row * 3 + j) * .032;
        return ramp(time, start, start + .025);
      })),
      formula: time < 8.22 ? 0 : time < 8.34 ? 1 : time < 8.42 ? 2 : time < 8.47 ? 3 : time < 8.60 ? 4 : time < 8.63 ? 5 : 6 };
  }
  // Revisit the unweighted encoding copies before naming their detected
  // versions A. The same playhead filters full complex data, then reads f.
  // Formula anchors and thumbnail destinations share these descriptors.
  const sourceAnchors = Object.freeze(orders.map((order, row) => Object.freeze({
    order, overview: Object.freeze({ x: 430 + row * 350, y: 275 }),
    expanded: Object.freeze({ x: 980, y: 218 + row * 100, thumbnailX: 1240 }),
    scalar: Object.freeze({ x: 605 + row * 315, y: 207 }),
    vector: Object.freeze({ x: 1205, y: 314 + row * 72, thumbnailX: 1310 }),
  })));
  const sourceMatrixTime = time => time > 7.12 && time < 8
    ? 7.12 + .88 * clamp((time - 7.54) / .46) : time;
  function sourceOriginState(time) {
    const dock = ramp(time, 7.42, 7.54), matrix = ramp(sourceMatrixTime(time), 7.40, 7.48);
    const opacity = ramp(time, 7.12, 7.16) * (1 - ramp(time, 8.12, 8.22));
    return { opacity, overview: opacity * (1 - dock), dock, matrix,
      panels: sourceAnchors.map(anchor => ({
        order: anchor.order,
        x: lerp(lerp(anchor.overview.x, anchor.expanded.thumbnailX, dock), anchor.vector.thumbnailX, matrix),
        y: lerp(lerp(anchor.overview.y, anchor.expanded.y, dock), anchor.vector.y, matrix),
        scale: lerp(1, .28, dock),
      })),
      filter: ramp(time, 7.21, 7.30), alias: ramp(time, 7.31, 7.35),
      probe: ramp(time, 7.36, 7.40) };
  }
  function sourceOriginPixel(lesson, orderIndex, progress, index) {
    const gain = lerp(1, lesson.detection.transfer[index], clamp(progress));
    return { re: lesson.encodingCopies[orderIndex].re[index] * gain,
      im: lesson.encodingCopies[orderIndex].im[index] * gain };
  }
  function demixState(time) {
    const origin = sourceOriginState(time);
    time = sourceMatrixTime(time);
    const inverse = ramp(time, 8.12, 8.22), proof = ramp(time, 9.20, 9.40), application = ramp(time, 10.16, 10.28), bands = ramp(time, 10.86, 11);
    const definitions = ramp(time, 7.24, 7.32), collapse = ramp(time, 7.32, 7.39), arrange = ramp(time, 7.40, 7.48);
    const transfers = [7.50, 7.66, 7.82].map(start => [0, 1, 2, 3].map(c => ramp(time, start + c * .032, start + c * .032 + .028)));
    const second = ramp(time, 7.63, 7.65), third = ramp(time, 7.79, 7.81);
    return { origin, panels: { origin: origin.overview, source: (1 - arrange) * (1 - origin.overview), mix: arrange - inverse, inverse: inverse - proof, proof: proof - application, result: application },
      definitions, collapse, arrange, transfers, activeRows: [1 - second, second - third, third],
      matrixRows: transfers.map(row => row[3]),
      // Only the isolated coefficient proof selects -1. The production path
      // holds at time 9 before estimating from the 0 / +1 overlap.
      inverse, inversion: inverseState(time), selectedRow: ramp(time, 9.12, 9.20), proof, expand: ramp(time, 9.42, 9.62), coefficientSum: ramp(time, 9.68, 9.86), proofComplete: ramp(time, 9.90, 10),
      application, products: [[10.30, 10.41], [10.43, 10.54], [10.56, 10.67]].map(([start, end]) => ramp(time, start, end)),
      applyRows: [[10.72, 10.77], [10.78, 10.83], [10.68, 10.71]].map(([start, end]) => ramp(time, start, end)),
      bands, reveal: ramp(time, 7.12, 7.24) };
  }
  function acquisitionState(time) {
    const carry = ramp(time, 5, 5.28), handoff = ramp(time, 5.24, 5.32);
    const firstShift = ramp(time, 5.52, 5.70), secondShift = ramp(time, 5.80, 5.96), step = 2 * Math.PI / 3;
    const exit = 1 - ramp(time, 6, 6.3);
    return { carry, handoff, firstShift, secondShift, exit,
      clear: 1 - ramp(time, 5, 5.16),
      firstPose: { x: lerp(500, 360, carry), y: lerp(397, 250, carry), size: lerp(184, 224, carry) },
      stripOpacity: ramp(time, 5.32, 5.44) * exit,
      completed: ramp(time, 5.96, 6),
      phase: step * (firstShift + secondShift),
      active: time < 5.52 ? 0 : time < 5.8 ? 1 : 2,
      shifting: time > 5.52 && time < 5.70 || time > 5.80 && time < 5.96,
      frames: [
        { phase: 0, opacity: 1 },
        { phase: step * firstShift, opacity: ramp(time, 5.44, 5.50) },
        { phase: step * (1 + secondShift), opacity: ramp(time, 5.74, 5.80) },
      ],
      arrows: [ramp(time, 5.34, 5.44) * exit, ramp(time, 5.70, 5.78) * exit],
    };
  }
  // A fixed linear detection system maps cosine illumination to
  // d_phi = B0 + Bc cos(phi) + Bs sin(phi). These basis images come from the
  // three actual exposures, so phase animation keeps the specimen stationary.
  function acquisitionPixel(lesson, phase, index) {
    const { mean, cosine, sine } = lesson.acquisition;
    return mean[index] + cosine[index] * Math.cos(phase) + sine[index] * Math.sin(phase);
  }
  function detectionState(time) {
    const dock = ramp(time, 4, 4.28), copy = ramp(time, 4.24, 4.46), filter = ramp(time, 4.56, 4.96);
    const resultFocus = ramp(time, 4.90, 5);
    return { dock, copy, filter, resultFocus,
      opacity: ramp(time, 4, 4.16) * (1 - acquisitionState(time).handoff),
      reference: ramp(time, 4.12, 4.30), duplicate: ramp(time, 4.24, 4.34),
      passband: ramp(time, 4.46, 4.56),
      inputFocus: 1 - ramp(time, 4.56, 4.66),
      filterFocus: ramp(time, 4.52, 4.64) * (1 - resultFocus),
      spectrumPose: { x: lerp(720, 940, dock), y: lerp(250, 147, dock), scale: lerp(1, 184 / 260, dock) },
      outputY: lerp(147, 397, copy),
    };
  }
  // H_t = (1-t) + tH, h_t = (1-t)δ + th. Linearity gives the same
  // intermediate image in both domains; t is teaching progress, not exposure.
  function detectionPixel(lesson, state, index) {
    const { emission, detected, transfer } = lesson.detection;
    const gain = lerp(1, transfer[index], state.filter), z = lesson.emissionSpectrum;
    return { spatial: lerp(emission[index], detected[index], state.filter),
      re: z.re[index] * gain, im: z.im[index] * gain, gain };
  }
  function encodingSumState(time) {
    const arrange = ramp(time, 3.08, 3.32), weight = ramp(time, 3.32, 3.58), merge = ramp(time, 3.60, 3.94);
    const detection = detectionState(time), detect = detection.dock, factor = lerp(1, .4, weight);
    return { arrange, weight, merge, factor, detect, probe: ramp(time, 3.34, 3.50),
      opacity: ramp(time, 3, 3.16) * (1 - ramp(time, 4, 4.16)),
      expanded: ramp(time, 3, 3.14) * (1 - ramp(time, 3.94, 4)),
      zeroFocus: ramp(time, 3.08, 3.18) * (1 - ramp(time, 3.32, 3.42)),
      weightFocus: ramp(time, 3.32, 3.42) * (1 - ramp(time, 3.60, 3.72)),
      sumFocus: ramp(time, 3.60, 3.94),
      panels: [
        { x: lerp(360, 720, arrange) + 220 * detect, y: 250 - 36 * Math.sin(Math.PI * arrange) - 103 * detect, scale: detection.spectrumPose.scale, opacity: 1 },
        { x: lerp(lerp(720, 360, arrange), 720, merge), y: 250 + 36 * Math.sin(Math.PI * arrange), scale: 1, opacity: 1 - merge },
        { x: lerp(1080, 720, merge), y: 250, scale: 1, opacity: 1 - merge },
      ],
    };
  }
  function encodingSumPixel(lesson, state, index) {
    const z = lesson.encodingCopies;
    return { re: z[0].re[index] + state.merge * state.factor * (z[1].re[index] + z[2].re[index]),
      im: z[0].im[index] + state.merge * state.factor * (z[1].im[index] + z[2].im[index]) };
  }
  function timelineGeometry(viewportWidth, count = scenes.length) {
    const stepWidth = Math.max(132, viewportWidth / count), width = stepWidth * count;
    const start = stepWidth / 2, length = stepWidth * (count - 1), thumbSize = 7;
    // Native range thumbs travel between their centers, inset by half a thumb.
    // The range, progress line and equal-width step cells share this geometry.
    return { stepWidth, width, start, length, thumbSize, sliderLeft: start - thumbSize / 2, sliderWidth: length + thumbSize };
  }
  // Each symbol keeps one DOM identity. Layouts are algebraic endpoints;
  // interpolation transports shared factors and branches their copies.
  // Coordinates use a fixed SVG viewBox, never measurements during playback.
  const encodingFormulaTokens = Object.freeze([
    ['ex', String.raw`e_j(x)`, 88, null, 'ex', 'er'],
    ['er', String.raw`e_j(\mathbf r)`, 88, null, 'ex', 'eft'],
    ['eft', String.raw`\mathcal F_N\{e_j(\mathbf r)\}`, 176, null, 'er', 'ef'],
    ['ef', String.raw`E_j(\mathbf f)`, 98, null, 'eft'],
    ['equals', '=', 28],
    ['s0x', 's(x)', 68, 0, 's0x', 's0r'],
    ['s0r', String.raw`s(\mathbf r)`, 72, 0, 's0x', 'S0'],
    ['S0', String.raw`S(\mathbf f)`, 82, 0, 's0r'],
    ['open', '[', 16, null, 'open', 's0x'],
    ['one', '1', 23, 0, 'one', 's0x'],
    ['plus0', '+', 28],
    ['mPlus', 'm', 30, 1],
    ['barPlus', String.raw`\rule{.85em}{.045em}`, 30, 1, 'mPlus', 'mPlus'],
    ['denPlus', '2', 30, 1, 'mPlus', 'mPlus'],
    ['cosine', String.raw`\cos\!\left(\frac{2\pi x}{p}+\phi_j\right)`, 244, null, 'cosine', 'cosTheta'],
    ['cosTheta', String.raw`\cos\theta`, 110, null, 'cosine', 'exponentPlusTheta'],
    ['exponentPlusTheta', String.raw`e^{i\theta}`, 64, 1, 'cosTheta', 'exponentPlusAngle'],
    ['exponentMinusTheta', String.raw`e^{-i\theta}`, 80, 2, 'cosTheta', 'exponentMinusAngle'],
    ['exponentPlusAngle', String.raw`e^{i(2\pi x/p+\phi_j)}`, 204, 1, 'exponentPlusTheta', 'carrierPlusX'],
    ['exponentMinusAngle', String.raw`e^{-i(2\pi x/p+\phi_j)}`, 220, 2, 'exponentMinusTheta', 'carrierMinusX'],
    ['innerOpen', '(', 16, null, 'cosine', 'sPlusX'],
    ['phasePlus', String.raw`e^{i\phi_j}`, 60, 1, 'exponentPlusAngle'],
    ['sPlusX', 's(x)', 68, 1, 's0x', 'sPlusR'],
    ['sPlusR', String.raw`s(\mathbf r)`, 72, 1, 'sPlusX', 'SPlus'],
    ['carrierPlusX', String.raw`e^{2\pi ix/p}`, 124, 1, 'exponentPlusAngle', 'carrierPlusR'],
    ['carrierPlusR', String.raw`e^{2\pi i\mathbf k\cdot\mathbf r/N}`, 166, 1, 'carrierPlusX', 'SPlus'],
    ['plus1', '+', 28, null, 'cosine'],
    ['mMinus', 'm', 30, 2, 'mPlus'],
    ['barMinus', String.raw`\rule{.85em}{.045em}`, 30, 2, 'barPlus'],
    ['denMinus', '2', 30, 2, 'denPlus'],
    ['phaseMinus', String.raw`e^{-i\phi_j}`, 72, 2, 'exponentMinusAngle'],
    ['sMinusX', 's(x)', 68, 2, 's0x', 'sMinusR'],
    ['sMinusR', String.raw`s(\mathbf r)`, 72, 2, 'sMinusX', 'SMinus'],
    ['carrierMinusX', String.raw`e^{-2\pi ix/p}`, 140, 2, 'exponentMinusAngle', 'carrierMinusR'],
    ['carrierMinusR', String.raw`e^{-2\pi i\mathbf k\cdot\mathbf r/N}`, 182, 2, 'carrierMinusX', 'SMinus'],
    ['innerClose', ')', 16, null, 'cosine', 'carrierMinusX'],
    ['close', ']', 16, null, 'close', 'carrierMinusX'],
    ['F0', String.raw`\mathcal F_N\{`, 78, 0, 's0r', 'S0'],
    ['end0', String.raw`\}`, 20, 0, 's0r', 'S0'],
    ['FPlus', String.raw`\mathcal F_N\{`, 78, 1, 'sPlusR', 'SPlus'],
    ['endPlus', String.raw`\}`, 20, 1, 'carrierPlusR', 'SPlus'],
    ['FMinus', String.raw`\mathcal F_N\{`, 78, 2, 'sMinusR', 'SMinus'],
    ['endMinus', String.raw`\}`, 20, 2, 'carrierMinusR', 'SMinus'],
    ['SPlus', String.raw`S(\mathbf f-\mathbf k)`, 144, 1, 'sPlusR'],
    ['SMinus', String.raw`S(\mathbf f+\mathbf k)`, 144, 2, 'sMinusR'],
  ].map(([id, tex, width, band = null, birth = id, exit = id]) => Object.freeze({
    id, equation: `$$${tex}$$`, width, band, birth, exit,
    kind: id === 'barPlus' || id === 'barMinus' ? 'fraction-bar' : 'math',
  })));
  const encodingTokenById = Object.fromEntries(encodingFormulaTokens.map(token => [token.id, token]));
  function encodingFormulaLayout(ids) {
    const width = id => id.startsWith('fraction') ? 34 : encodingTokenById[id].width;
    const total = ids.reduce((sum, id) => sum + width(id), 0) + (ids.length - 1) * 3;
    const scale = Math.min(1, 1140 / total), poses = {};
    let left = 600 - total * scale / 2;
    for (const id of ids) {
      const x = left + width(id) * scale / 2;
      if (id.startsWith('fraction')) {
        const side = id.slice(8);
        for (const [part, offset, size] of [['m', -13, .86], ['bar', 0, 1], ['den', 15, .86]])
          poses[part + side] = { x, y: 64 + offset * scale, scale: scale * size, opacity: 1 };
      } else poses[id] = { x, y: 64, scale, opacity: 1 };
      left += (width(id) + 3) * scale;
    }
    return poses;
  }
  const encodingAlgebraLayouts = (() => {
    const cosine = encodingFormulaLayout(['ex', 'equals', 's0x', 'open', 'one', 'plus0', 'mPlus', 'cosine', 'close']);
    const theta = encodingFormulaLayout(['ex', 'equals', 's0x', 'open', 'one', 'plus0', 'mPlus', 'cosTheta', 'close']);
    const exponentPair = suffix => encodingFormulaLayout(['ex', 'equals', 's0x', 'open', 'one', 'plus0', 'fractionPlus', 'innerOpen',
      'exponentPlus' + suffix, 'plus1', 'exponentMinus' + suffix, 'innerClose', 'close']);
    const euler = encodingFormulaLayout(['ex', 'equals', 's0x', 'open', 'one', 'plus0', 'fractionPlus', 'innerOpen',
      'phasePlus', 'carrierPlusX', 'plus1', 'phaseMinus', 'carrierMinusX', 'innerClose', 'close']);
    const spatial = dimension => encodingFormulaLayout([dimension === 'X' ? 'ex' : 'er', 'equals', dimension === 'X' ? 's0x' : 's0r', 'plus0',
      'fractionPlus', 'phasePlus', 'sPlus' + dimension, 'carrierPlus' + dimension, 'plus1',
      'fractionMinus', 'phaseMinus', 'sMinus' + dimension, 'carrierMinus' + dimension]);
    const fourier = solved => encodingFormulaLayout([solved === 3 ? 'ef' : 'eft', 'equals',
      ...(solved > 0 ? ['S0'] : ['F0', 's0r', 'end0']), 'plus0', 'fractionPlus', 'phasePlus',
      ...(solved > 1 ? ['SPlus'] : ['FPlus', 'sPlusR', 'carrierPlusR', 'endPlus']), 'plus1', 'fractionMinus', 'phaseMinus',
      ...(solved > 2 ? ['SMinus'] : ['FMinus', 'sMinusR', 'carrierMinusR', 'endMinus'])]);
    return { cosine, theta, eulerTheta: exponentPair('Theta'), eulerAngle: exponentPair('Angle'), euler, spatialX: spatial('X'), spatialR: spatial('R'),
      transform: fourier(0), zero: fourier(1), positive: fourier(2), spectrum: fourier(3) };
  })();
  const encodingFormulaKeyframes = Object.freeze([
    [2, 'cosine'], [2.02, 'cosine'], [2.025, 'theta'], [2.08, 'theta'],
    [2.085, 'eulerTheta'], [2.10, 'eulerTheta'], [2.105, 'eulerAngle'], [2.12, 'eulerAngle'],
    [2.125, 'euler'], [2.14, 'euler'],
    [2.21, 'spatialX'], [2.235, 'spatialX'], [2.265, 'spatialR'], [2.28, 'spatialR'],
    [2.30, 'transform'], [2.325, 'zero'], [2.345, 'zero'], [2.37, 'positive'],
    [2.385, 'positive'], [2.415, 'spectrum'], [2.46, 'spectrum'],
  ].map(([time, layout]) => Object.freeze({ time, layout, poses: encodingAlgebraLayouts[layout] })));
  function encodingFormulaMotion(time) {
    const frames = encodingFormulaKeyframes;
    const next = frames.findIndex(frame => frame.time > time);
    const a = frames[next < 0 ? frames.length - 1 : Math.max(0, next - 1)], b = frames[next < 0 ? frames.length - 1 : next];
    const progress = a === b ? 0 : ramp(time, a.time, b.time);
    const tokens = encodingFormulaTokens.map(token => {
      const from = a.poses[token.id] || { ...(a.poses[token.birth] || b.poses[token.birth] || b.poses[token.id] || { x: 600, y: 64, scale: 1 }), opacity: 0 };
      const to = b.poses[token.id] || { ...(b.poses[token.exit] || a.poses[token.exit] || a.poses[token.id] || from), opacity: 0 };
      const changes = from.x !== to.x || from.y !== to.y;
      const arc = changes ? Math.sin(Math.PI * progress) * (token.band === 2 ? 20 : -20) : 0;
      return { id: token.id, x: lerp(from.x, to.x, progress), y: lerp(from.y, to.y, progress) + arc,
        scale: lerp(from.scale, to.scale, progress), opacity: lerp(from.opacity, to.opacity, progress) };
    });
    const park = ramp(time, 2.46, 2.52);
    return { tokens, progress, from: a.layout, to: b.layout,
      opacity: 1 - ramp(time, 2.52, 2.58), x: 180 * park, y: -19 * park, scale: 1 - .3 * park,
      theta: ramp(time, 2.02, 2.025) * (1 - ramp(time, 2.039, 2.04)),
      identity: ramp(time, 2.04, 2.045) * (1 - ramp(time, 2.059, 2.06)),
      cancel: ramp(time, 2.06, 2.065) * (1 - ramp(time, 2.079, 2.08)),
      half: ramp(time, 2.08, 2.085) * (1 - ramp(time, 2.099, 2.10)),
      substitute: ramp(time, 2.10, 2.105) * (1 - ramp(time, 2.119, 2.12)),
      factor: ramp(time, 2.12, 2.125) * (1 - ramp(time, 2.139, 2.14)),
      notation: ramp(time, 2.235, 2.245) * (1 - ramp(time, 2.279, 2.28)),
      theorem: ramp(time, 2.28, 2.30) * (1 - ramp(time, 2.44, 2.45)) };
  }
  // The captions and images follow the same algebraic progression. Euler
  // expansion is spatial algebra; the spectra appear after all three FFTs.
  const encodingDerivationStages = Object.freeze([
    { id: 'theta', start: 2.02, end: 2.04, domain: '空域 · 记下条纹总相位',
      title: '先把余弦括号里的整段，记作 θ。',
      copy: 'θ = 2πx/p + φⱼ：前一部分随位置 x 变化，后一部分是第 j 次曝光的初相位。先用 θ 缩短式子，集中看余弦怎样展开。',
      note: '这里只换记号；样品、条纹照明和荧光发射都没有改变，仍在空域。' },
    { id: 'identity', start: 2.04, end: 2.06, domain: '空域 · 正负欧拉公式',
      title: '正、负两个指数，虚部刚好相反。',
      copy: '下方先写出正指数的欧拉公式。把 θ 换成 −θ，余弦不变、正弦变号，就得到第二个式子。两式只差虚部的符号。',
      note: 'θ 为实数，因此两个指数互为共轭；i² = −1。先比较两式的实部与虚部。' },
    { id: 'cancel', start: 2.06, end: 2.08, domain: '空域 · 两式相加',
      title: '两式相加，虚部抵消，留下两份余弦。',
      copy: '+i sin θ 与 −i sin θ 相加为零；两份 cos θ 相加得到 2 cos θ。这就是实值条纹能够写成一对复指数之和的原因。',
      note: '相加后是 2 cos θ，还需要除以 2，才能替换原来的 cos θ。' },
    { id: 'half', start: 2.08, end: 2.10, domain: '空域 · 除以 2 再代入',
      title: '两边除以 2，m 就变成每项的 m/2。',
      copy: '将下方的余弦恒等式代回原来的发射式。调制度 m 乘这整个指数和，因此两个指数各自带有 m/2。',
      note: '1/2 来自欧拉恒等式，与傅里叶变换的归一化无关。' },
    { id: 'substitute', start: 2.10, end: 2.12, domain: '空域 · 代回条纹总相位',
      title: '把 θ 换回原来的条纹相位。',
      copy: '分别在正、负指数里代入 θ = 2πx/p + φⱼ。负号作用于整个括号，所以空间项和初相位都要一起变号。',
      note: '先保留指数里的完整括号，下一步再分开随位置变化的部分与固定相位。' },
    { id: 'factor', start: 2.12, end: 2.14, domain: '空域 · 指数拆成两个因子',
      title: '指数里的和，拆成相位因子乘空间因子。',
      copy: '用下方的指数乘法公式拆开每个指数。相位因子对本次曝光的所有位置相同，空间因子随 x 变化，稍后负责移频。',
      note: '这一步仍是空域中的代数恒等式，图像保持不变；还没有进行傅里叶变换。' },
    { id: 'spatial', start: 2.14, end: 2.235, domain: '空域 · 三项发射',
      title: '乘上样品，发射分布就分成三项。',
      copy: '把展开式代回 eⱼ = sIⱼ。第一项保留样品，另外两项各乘一个空间复指数；相位因子与调制度不随空间位置改变。',
      note: 's(x) 分配到括号中的每一项，m/2 分配到两个复指数；得到三项之和。' },
    { id: 'notation', start: 2.235, end: 2.28, domain: '空域 · 恢复二维记号',
      title: '从一行 x，恢复到整幅图像的位置 r。',
      copy: '令 r = (x, y)，本方向 k = (N/p, 0)，因此 k·r/N = x/p。将 s(x) 恢复成 s(r)，并用波矢 k 写出同一个空间指数。',
      note: 'k 以 DFT 频率格为单位。这是同一照明模型的二维写法，仍未变换到频域。' },
    { id: 'transform', start: 2.28, end: 2.345, domain: '空域 → 频域 · 逐项变换',
      title: '对三项分别变换，先处理不带空间指数的一项。',
      copy: '傅里叶变换具有线性性：和的变换等于各项变换之和。m/2 与相位因子不随 r 变化，可以提出变换；第一项直接得到 S(f)。',
      note: '接下来分别处理带正、负空间指数的两项；它们决定频谱搬移的方向。' },
    { id: 'positive', start: 2.345, end: 2.385, domain: '频域 · 正指数对应 f−k',
      title: '乘正空间指数，得到 S(f−k)。',
      copy: '正向 DFT 的变换核带负号。将 +k 的指数与核中的 −f 合并，得到 −(f−k)，因此正指数这一项变成 S(f−k)。',
      note: '令 f−k = q，就得到 f = q+k：这是样品频谱整体向 +k 移动。' },
    { id: 'negative', start: 2.385, end: 2.44, domain: '频域 · 负指数对应 f+k',
      title: '乘负空间指数，得到 S(f+k)。',
      copy: '同理，将 −k 的指数与核中的 −f 合并，得到 −(f+k)，所以负指数这一项变成 S(f+k)。两侧项都保留原来的 m/2 和相位因子。',
      note: '令 f+k = q，就得到 f = q−k：这是样品频谱整体向 −k 移动。' },
    { id: 'spectrum', start: 2.44, end: 2.48, domain: '频域 · 三个编码项',
      title: '三个移频来源，共同组成发射频谱。',
      copy: '得到 0、+1、−1 级三项。先展开三份未加权样品频谱，接着演示两侧副本怎样搬移；05 再加入照明权重并逐点相加。',
      note: '下式是完整编码结果；图中接下来分步演示移频与加权。m、φⱼ 保留为符号，实际照明参数稍后由观测估计。' },
  ].map(Object.freeze));
  function encodingDerivationState(time) {
    const view = encodingDerivationStages.find(stage => time >= stage.start && time < stage.end) || null;
    return { formula: encodingFormulaMotion(time), view, spectra: ramp(time, 2.44, 2.50), coordinates: ramp(time, 2.48, 2.50) };
  }
  function encodingFrame(time) {
    // Fade the formulas in before moving, and out before the detection scene.
    // This is a reversible drawing displacement, not a changing illumination k.
    const progress = ramp(time, 2.60, 2.76), distance = 8 * progress;
    const formulaReveal = ramp(time, 2.50, 2.60), formulaExit = ramp(time, 3, 3.35);
    const displayDistance = Number(distance.toFixed(1)), displayFrequency = Number((14 - displayDistance).toFixed(1));
    return { progress, distance, displayDistance, displayFrequency,
      formulaOpacity: formulaReveal * (1 - formulaExit), formulaOffset: 8 * (1 - formulaReveal) - 5 * formulaExit,
      panels: orders.map(order => ({
      order, shift: order * distance,
      points: [14, -14].map(q => {
        const f = q + order * distance;
        return { q, f, inside: Math.abs(f) < 10, emphasis: ramp(10 - Math.abs(f), 0, 4) };
      }),
    })) };
  }
  function encodingFormulaValues(frame) {
    return {
      positive: String.raw`$$\mathbf q\xrightarrow{-\mathbf k}\mathbf f=\mathbf q-\mathbf k$$`,
      negative: String.raw`$$-\mathbf q\xrightarrow{+\mathbf k}-\mathbf f=-\mathbf q+\mathbf k$$`,
    };
  }
  function encodingNotationState(time) {
    const numeric = ramp(time, 2.76, 2.79), inverse = ramp(time, 2.83, 2.86), compact = ramp(time, 2.93, 2.97);
    const leave = ramp(time, 3, 3.18);
    return {
      forward: (1 - numeric) * ramp(time, 2.48, 2.50), numeric: numeric - inverse, inverse: inverse - compact, compact,
      sourceFocus: ramp(time, 2.50, 2.54) * (1 - ramp(time, 2.58, 2.62)),
      shiftFocus: ramp(time, 2.58, 2.62) * (1 - ramp(time, 2.74, 2.78)),
      destinationFocus: ramp(time, 2.74, 2.78) * (1 - ramp(time, 2.83, 2.87)),
      lookupFocus: ramp(time, 2.83, 2.90) * (1 - leave),
      lookupDetail: compact * (1 - leave),
      sourceLabels: ramp(time, 2.50, 2.55) * (1 - leave),
    };
  }
  function createLesson(options = {}) {
    if (options.pipeline && !options.capture) throw new Error('注入重建结果时必须同时提供对应的采集数据。');
    const capture = options.capture || A.capture({ sample: 'star-points', directions: 3, m: .8, noise: 'none' });
    const pipeline = options.pipeline || A.pipeline(capture.raw, capture.calibration, {}, .8);
    if (!pipeline.ok) throw new Error('SIM lesson reconstruction failed: ' + pipeline.reason);
    if (pipeline.n !== capture.raw.n || pipeline.groups.length !== capture.raw.groups.length || pipeline.raw.groups.some((g, i) =>
      g.index !== capture.raw.groups[i].index || g.frames.some((frame, j) => frame.pixels !== capture.raw.groups[i].frames[j]?.pixels))) {
      throw new Error('重建结果必须来自同一份采集帧，不能混用另一组数据。');
    }
    const emissionSpectrum = A.spectrum(capture.truth.emission[0][0]);
    const detection = { emission: capture.truth.emission[0][0], detected: capture.raw.groups[0].frames[0].pixels,
      transfer: Float64Array.from({ length: A.N ** 2 }, (_, i) => A.otf(A.bin(i % A.N), A.bin(Math.floor(i / A.N)))),
      spatialMaximum: 1 + capture.truth.m };
    const exposures = capture.raw.groups[0].frames;
    const acquisition = {
      mean: Float64Array.from(detection.detected, (_, i) => exposures.reduce((total, frame) => total + frame.pixels[i] / 3, 0)),
      cosine: Float64Array.from(detection.detected, (_, i) => exposures.reduce((total, frame) => total + 2 / 3 * frame.pixels[i] * Math.cos(frame.phase), 0)),
      sine: Float64Array.from(detection.detected, (_, i) => exposures.reduce((total, frame) => total + 2 / 3 * frame.pixels[i] * Math.sin(frame.phase), 0)),
      maximum: detection.spatialMaximum,
    };
    const encodingCopies = orders.map(order => A.shift(capture.truth.spectrum, -order * 8, 0));
    const encoding = orders.map((order, b) => {
      const shifted = encodingCopies[b], a = order === 0 ? 1 : .4;
      return { re: Float64Array.from(shifted.re, v => v * a), im: Float64Array.from(shifted.im, v => v * a) };
    });
    const length = pipeline.numerator.re.length;
    let sum = { re: new Float64Array(length), im: new Float64Array(length) };
    const records = pipeline.bands.map(band => {
      const before = sum;
      sum = { re: Float64Array.from(before.re, (v, i) => v + band.matched.re[i]), im: Float64Array.from(before.im, (v, i) => v + band.matched.im[i]) };
      return { band, before, after: sum };
    });
    const reciprocal = Float64Array.from(pipeline.regularizedDenominator, d => d > 1e-14 ? 1 / d : 0);
    const qIndex = A.idx(14, 0, pipeline.spectrumSize), qTruth = A.idx(14, 0, A.N);
    const amplitude = (z, i) => Math.hypot(z.re[i], z.im[i]) / A.N ** 2;
    const truthAmplitude = amplitude(capture.truth.spectrum, qTruth), outputAmplitude = amplitude(pipeline.spectrum, qIndex);
    const phaseError = Math.atan2(pipeline.spectrum.im[qIndex] * capture.truth.spectrum.re[qTruth] - pipeline.spectrum.re[qIndex] * capture.truth.spectrum.im[qTruth], pipeline.spectrum.re[qIndex] * capture.truth.spectrum.re[qTruth] + pipeline.spectrum.im[qIndex] * capture.truth.spectrum.im[qTruth]) * 180 / Math.PI;
    const rmse = pixels => Math.sqrt(pixels.reduce((s, value, i) => s + (value - capture.truth.sample[i]) ** 2, 0) / pixels.length);
    const audit = { truthAmplitude, outputAmplitude, ratio: outputAmplitude / truthAmplitude, phaseError, widefieldAmplitude: A.otf(14, 0) * truthAmplitude, widefieldRMSE: rmse(capture.truth.widefield), simRMSE: rmse(pipeline.pixels) };
    // Compare three actual exposure states at one fixed specimen pixel.
    // The UI selects these records directly, never interpolating the phase.
    const point = { x: 100, y: 80 }, pointIndex = A.idx(point.x, point.y);
    const excitation = { point, period: A.N / A.VECTORS[0][0], m: capture.truth.m, sample: capture.truth.sample[pointIndex],
      frames: capture.raw.groups[0].frames.map((frame, j) => ({
        index: j, phase: frame.phase, label: phaseLabels[j],
        illumination: capture.truth.illumination[0][j], emission: capture.truth.emission[0][j],
        localIllumination: capture.truth.illumination[0][j][pointIndex], localEmission: capture.truth.emission[0][j][pointIndex],
      })),
    };
    return { capture, pipeline, probe: A.probe(pipeline, 0, 6, 0), group: pipeline.groups[0], encodingCopies, encoding, emissionSpectrum, detection, acquisition, records, reciprocal, audit, excitation };
  }
  function sample(time) {
    const t = clamp(time, 0, 6), derivation = demixState(t + DEMIX_START + (t > 3 ? 1 : 0));
    const reveal = ramp(t, 1, 1.12);
    const bands = derivation.bands, shifted = ramp(t, 4, 5), focus = ramp(t, 5, 6);
    return {
      ...derivation, t, reveal, bands, shifted, focus, spectrum: ramp(t, 0, 1),
      frames: orders.map((_, i) => ({
        x: lerp(360 + i * 360, 125, reveal), y: lerp(250, 155 + i * 155, reveal),
        scale: lerp(1, .36, reveal), opacity: (1 - focus) * (1 - bands * .25),
      })),
      sources: orders.map((order, i) => ({
        x: lerp(430 + i * 350, i === 2 ? 960 : 355, focus),
        y: lerp(250, i === 2 ? 257 : 125 + i * 268, focus),
        scale: lerp(1, i === 2 ? 1.4 : .65, focus),
        opacity: reveal * lerp(1, i === 2 ? 1 : .40, focus),
        offset: -order * 8 * shifted, detector: 6, specimen: 6 - order * 8 * shifted,
      })),
    };
  }
  function story(time) {
    const t = stageTime(clamp(time, 0, scenes.length - 1)), encodingSum = encodingSumState(time).opacity, detection = detectionState(time).opacity, acquisition = acquisitionState(time);
    return { t: time, stageTime: t, demixTime: clamp(legacyTime(time) - DEMIX_START, 0, 6), encodingSum, detection,
      intro: Math.max(0, 1 - acquisition.handoff - encodingSum - detection), demix: acquisition.handoff * (1 - ramp(t, 12, 13)),
      coverage: ramp(t, 12, 13) * (1 - ramp(t, 15, 16)),
      fusion: ramp(t, 15, 16) * (1 - ramp(t, 20, 21)), comparison: ramp(t, 20, 21),
      support: ramp(t, 13, 14), extraDirections: ramp(t, 14, 15),
    };
  }
  function fusionFrame(lesson, time) {
    const p = lesson.pipeline, t = clamp(stageTime(time), 15, 20), complex = (from, to = from, mix = 0) => ({ kind: 'complex', from, to, mix: clamp(mix) });
    const scalar = (values, log = false) => ({ kind: 'scalar', values, log });
    if (t <= 16) {
      const band = p.bands[2];
      return { phase: 'match', index: 2, views: [complex(band.shifted), scalar(band.h), complex(band.shifted, band.matched, ramp(t, 15, 16))] };
    }
    if (t <= 17) {
      const position = (t - 16) * lesson.records.length, index = Math.min(lesson.records.length - 1, Math.floor(position));
      const local = t === 17 ? 1 : position - index, record = lesson.records[index];
      return { phase: 'sum', index, local, views: [complex(record.band.shifted), complex(record.band.shifted, record.band.matched, smooth(local * 2)), complex(record.before, record.after, smooth(local * 2 - 1))] };
    }
    if (t <= 18) return { phase: 'wiener', index: -1, views: [complex(p.numerator), scalar(lesson.reciprocal, true), complex(p.numerator, p.preApoSpectrum, ramp(t, 17, 18))] };
    if (t <= 19) return { phase: 'apodization', index: -1, views: [complex(p.preApoSpectrum), scalar(p.apodization), complex(p.preApoSpectrum, p.spectrum, ramp(t, 18, 19))] };
    return { phase: 'inverse', index: -1, views: [complex(p.spectrum), scalar(p.apodization), complex(p.spectrum)] };
  }
  function pixel(view, index) {
    if (view.kind === 'scalar') return { re: view.values[index], im: 0 };
    return { re: lerp(view.from.re[index], view.to.re[index], view.mix), im: lerp(view.from.im[index], view.to.im[index], view.mix) };
  }
  /* No independent element clocks: every visual is a pure function of time.
   * Scrubbing, reversing and jumping all sample exactly the same state. */
  function createPlayer(options = {}) {
    const request = options.request || requestAnimationFrame;
    const cancel = options.cancel || cancelAnimationFrame;
    const notify = options.render || (() => {});
    const durations = options.durations || transitionDurations;
    if (!Array.isArray(durations) || !durations.length || durations.some(v => !Number.isFinite(v) || v <= 0)) throw new Error('播放时长必须是正数。');
    const lastStop = durations.length;
    // A host may pass the composed story's durations without passing pacing.
    // Retain the reading holds for matching intervals in that case. Explicit
    // pacing (including {}) and unrelated custom durations keep their meaning.
    const pacing = options.pacing ?? Object.fromEntries(Object.entries(transitionPacing)
      .filter(([index, points]) => durations[index] === points.at(-1)[1]));
    for (const [key, points] of Object.entries(pacing)) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= lastStop || !Array.isArray(points) || points.length < 2 ||
        points.some((point, i) => !Array.isArray(point) || point.length !== 2 || point.some(v => !Number.isFinite(v)) ||
          (i > 0 && (point[0] <= points[i - 1][0] || point[1] <= points[i - 1][1]))) ||
        points[0][0] !== 0 || points[0][1] !== 0 || points.at(-1)[0] !== 1 || points.at(-1)[1] !== durations[index])
        throw new Error('分段播放时序必须递增，并覆盖完整步骤时长。');
    }
    let position = 0, target = 0, playing = false, frame = 0, last = null, speed = 1;
    let jumpMotion = null;
    let reduced = !!options.reducedMotion;
    const state = () => ({ position, target, playing, jumping: jumpMotion !== null, speed, reduced, last: lastStop });
    const emit = () => notify(state());
    function stop() { if (frame) cancel(frame); frame = 0; last = null; playing = false; }
    function play() { playing = true; last = null; frame = request(tick); emit(); }
    function tick(now) {
      frame = 0;
      if (!playing) return;
      if (last !== null) {
        const elapsed = Math.max(0, now - last);
        if (jumpMotion) {
          // Direct navigation has a bounded wall-clock duration. It crosses
          // the same reversible playhead with easing, independent of the
          // per-scene teaching durations and the user's playback speed.
          jumpMotion.elapsed = Math.min(jumpMotion.duration, jumpMotion.elapsed + elapsed);
          position = lerp(jumpMotion.from, target, smooth(jumpMotion.elapsed / jumpMotion.duration));
        } else {
          let milliseconds = Math.min(64, elapsed) * speed;
          const direction = Math.sign(target - position);
          while (milliseconds > 0 && Math.abs(target - position) > 1e-9) {
            const index = direction > 0 ? Math.floor(position + 1e-9) : Math.ceil(position - 1e-9) - 1;
            let boundary = direction > 0 ? Math.min(target, index + 1) : Math.max(target, index);
            let duration = durations[clamp(index, 0, durations.length - 1)];
            const points = pacing[index];
            if (points) {
              const local = position - index;
              let section = direction > 0 ? 0 : points.length - 2;
              if (direction > 0) while (section < points.length - 2 && local >= points[section + 1][0] - 1e-9) section++;
              else while (section > 0 && local <= points[section][0] + 1e-9) section--;
              const a = points[section], b = points[section + 1];
              duration = (b[1] - a[1]) / (b[0] - a[0]);
              boundary = direction > 0 ? Math.min(boundary, index + b[0]) : Math.max(boundary, index + a[0]);
            }
            const remaining = Math.abs(boundary - position) * duration;
            if (milliseconds >= remaining) { position = boundary; milliseconds -= remaining; }
            else { position += direction * milliseconds / duration; milliseconds = 0; }
          }
        }
        if (Math.abs(target - position) < 1e-9) { position = target; jumpMotion = null; stop(); }
      }
      if (playing) { last = now; frame = request(tick); }
      emit();
    }
    function go(value, { quick = false } = {}) {
      if (!Number.isFinite(value)) return false;
      stop(); jumpMotion = null; target = clamp(value, 0, lastStop);
      if (reduced || Math.abs(target - position) < 1e-9) { position = target; emit(); return true; }
      if (quick) jumpMotion = { from: position, elapsed: 0, duration: clamp(360 + 45 * Math.abs(target - position), 400, 1100) };
      play(); return true;
    }
    function jump(value) { return go(value, { quick: true }); }
    function navigate(direction) {
      if (playing || !direction) return false;
      const destination = direction > 0 ? Math.floor(position + 1e-8) + 1 : Math.ceil(position - 1e-8) - 1;
      return go(destination);
    }
    function seek(value) {
      if (!Number.isFinite(value)) return;
      stop(); jumpMotion = null; position = target = clamp(value, 0, lastStop); emit();
    }
    function pause() { stop(); emit(); }
    function toggle() {
      if (playing) pause();
      else if (Math.abs(position - target) > 1e-8) play();
      else navigate(1);
    }
    function setSpeed(value) { if (Number.isFinite(value) && value > 0) { speed = clamp(value, .25, 3); emit(); } }
    function setReducedMotion(value) { reduced = !!value; if (reduced) seek(target); else emit(); }
    return { state, go, jump, navigate, seek, pause, toggle, setSpeed, setReducedMotion, destroy() { stop(); jumpMotion = null; } };
  }
  function clickDirection(x, width, interactive = false, selectedText = false) {
    return interactive || selectedText || width <= 0 ? 0 : x < width / 2 ? -1 : 1;
  }
  const api = { scenes, chapters, sceneIds, parameterSlot, bandFormulas: F, DEMIX_START, orders, colors, phaseLabels, timelineGeometry, legacyTime, stageTime, sceneIndex, transitionDurations, transitionPacing, inverseEquations, inverseWeightTex, inverseState, sourceAnchors, sourceOriginState, sourceOriginPixel, demixState, encodingSumState, encodingSumPixel, detectionState, detectionPixel, acquisitionState, acquisitionPixel, createLesson, sample, story, encodingFormulaTokens, encodingFormulaKeyframes, encodingDerivationStages, encodingDerivationState, encodingFrame, encodingFormulaValues, encodingNotationState, fusionFrame, pixel, createPlayer, clickDirection, clamp, lerp, ramp };
  if (node) module.exports = api; else root.SIMMotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
