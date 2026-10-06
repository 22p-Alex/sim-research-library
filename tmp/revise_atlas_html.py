from pathlib import Path
import re
p=Path('sim_pipeline_atlas.html')
s=p.read_text()
s=s.replace('<title>2D-SIM · 全流程图版：从九帧原始图到拼接频谱</title>', '<title>SIM 重建图谱 · 从原始帧到超分辨图像</title>')
start=s.index('<header'); end=s.index('<div class="console"')
s=s[:start]+'''<a class="skip" href="#content">跳到正文</a>
<header class="topbar">
  <a class="brand" href="index.html"><span class="brand-mark">S</span><span>SIM <span class="brand-slash">/</span> 学习实验室</span></a>
  <nav aria-label="相关学习页面"><a href="sim_story.html">原理叙事</a><a href="sim_pipeline_atlas.html" aria-current="page">重建图谱</a><a href="sim_interactive_demo.html">交互模拟台 ↗</a><a href="hifi_sim_learning.html">HiFi-SIM ↗</a></nav>
</header>
<div class="layout">
<aside class="sidebar">
  <a class="back-link" href="index.html">← 返回资料库</a>
  <p class="nav-label">重建路线 <span>09 步</span></p>
  <nav class="stage-nav" aria-label="重建步骤">
    <p class="nav-group">A · 光学编码与采集</p>
    <a href="#b1" aria-current="step"><span>01</span> 样品与频谱</a><a href="#b2"><span>02</span> 结构光调制</a><a href="#b3"><span>03</span> 多相位采集</a>
    <p class="nav-group">B · 频率分离与归位</p>
    <a href="#b4"><span>04</span> 检查混合分量</a><a href="#b5"><span>05</span> 相移解混</a><a href="#b6"><span>06</span> 频带搬移</a>
    <p class="nav-group">C · 重建与验证</p>
    <a href="#b7"><span>07</span> 频谱支撑</a><a href="#b8"><span>08</span> 加权融合</a><a href="#b9"><span>09</span> 结果与对照</a>
  </nav>
  <div class="sidebar-note"><span class="note-label">阅读提示</span><p>先看每步的输入与输出，再展开公式推导。修改参数后，中间结果会同步更新。</p><a href="#experiment">调整实验条件 ↑</a><a href="#sources">符号与文献依据 ↘</a></div>
  <span class="local-badge"><i></i> 本地计算 · 可离线使用</span>
</aside>
<main id="content">
<section class="hero">
  <p class="eyebrow"><span></span> RECONSTRUCTION ATLAS <span class="edition">LINEAR 2D-SIM</span></p>
  <h1>从九帧原始图，<br>看见超分辨的每一步<span class="title-dot">。</span></h1>
  <p class="intro">结构光把高频信息编码进相机可见的范围；重建再把它们分离、归位、融合。<br class="desktop-break">沿着同一份数据，追踪图像、频谱与公式之间的对应关系。</p>
  <div class="hero-bottom"><div class="hero-meta"><span><b>3 × 3</b> 默认方向与相位</span><span><b>128²</b> 样品像素</span><span><b>9</b> 个可追踪步骤</span></div><a class="primary-link" href="#b1">开始阅读 <span>↓</span></a></div>
  <div class="route" aria-label="流程概览"><a href="#b2"><span>01 — 03</span><b>编码与采集</b><small>样品 → 多相位图像</small></a><span class="route-arrow">→</span><a href="#b5"><span>04 — 06</span><b>解混与搬移</b><small>混合频谱 → 独立频带</small></a><span class="route-arrow">→</span><a href="#b8"><span>07 — 09</span><b>融合与验证</b><small>扩展频谱 → 重建图像</small></a></div>
</section>
<section class="experiment" id="experiment" aria-labelledby="experiment-title">
  <div class="section-heading"><div><p class="eyebrow">LIVE EXPERIMENT</p><h2 id="experiment-title">实验条件</h2></div><button id="reset" class="text-button" type="button">↺ 恢复默认</button></div>
  <p class="section-note">从理想条件开始，再观察噪声、正则与参数偏差如何影响结果。</p>
  <div class="presets" role="group" aria-label="对照实验"><span>快速对照</span><button type="button" data-preset="ideal" aria-pressed="true">理想重建</button><button type="button" data-preset="direction" aria-pressed="false">单方向采集</button><button type="button" data-preset="noise" aria-pressed="false">低计数 + 正则</button><button type="button" data-preset="mismatch" aria-pressed="false">角度失配 3°</button></div>
''' + s[end:]
s=s.replace('<div class="console" role="group" aria-label="实验条件">','<div class="console" role="group" aria-label="实验条件"><fieldset><legend><span>01</span> 采集参数</legend><div class="control-grid">')
s=s.replace('（默认）','').replace('三方向细条纹（旧对照）','三方向细条纹').replace('采集方向<select','方向与相位<select').replace('计数噪声<select','相机噪声<select')
s=s.replace('  <label>调制度来源', '</div></fieldset><fieldset><legend><span>02</span> 重建参数</legend><div class="control-grid reconstruction-controls">\n  <label>调制度来源')
s=s.replace('已知真值（教学对照）','已知 m（理想对照）').replace('从 raw 估计','从采集帧估计 m')
s=s.replace('  <details>\n    <summary>注入参数失配（只改重建，不重新采集）</summary>', '</div></fieldset>\n  <details class="advanced">\n    <summary>参数失配实验 <span>相位 / 角度 / 调制度 / OTF</span></summary><p class="section-note">固定采集数据，只改变重建采用的参数；选择作用范围可比较估计器的可靠性筛查。</p>')
s=re.sub(r'<label>([^<>]+) <output id="(o-[^"]+)">([^<]+)</output>',lambda m:f'<label><span>{m[1]} <output id="{m[2]}" for="{m[2].replace("o-","c-")}">{m[3]}</output></span>',s)
s=s.replace('照明真值 m','照明调制度 m').replace('正则 ε','正则参数 ε')
s=s.replace('<p class="statusline" id="status" aria-live="polite"></p>', '''<div class="statusline" id="status" role="status" aria-live="polite"></div></section>
<div class="view-settings"><div><b>统一读图</b><span>蓝虚线：检测截止 · 绿虚线：名义最大扩展 · 黄十字：照明波矢</span></div><label>频谱视野<select id="c-view"><option value="24">放大中心 ±24 格</option><option value="64">完整频谱 ±64 格</option></select></label></div>''')
# Stage data: title, kicker, note, description, input / action / output.
stages=[
('样品与它的频谱','SPECIMEN · 起点','空域 ↔ 频域','先辨认想恢复的结构。西门子星由外向内越来越密，用同一张样品观察宽场与 SIM 的频率覆盖范围。点对提供另一种直观对照。',['样品 s(r)','傅里叶变换','样品频谱 S(f)']),
('结构光调制，带来差频信息','ILLUMINATION · 编码','尚未经过物镜','照明与样品在空域相乘，产生和频与差频分量。可以把条纹想成一把移动的刻度尺：细结构与刻度相互作用，形成相机更容易记录的粗包络。',['样品 + 条纹照明','空域相乘','受调制的发射强度']),
('多相位采集，保留解混的线索','ACQUISITION · 观测','3 方向 × 3 相位 = 9 帧','物镜模糊受调制的发射光，相机再引入噪声。每个方向的三帧只改变相位，三个频谱分量的位置不变，复权重改变。无噪声时，<b>它们都被限制在同一个检测通带内</b>。',['受调制的发射光','PSF 卷积 + 相机采样','多相位观测 D']),
('一个检测点，混着三个样品频率','FREQUENCY PROBE · 交互检查','点击频谱 · 方向键微调','选定检测频率 f，三次相移给出同一组三个未知量的不同组合。点击左图，追踪每个分量分离后应当回到哪个样品频率 q。',None),
('用三次相移，分离三个级次','DEMIXING · 分离','0 / +1 / −1','每个检测频率处求解一个 3 × 3 线性系统。先看幅度，确认频率成分被分开；再看相位，观察结构位置信息。<b>三个级次的频谱一般都是复数</b>。',['三个相位的频谱','相移矩阵求逆','独立频带 A<sub>ℓ</sub>(f)']),
('把副本搬回真实的样品频率','RELOCATION · 归位','检测坐标 f → 样品坐标 q','分离只回答“它属于哪个级次”，搬移才回答“它原来在哪里”。按本页符号约定，+1 级沿 −k<sub>d</sub> 搬移，−1 级沿 +k<sub>d</sub> 搬移，OTF 也必须同步归位。',['A<sub>ℓ</sub>(f)','q = f − ℓk<sub>d</sub>','C<sub>ℓ</sub>(q) 与 T<sub>ℓ</sub>(q)']),
('多个方向，补齐频率覆盖','SPECTRAL SUPPORT · 覆盖','支撑域 ≠ 恢复质量','一个方向贡献两侧频带；多个方向扩大覆盖范围。中图按方向混色表示理论几何支撑，右图显示实际用于融合的信息权重。即使位于几何支撑内，信号过弱也未必能稳定恢复。',None),
('加权融合，在细节与噪声间取舍','WEIGHTED FUSION · 重建','广义 Wiener 形式','各频带像多次测量同一个量：传递强、噪声小的观测贡献更大。正则参数 ε 抑制弱传递处的过度反演；增大它，也会压低这些位置的真实细节。',None),
('回到图像，检查恢复了什么','VALIDATION · 对照','逆 FFT → 定量比较','把融合频谱变回图像，与样品真值和无噪声宽场参考比较。既看细节是否可辨，也看误差与噪声；更强的局部对比度本身不等于更准确的重建。',None)]
for i,(title,kicker,note,lede,flow) in enumerate(stages,1):
    pat=rf'(<section class="band" id="b{i}">).*?<div class="(?:strip|probe-wrap)"'
    match=re.search(pat,s,re.S)
    head=f'<section class="band" id="b{i}">\n<div class="band-head"><span class="no">{i:02}</span><div><p class="stage-kicker">{kicker}</p><h2>{title}</h2></div><span class="aside"'+(' id="frame-count"' if i==3 else '')+f'>{note}</span></div>\n<p class="lede">{lede}</p>\n'
    if flow: head+='<div class="step-flow">'+'<i>→</i>'.join(f'<span>{label} <b>{value}</b></span>' for label,value in zip(['输入','操作','输出'],flow))+'</div>\n'
    if i==4: head+='''<div class="inspect-controls"><label>检查方向<select id="c-inspect"><option value="0">方向 1 · 0°</option><option value="1">方向 2 · 60.3°</option><option value="2">方向 3 · 119.7°</option></select></label><span>同步用于步骤 04—07</span><button class="text-button" id="probe-reset" type="button">定位到通带内</button></div>\n'''
    orig=match[0]; suffix=re.search(r'<div class="(?:strip|probe-wrap)"$',orig)[0]
    s=s[:match.start()]+head+suffix+s[match.end():]
