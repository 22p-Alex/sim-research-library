from pathlib import Path
p=Path('sim_pipeline_atlas.html');s=p.read_text()
s=s.replace('加权融合</a>', 'Wiener 融合</a>')
s=s.replace('从理想条件开始，再观察噪声、正则与参数偏差如何影响结果。', '采集端模拟相机噪声；重建端对照 fairSIM 的二维 Wiener 路径。先看无噪声基线，再改变参数。')
s=s.replace('>理想重建</button>', '>无噪声基线</button>')
s=s.replace('>已知 m（理想对照）</option>', '>校准 m（已知参数）</option>').replace('>从采集帧估计 m</option>', '>外部估计 m（教学模块）</option>')
s=s.replace('正则参数 ε', 'Wiener 参数 w').replace('id="o-eps" for="c-eps">0</output>', 'id="o-eps" for="c-eps">0.05</output>').replace('step="0.005" value="0"', 'step="0.005" value="0.05"')
s=s.replace('</div></fieldset>\n  <details class="advanced">', '''  <label><span>切趾截止 / 检测截止 <output id="o-apo" for="c-apo">1.9</output></span><input id="c-apo" type="range" min="1.2" max="2.2" step="0.1" value="1.9"></label>
  <label><span>切趾指数 β <output id="o-bend" for="c-bend">0.8</output></span><input id="c-bend" type="range" min="0.2" max="1.5" step="0.1" value="0.8"></label>
</div></fieldset>
  <details class="advanced">''')