s=s.replace('<div class="callout" id="c1">','<div class="zone-legend" id="zones"></div><div class="callout" id="c1">')
s=s.replace('class="strip" id="s3','class="strip acquisition" id="s3')
s=s.replace('<div class="callout" id="c5">','<div class="phase-key"><span>相位色相</span><i></i><span>0 → 2π</span><small>幅度低于本图最大值 2% 的位置隐藏相位</small></div><div class="callout" id="c5">')
def formula(tex): return '<div class="formula" data-tex="'+tex+'"></div>'
def derivation(title,body): return '<details class="derivation"><summary>'+title+'</summary>'+body+'</details>'
def append_stage(i,html):
    global s
    pat=rf'(<section class="band" id="b{i}">.*?)(</section>)'
    s=re.sub(pat,lambda m:m[1]+html+'\n'+m[2],s,count=1,flags=re.S)
append_stage(1,derivation('为什么星形图能帮助理解分辨率？','<p>本样品的角向调制为 cos(16θ)，半径 r 处一周有 16 个周期，因此局部弧长周期近似为：</p>'+formula(r'p(r)=\frac{2\pi r}{16},\qquad p_{\mathrm{WF}}=\frac{128}{10}=12.8\ \mathrm{px},\quad p_{\mathrm{SIM,nom}}\approx\frac{128}{18}=7.11\ \mathrm{px}')+'<p>有限样品具有频谱展宽，实际支撑也随方向变化，不能把两个半径当作严格的可分辨判据。<a href="#source-model">模型说明 ↗</a></p>'))
append_stage(2,derivation('展开照明公式与频谱搬移关系',formula(r'I_{d,j}(\mathbf r)=1+m\cos(2\pi\mathbf k_d\cdot\mathbf r+\phi_j)')+formula(r'\mathcal F\{sI_{d,j}\}(\mathbf f)=S(\mathbf f)+\frac m2e^{i\phi_j}S(\mathbf f-\mathbf k_d)+\frac m2e^{-i\phi_j}S(\mathbf f+\mathbf k_d)')+'<p>余弦展开为两个复指数，再使用傅里叶调制定理，得到三个分量。此时尚未乘上检测 OTF。<a href="#source-review">依据 [1] ↗</a></p>'))
append_stage(3,'<p class="figure-note">上组：扣除已知背景并归一化的采集帧。下组：对应频谱，位置一一对应；通带外亮点可能来自噪声。频谱幅度按各图最大值取对数归一化，用于看形状。</p>'+derivation('从空域成像方程到频域观测',formula(r'd_{d,j}(\mathbf r)=[s(\mathbf r)I_{d,j}(\mathbf r)]*h(\mathbf r)+n_{d,j}(\mathbf r)')+formula(r'D_{d,j}(\mathbf f)=H(\mathbf f)\sum_{\ell=-1}^{1}a_\ell e^{i\ell\phi_j}S(\mathbf f-\ell\mathbf k_d)+N_{d,j}(\mathbf f)')+'<p>a₀ = 1，a₊₁ = a₋₁ = m/2。H(f) 乘在整个混合和上；扩展后的“六瓣”要到频带归位后才出现。<a href="#source-review">依据 [1] ↗</a></p>'))
append_stage(5,derivation('展开相移矩阵与等间隔解混公式',formula(r'\begin{bmatrix}D_0\\D_1\\D_2\end{bmatrix}=\begin{bmatrix}1&e^{i\phi_0}&e^{-i\phi_0}\\1&e^{i\phi_1}&e^{-i\phi_1}\\1&e^{i\phi_2}&e^{-i\phi_2}\end{bmatrix}\begin{bmatrix}A_0\\A_{+1}\\A_{-1}\end{bmatrix}')+formula(r'\phi_j=\frac{2\pi j}{3}\ \Longrightarrow\ A_\ell(\mathbf f)=\frac13\sum_{j=0}^{2}D_j(\mathbf f)e^{-i\ell\phi_j},\quad A_\ell=a_\ell H(\mathbf f)S(\mathbf f-\ell\mathbf k_d)')+'<p>m/2 保留在一级频带中，之后由融合传递 T 处理。实值图像的傅里叶变换满足共轭对称 S(−f) = S(f)*，并不要求每个频率值都是实数。<a href="#source-review">依据 [1] 与傅里叶共轭对称性 ↗</a></p>'))
append_stage(6,derivation('为什么数据与 OTF 必须一起搬移？',formula(r'C_\ell(\mathbf q)=A_\ell(\mathbf q+\ell\mathbf k_d)=\underbrace{a_\ell H(\mathbf q+\ell\mathbf k_d)}_{T_\ell(\mathbf q)}S(\mathbf q)')+'<p>由 q = f − ℓk<sub>d</sub> 代回即可。搬回后的数据仍带着原检测位置的衰减，不能直接当作无衰减的样品频谱。<a href="#source-review">依据 [1] ↗</a></p>'))
append_stage(7,'<p class="figure-note">左图颜色表示级次：零级紫灰、+1 红、−1 绿。中图颜色表示方向：方向 1 红、2 绿、3 蓝，重叠处混色。右图红线表示采用参数与有效频带对应的连续支撑边界。</p>')
s=s.replace('<div class="strip" id="s8">','<div class="equation"><span>融合公式</span>'+formula(r'\widehat S(\mathbf q)=\frac{\sum_b w_bT_b^*(\mathbf q)C_b(\mathbf q)}{\underbrace{\sum_b w_b|T_b(\mathbf q)|^2}_{W(\mathbf q)}+\varepsilon^2}')+'<a href="#source-review">[1]</a></div><div class="strip" id="s8">')
append_stage(8,'<p class="figure-note">绿色曲线为理想匹配条件下的等效传递 G = W / (W + ε²)。参数失配时，输出包含错误归位的分量，不能用这条曲线预测全部伪影。</p>'+derivation('从加权最小二乘推导融合与等效传递',formula(r'\widehat S=\underset{S}{\arg\min}\left[\sum_b w_b|C_b-T_bS|^2+\varepsilon^2|S|^2\right]')+'<p>对 S* 求导并令导数为零，得到融合式。无噪声且参数匹配时，代入 C<sub>b</sub> = T<sub>b</sub>S：</p>'+formula(r'\widehat S=G S,\qquad G(\mathbf q)=\frac{W(\mathbf q)}{W(\mathbf q)+\varepsilon^2}')+'<p>ε = 0 时，在有信息且未触发数值阈值的位置 G = 1；支撑之外的频率仍不能恢复。这里采用相对平均噪声方差权重，忽略频带间噪声相关，没有额外切趾窗。<a href="#source-model">实现边界 ↗</a></p>'))
append_stage(9,'<p class="figure-note">图像统一显示 [0, 1]；误差图蓝色为负、白色为零、红色为正，范围 ±0.2。RMSE 使用未截断数据。宽场是无噪声光学参考，不是与 SIM 等光子预算的性能比较。</p>'+derivation('误差与环向对比度如何计算？',formula(r'\mathrm{RMSE}=\sqrt{\frac1{N^2}\sum_{\mathbf r}(\widehat s-s)^2},\qquad c(r)=\frac{\sigma_\theta[\widehat s(r,\theta)]}{\max(10^{-9},\mu_\theta[\widehat s(r,\theta)])}')+'<p>环向对比度受样品包络、采样与噪声影响，不等同于 OTF，也不直接给出分辨率。点对样品改看强度剖面；细条纹样品只展示图像与 RMSE。</p>'))
start=s.index('<details class="sources"');end=s.index('<script src="vendor')
s=s[:start]+'''<details class="sources" id="sources">
<summary><span>继续深入</span> 公式依据、符号与模型边界 <b>＋</b></summary>
<div class="body"><h3>统一符号</h3>
<dl class="symbols"><dt>s(r) / S(f)</dt><dd>样品强度 / 其傅里叶变换</dd><dt>f / q</dt><dd>检测频率 / 搬移后的样品频率</dd><dt>k<sub>d</sub> / φ<sub>j</sub></dt><dd>照明波矢 / 第 j 帧相位</dd><dt>A<sub>ℓ</sub> / C<sub>ℓ</sub></dt><dd>解混后的频带 / 搬回后的频带</dd><dt>H / T<sub>ℓ</sub></dt><dd>检测 OTF / 含调制度的搬移后传递</dd><dt>w<sub>b</sub> / ε</dt><dd>噪声权重 / 正则参数</dd></dl>
<h3 id="source-model">模型与显示约定</h3>
<p>本页是标准线性 2D-SIM 教学模拟，采用二维、线性、移不变与周期边界模型，不是 HiFi-SIM 算法复现。照明平均强度为 1；已知照明波矢、相位和检测 OTF，仅提供 m 的估计选项。</p>
<p>傅里叶变换采用负指数。公式频率以 cycles/pixel 表示；图中坐标以 DFT 格表示，1 格 = 1/128 cycles/pixel，x 向右、y 随像素行向下。探针复数除以 N² 便于阅读，融合使用未缩放 FFT。</p>
<p>照明波矢取整数 DFT 格 (8, 0)、(4, 7)、(−4, 7)，角度约 0° / 60.3° / 119.7°。检测截止 10 格，最大扩展约 18—18.06 格，方向间存在覆盖差异；绿虚线是 18 格的名义参考。参数失配的非整数搬移通过空域复指数调制实现。</p>
<p>噪声模式包含泊松计数噪声、背景 B = 5 与读出噪声 σ = 2（电子）；Q 是单位归一化强度对应的电子计数尺度。权重按方向平均噪声与解混系数方差设置，不是完整广义最小二乘。</p>
<p>启用 m 估计时，若失配同时进入估计器，可靠性筛查可能弃用一级频带；已知 m 模式不会由该筛查弃用。样品真值不进入重建；“已知 m”模式显式使用照明调制度真值作理想对照。</p>
<h3 id="source-review">[1] 主要文献</h3>
<p>Chen et al. (2023), <a href="https://doi.org/10.1038/s41377-023-01204-4" target="_blank" rel="noopener">Superresolution structured illumination microscopy reconstruction algorithms: a review</a>，式 (1)—(9)。本页按同一成像与融合框架统一符号；最小二乘推导与读图指标在本页明确给出。</p>
<div class="source-links"><a href="SIM综述/Superresolution%20structured%20illumination%20microscopy%20reconstruction%20algorithms.pdf" target="_blank" rel="noopener">阅读本地原文 ↗</a><a href="知识库/02-统一成像模型与SIM分类预览.html">统一成像模型 ↗</a><a href="知识库/03-传统重建与参数估计预览.html">重建与参数估计 ↗</a></div>
</div></details>
<footer><span>SIM 学习实验室 / 重建图谱</span><span>线性 2D 模型 · 中间结果均来自当前计算</span><a href="#content">回到顶部 ↑</a></footer>
</main></div>
''' + s[end:]
p.write_text(s)