s=s.replace('选择作用范围可比较估计器的可靠性筛查。', '“外部估计”属于本页教学模块；重建采用的 m 超出 [0.4, 1.1] 时，按 fairSIM 回退到 0.65。')
s=s.replace('同步用于步骤 04—07', '同步用于步骤 04—07 · m/2 在解混时补偿')
s=s.replace('仍带 OTF 与调制度衰减。', '调制度已补偿，仍带 OTF 衰减。')
s=s.replace('把保留了 OTF 与调制度的三个频带记作', '按 fairSIM 的分离约定，把已经补偿调制度、仍保留 OTF 的三个频带记作')
s=s.replace(r'D_j=\sum_{h=-1}^{1}e^{ih\phi_j}A_h+N_j,\qquad A_h(\mathbf f)=a_h H(\mathbf f)S(\mathbf f-h\mathbf k_d)', r'D_j=\sum_{h=-1}^{1}a_he^{ih\phi_j}A_h+N_j,\qquad A_h(\mathbf f)=H(\mathbf f)S(\mathbf f-h\mathbf k_d)')
s=s.replace(r'\widehat A_\ell=\frac13\sum_{j=0}^{2}e^{-i\ell\phi_j}D_j=\sum_{h=-1}^{1}\left[\frac13\sum_{j=0}^{2}e^{i(h-\ell)\phi_j}\right]A_h+\widetilde N_\ell', r'\widehat A_\ell=\frac{1}{3a_\ell}\sum_{j=0}^{2}e^{-i\ell\phi_j}D_j=\sum_{h=-1}^{1}\frac{a_h}{a_\ell}\left[\frac13\sum_{j=0}^{2}e^{i(h-\ell)\phi_j}\right]A_h+\widetilde N_\ell')
s=s.replace('实际实现使用当前采用相位的矩阵逆，因此注入相位偏差后，下方系数也随之改变。', 'a₀ = 1，a±₁ = m/2。与 fairSIM 一样，分离矩阵同时包含相位与调制度，再求逆；下方系数随采用参数改变。')
s=s.replace('依据 [1] 的相移分离模型 ↗', '依据 [1] 的模型；fairSIM 源码见页末 [2] ↗')
s=s.replace(r'\underbrace{a_\ell H(\mathbf q+\ell\mathbf k_d)}_{T_\ell(\mathbf q)}', r'\underbrace{H(\mathbf q+\ell\mathbf k_d)}_{H_\ell(\mathbf q)}')
s=s.replace('C<sub>ℓ</sub>(q) 与 T<sub>ℓ</sub>(q)', 'C<sub>ℓ</sub>(q) 与 H<sub>ℓ</sub>(q)')
s=s.replace('由 q = f − ℓk<sub>d</sub> 代回即可。', '由 q = f − ℓk<sub>d</sub> 代回即可；m/2 已在步骤 04 的矩阵逆中补偿。频谱先填充到 256 × 256，再进行搬移，DFT 格距不变。')
s=s.replace('右图显示实际用于融合的信息权重。', '右图显示 fairSIM 实际累积的 OTF 平方分母。')
a=s.index('<section class="band" id="b8">');b=s.index('<details class="sources"',a)
s=s[:a]+r'''<section class="band" id="b8">
<div class="band-head"><span class="no">08</span><div><p class="stage-kicker">FAIRSIM · WIENER + APODIZATION</p><h2>先融合，再让频谱边缘平缓收尾</h2></div><a class="aside source-pill" href="#source-fairsim">源码依据 [2] ↗</a></div>
<p class="lede">解混时已补偿调制度。现在把归位频带乘共轭 OTF 后相加，用 Wiener 分母控制反演，再乘切趾窗。<b>第 4 张才是交给逆 FFT 的最终频谱。</b></p>
<div class="equation"><span>跟着源码算</span><div class="formula" data-tex="U=\sum_b H_b^*C_b,\qquad F_{\mathrm{pre}}=\frac{U}{D_{\mathrm{code}}+w^2},\qquad F_{\mathrm{out}}=A\,F_{\mathrm{pre}}"></div></div>
<div class="strip fusion-stages" id="s8"></div>
<p class="figure-note">频谱用 log(1 + 幅度) 显示；第 2、4 张共享亮度标尺，便于看切趾实际压低了什么。第 3 张是 0—1 的实数窗。计算保留完整复数，不对对数图做逆 FFT。</p>
<div class="frequency-inspector"><label for="c-fusion-q">选一个水平频率，看它怎样算出最终幅度 <span>q<sub>x</sub> = <output id="o-fusion-q">12</output> 格</span></label><input id="c-fusion-q" type="range" min="0" max="20" step="1" value="12"><div id="fusion-readout" aria-live="polite"></div></div>
<details class="derivation" id="fusion-transfer"><summary>看传递曲线：哪些频率被保留，切趾又压低了多少？</summary>
<p>这三条线比较理想参数匹配时的幅度传递。横轴越往右，结构越细；竖虚线是宽场截止 10 格。拖动上方频率滑块可移动橙色标记。</p><div id="s8-transfer"></div>
<div class="formula" data-tex="Q(\mathbf q)=\sum_b|H_b(\mathbf q)|^2,\qquad G_{\mathrm{pre}}=\frac{Q}{D_{\mathrm{code}}+w^2},\qquad G_{\mathrm{out}}=A\,G_{\mathrm{pre}}"></div>
<p>这是信号的幅度保留比例，不是重建准确率；噪声、参数失配及 m 回退不由此曲线完整描述。固定版本的 fairSIM 分母中，零级 OTF 被累加两次，因此 Q 与 D<sub>code</sub> 不相等，w = 0 时也不能直接写 G = 1。</p></details>
<details class="derivation"><summary>核对源码：分母、切趾窗与这三个操作</summary><div class="source-audit"><div id="s8-denominator"></div><div><p><b>WienerFilter.getDenominator</b> 返回分母的倒数，所以源码通过乘法完成相除。</p><pre><code>denom = wFilter.getDenominator(wienParam);
fullResult.times(denom);  // Wiener 后
fullResult.times(apo);    // 乘切趾窗
SimUtils.spatial(fullResult, clipScale);</code></pre><div class="formula" data-tex="D_{\mathrm{code}}=\sum_d\left(2|H_{d,0}|^2+|H_{d,+1}|^2+|H_{d,-1}|^2\right)"></div><p>这里保持原版本的级次计数，不另加逐频带噪声权重。相机噪声仍然来自步骤 03。</p></div></div>
<div class="formula" data-tex="A(\mathbf q)=h_{\mathrm{ideal}}\!\left(\frac{\|\mathbf q\|}{c_{\mathrm{apo}}k_c}\right)^\beta,\quad h_{\mathrm{ideal}}(u)=\frac2\pi\left(\arccos u-u\sqrt{1-u^2}\right)\quad(0\le u\le1)"></div><p>范围外 A = 0。本页默认 c<sub>apo</sub> = 1.9、β = 0.8，取自 fairSIM 的 StepByStep 示例；检测 OTF 使用理想圆瞳。<a href="#source-fairsim">固定配置与源码位置 ↗</a></p></details>
</section>

<section class="band" id="b9">
<div class="band-head"><span class="no">09</span><div><p class="stage-kicker">INVERSE FFT · IMAGE CHECK</p><h2>回到图像，沿同一条线比较结构</h2></div><span class="aside">256 × 256 输出</span></div>
<p class="lede">对切趾后的复数频谱做逆 FFT。先看结构，再用同一行的强度曲线核对峰位、峰间谷和幅度；真值只用于评价，未参与重建。</p>
<div class="strip" id="s9"></div>
<div class="profile-inspector"><label for="c-profile-y">橙色横线的位置 <span>y = <output id="o-profile-y">80</output> 个采集像素</span></label><input id="c-profile-y" type="range" min="0" max="127" step="1" value="80"><div id="s9c"></div></div>
<div class="callout" id="c9"></div>
<p class="figure-note">三张图使用同一 [0, 1] 亮度范围；误差图范围 ±0.2。曲线与 RMSE 使用未截断数据。宽场是无噪声光学参考，不是等光子预算的性能比较。</p>
<details class="derivation"><summary>输出尺寸、亮度标度与 RMSE 怎样对齐？</summary><div class="formula" data-tex="s_{\mathrm{native}}=\operatorname{Re}\mathcal F_{256}^{-1}\{F_{\mathrm{out}}\},\qquad s_{\mathrm{display}}=4s_{\mathrm{native}},\qquad \mathrm{RMSE}=\sqrt{\frac1{128^2}\sum_{x,y=0}^{127}[s_{\mathrm{display}}(2x,2y)-s(x,y)]^2}"></div><p>采集为 128 × 128，频域零填充后输出为 256 × 256，视野不变。FFT 逆变换的归一化随像素数变成四倍，所以仅乘固定因子 4 回到采集强度标度；这不是按真值拟合亮度。RMSE 取回原采集位置比较，不截断负值，也不强行补偿原实现的直流衰减。</p><p>细采样不等同于新增分辨率；能恢复的频率仍由采集支撑、噪声、参数与滤波决定。</p></details>
</section>

''' +s[b:]
s=s.replace('<dt>H / T<sub>ℓ</sub></dt><dd>检测 OTF / 含调制度的搬移后传递</dd><dt>w<sub>b</sub> / ε</dt><dd>噪声权重 / 正则参数</dd>', '<dt>H / H<sub>ℓ</sub></dt><dd>检测 OTF / 归位后 OTF（调制度已在解混时补偿）</dd><dt>w / A</dt><dd>Wiener 参数 / 切趾窗；A<sub>ℓ</sub> 则是分离频带</dd>')
s=s.replace('本页是标准线性 2D-SIM 教学模拟，采用二维、线性、移不变与周期边界模型，不是 HiFi-SIM 算法复现。照明平均强度为 1；已知照明波矢、相位和检测 OTF，仅提供 m 的估计选项。', '本页使用二维、线性、移不变与周期边界的采集模拟；重建核心按下列固定 fairSIM 版本移植为 JavaScript。波矢、相位与 OTF 由模拟标定提供；可选 m 估计仍是本页的外部教学模块，不是 fairSIM 的参数估计器。')
s=s.replace('图中坐标以 DFT 格表示，1 格 = 1/128 cycles/pixel', '图中坐标以 DFT 格表示，1 格 = 1/128 cycles/采集像素；填充到 256 后格距保持不变')
s=s.replace('权重按方向平均噪声与解混系数方差设置，不是完整广义最小二乘。', '噪声只在采集端注入；重建不使用旧版教学模型的逐频带噪声权重。')
s=s.replace('启用 m 估计时，若失配同时进入估计器，可靠性筛查可能弃用一级频带；已知 m 模式不会由该筛查弃用。样品真值不进入重建；“已知 m”模式显式使用照明调制度真值作理想对照。', '按照 SimParam.Dir.getModulations，采用 m 小于 0.4 或大于 1.1 时回退到 0.65（包括外部估计失败）。页面明确显示回退方向数；不采用旧版的弃带策略。“校准 m”只提供照明参数，样品真值不进入重建。')
s=s.replace('本页按同一成像与融合框架统一符号；最小二乘推导与读图指标在本页明确给出。', '用于解释采集与相移分离的物理模型；具体重建数值约定以下面的 fairSIM 源码为准。')
where='<h3 id="source-review">'
pos=s.index(where)
pin='https://github.com/fairSIM/fairSIM/blob/711afd12cb8c4fd4207bbca7ee7610c5aed4f732/src/main/java/org/fairsim/'
source=f'''<h3 id="source-fairsim">[2] fairSIM：固定源码与移植范围</h3>
<p>Müller et al. (2016), <a href="https://doi.org/10.1038/ncomms10980" target="_blank" rel="noopener">Open-source image reconstruction of super-resolution structured illumination microscopy data in ImageJ</a>。本页固定本地 develop 提交 <code>711afd12</code>，pom 版本 1.5.1；并非论文当年的版本快照。</p>
<p>使用二维 Wiener 分支、<code>otfBeforeShift=false</code>、理想 OTF（a=1，512 点查表插值）、关闭 OTF attenuation、圆对称切趾、输出不截断。默认 w=0.05、切趾截止 1.9、指数 0.8；不包含 RL 或 fairSIM 参数估计器。w=0 是额外教学实验，0/0 位置置零。</p>
<div class="table-scroll"><table class="source-table"><thead><tr><th>处理</th><th>固定源码</th><th>本页对应</th></tr></thead><tbody>
<tr><td>调制度补偿与矩阵逆</td><td><a href="{pin}sim_algorithm/BandSeparation.java#L80" target="_blank" rel="noopener">BandSeparation · L80–118</a></td><td>04—05</td></tr>
<tr><td>零填充、归位、OTF 加权</td><td><a href="{pin}sim_algorithm/SimAlgorithm.java#L610" target="_blank" rel="noopener">SimAlgorithm · L610–659</a></td><td>06—08</td></tr>
<tr><td>分母计数与正则</td><td><a href="{pin}sim_algorithm/WienerFilter.java#L49" target="_blank" rel="noopener">WienerFilter · L49–125</a></td><td>08</td></tr>
<tr><td>切趾与逆 FFT</td><td><a href="{pin}sim_algorithm/SimAlgorithm.java#L749" target="_blank" rel="noopener">SimAlgorithm · L749–771</a></td><td>08—09</td></tr>
</tbody></table></div>
<p>数值核验：相同采集帧输入本地原始 Java 重建代码与本页移植代码，比较完整 256 × 256 输出；测试覆盖噪声、单方向、失配、m 回退和切趾变化。<a href="Wiener-SIM/fairSIM-论文/图谱实现对照.md">配置、标度与复核方法</a> · <a href="Wiener-SIM/fairSIM-src/fairSIM/LICENSE">fairSIM GPL 许可</a></p>
'''
s=s[:pos]+source+s[pos:]
s=s.replace('线性 2D 模型 · 中间结果均来自当前计算', 'fairSIM Wiener 路径 · 中间结果均来自当前计算')
p.write_text(s)
