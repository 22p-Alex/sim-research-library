/* Shared storyboard for the nine getPeak stops. All intervals below are BEAT-LOCAL [0,1].
 * Change duration to retime a beat; its cues, formula and narration move together.
 * Source: local fairSIM 711afd12, Correlation.getPeak/commonRegion; see README.md. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Clock = node ? require('../../../shared/animation/beat-clock.js') : root.SIMBeatClock;
  const relation = String.raw`B_1(\mathbf q+\widehat{\mathbf k})\approx\alpha B_0(\mathbf q)`;
  const alignedRelation = String.raw`v_{\widehat{\mathbf k}}(\mathbf r)\approx\alpha u(\mathbf r)`;
  const part = (key, tex) => ({ key, tex });
  const formula = (parts, emphasis) => ({ parts, join:'', emphasis:[{at:0,parts:emphasis || parts.map(p=>p.key)}] });
  const alphaFormula = (parts, emphasis) => ({...formula(parts,emphasis),motion:'alphaProduct'});
  // These tokens stay mounted across scaling, rotation and coefficient grouping.
  const alphaTokens = {
    source:'z',scaleLabel:String.raw`\times m`,scaleArrow:String.raw`\longrightarrow`,scaledM:'m',scaledZ:'z',
    phaseLabel:String.raw`\times e^{i\phi_\Delta}`,phaseArrow:String.raw`\longrightarrow`,
    productM:'m',productPhase:String.raw`e^{i\phi_\Delta}`,productZ:'z',coefficient:String.raw`\alpha`,
    magnitude:String.raw`|mz|=m|z|`,phase:String.raw`\arg(\alpha z)=\arg z+\phi_\Delta\pmod{2\pi}`,relation:alignedRelation
  };
  const prepareSeconds=21, at=seconds=>seconds/prepareSeconds;
  const prepareSteps = [
    {key:'locked',at:0,title:'位移已确定，两份公共信息还差什么？',
      copy:'固定使用刚才选中的波矢。它确定两路在哪里记录同一份样品信息，接下来比较这两份记录的共同幅相。',
      note:'位置搜索已经结束；现在保留复数方向和相对幅度。归一化位置评分不能单独给出共同复比例。',
      formula:formula([part('addresses',String.raw`\mathbf f_0=\mathbf q,\qquad\mathbf f_1=\mathbf q+\widehat{\mathbf k}`)])},
    {key:'addresses',at:at(1.5),title:'两个检测地址，对应同一份样品信息。',
      copy:'展开两路各自的检测坐标：0 级取 q，+1 级取 q+k̂。暖色标记追踪同一份样品信息；坐标展开不改变锁定波矢。',
      note:'这里区分读取地址与数组位移。最终工作旁带仍在原生检测坐标；后面的空域相位斜坡才执行已知频移。',
      formula:formula([part('zero',String.raw`\widetilde A_0(\mathbf q)=H(\mathbf q)S(\mathbf q)`),part('side',String.raw`,\quad\widetilde A_{+1}(\mathbf q+\mathbf k)=\alpha H(\mathbf q+\mathbf k)S(\mathbf q)`)],['zero','side'])},
    {key:'ownOtf',at:at(5.5),title:'同源信息经历了不同的检测衰减。',
      copy:'位置已经锁定，现在重新筛选适合幅相估计的公共信息，再各自除以检测时的 H。选区可与搜索时不同，两路必须保留相互对应的内容。',
      note:'最终筛选从原始临时频带开始，采用两路 OTF 阈值与径向排除；不继续使用位置搜索的选区。精确比例还要求正确波矢、准确 OTF 与理想观测。',
      formula:formula([part('zero',String.raw`\frac{\widetilde A_0(\mathbf q)}{H(\mathbf q)}=S(\mathbf q)`),part('side',String.raw`,\quad\frac{\widetilde A_{+1}(\mathbf q+\mathbf k)}{H(\mathbf q+\mathbf k)}=\alpha S(\mathbf q)`)],['zero','side'])},
    {key:'workingBands',at:at(9.5),title:'把筛选并校正后的两路频谱，记为 B₀、B₁。',
      copy:'在各自保留的检测地址内，临时频带除以自身 H，分别命名为 B₀、B₁；其余地址置零。它们是接下来比较幅相的两路工作副本。',
      note:'下式只用于各路保留区；区外直接置零，不执行除法。副本从原始临时频带准备一次，没有对搜索结果再次除 H。',
      formula:formula([part('zero',String.raw`B_0(\mathbf f)\coloneqq\frac{\widetilde A_0(\mathbf f)}{H(\mathbf f)}`),part('side',String.raw`,\quad B_1(\mathbf f)\coloneqq\frac{\widetilde A_{+1}(\mathbf f)}{H(\mathbf f)}`)])},
    {key:'commonAlpha',at:at(11),title:'两路在对应地址，还差一个共同复比例。',
      copy:'B₀(q) 与 B₁(q+k̂) 记录同一部分样品信息，共同复比例记为 α。先看工作频谱的模长，再用颜色显示复数相角。',
      note:'位置锁定后不再搜索；两路匹配掩膜保留对应信息。使用估计波矢或有噪声时写近似关系，此处尚未揭示估计数值。',
      formula:formula([part('relation',relation)],['relation'])},
    {key:'displayMagnitude',at:at(12),title:'复数的长度，怎样变成图上的亮度？',
      copy:'看中间的显示标尺：箭头变长，标记沿对数亮度色条移动。弱信号也能看清，但亮度不再与模长成正比。',
      note:'ρ=|z|/M，M 是本张场图的最大模长。采用 L=ln(1+1000ρ)/ln(1001)；这是显示约定，不参与估计。',
      formula:formula([part('magnitude',String.raw`\rho=\frac{|z|}{M}`),part('brightness',String.raw`,\quad L=\frac{\ln(1+1000\rho)}{\ln(1001)}`)],['brightness'])},
    {key:'displayPhase',at:at(15),title:'长度固定，转动箭头，就沿色相环换色。',
      copy:'同样亮度可以对应不同相角。箭头转一圈，色相也走一圈；因此图上的颜色记录复数方向。',
      note:'零模长处没有可定义的相角，显示为黑色。色相与亮度是两条显示通道，不能把频带身份色当作复数相角。',
      formula:formula([part('phase',String.raw`h=\frac{\arg z\bmod 2\pi}{2\pi}`),part('brightness',String.raw`,\quad |z|\ \text{固定}\ \Longrightarrow\ L\ \text{不变}`)],['phase'])},
    {key:'displayApply',at:at(18),title:'把两个通道合起来，为真实复数着色。',
      copy:'标尺回到本组实际选点，将它的模长与相角合成一个颜色，再铺回工作频谱。每个频率位置都按同一规则着色。',
      note:'各图按自己的 M 显示；只有后面的 v 与 vₖ 共用 M，因为已知旋转保持模长。比较真实幅度比例仍看同标尺箭头。',
      formula:formula([part('display',String.raw`z=|z|e^{i\psi}\ \longmapsto\ (\text{亮度 }L,\ \text{色相 }h)`),part('scale',String.raw`,\quad M_v=M_{v_{\widehat{\mathbf k}}}`)],['display'])}

  ];
  const definitions = [
    {
      ...prepareSteps[0],key:'finalPrepare',duration:prepareSeconds*1000,label:'共同系数',action:'同源信息与共同复比例',steps:prepareSteps,
      footer:'对应地址已确定 · 共同幅相待估',domain:'频域 · 对应地址与共同信息',layout:'pair',
      formula:prepareSteps.find(s=>s.key==='commonAlpha').formula,
      visibility:{enter:[at(1.5),at(3.3)]},
      cues:{nativeLayout:[at(1.5),at(4.5)],addressPoint:[at(1.5),at(2.4)],ownOtf:[at(5.9),at(7)],
        correction:[at(7.4),at(9)],commonAlpha:[at(11),at(11.2)],commonPoints:[at(11),at(11.2)],
        workSpectra:[at(11.2),at(12)],frequencyPointExit:[at(10.8),at(11.2)],handoffEnd:[at(1.5),at(1.5)],
        colorEnter:[at(12),at(12.5)],colorAmplitude:[at(12.6),at(14.3)],colorPhase:[at(15.2),at(17.2)],
        colorPaint:[at(18),at(19)],colorExit:[at(19.5),at(20.3)]}
    },
    {
      key:'finalInverse',duration:36000,label:'两路逆变换',action:'从两张图到原位公式，再推出额外转角',
      title:'为什么换到空域？用逐点旋转处理已知频移。',
      copy:'保留这两路工作频谱，分别逆变换为 u、v。接着把对应地址代进定义，看清频率位置差怎样变成复数转角。',
      note:'只更换计算表示；对齐后，两域内积的相同归一化因子在共同复比例的比值中抵消。',
      footer:'图 → u、v → 换地址 → 拆指数 → 额外转角',domain:'频域 → 空域',layout:'pair',
      formula:formula([part('relation',relation)]),
      steps:[
        {key:'purpose',at:0},
        {key:'transform',at:3/36,title:'两张频谱，各自合成一个空域复数场。',
          copy:'原图分别变成 u、v；随后把逆变换写成求和式，保留在各自的位置。',
          note:'每个空域位置由整张频谱合成；逆变换不会把一个频点直接变成一个像素。',
          formula:formula([part('inverse',String.raw`u=\mathcal F_N^{-1}\{B_0\},\qquad v=\mathcal F_N^{-1}\{B_1\}`)])},
        {key:'definitions',at:7/36,title:'保留 u、v 的定义，接下来只展开 v。',
          copy:'上方两条定义始终保留。左边用 q 求和，右边暂时用 f；它们都是遍历整张频谱的地址。',
          formula:formula([part('inverse',String.raw`u=\mathcal F_N^{-1}\{B_0\},\qquad v=\mathcal F_N^{-1}\{B_1\}`)])},
        {key:'substituteAddress',at:10/36,title:'令 f=q+k̂：频谱和指数，都换成同一个地址。',
          copy:'从右上方的 v 定义展开一行。把 f 改写为 q+k̂，B₁ 的读取地址与指数中的频率必须一起替换。',
          note:'先按整数 DFT 波矢重编号，地址按 N 周期取模；小数频移的有限傅里叶延拓见原理区。',
          formula:formula([part('sum',String.raw`v(\mathbf r)=\frac1{N^2}\sum_{\mathbf q}B_1(\mathbf q+\widehat{\mathbf k})e^{2\pi i(\mathbf q+\widehat{\mathbf k})\cdot\mathbf r/N}`)])},
        {key:'substituteBand',at:14/36,title:'再用同源关系，把 B₁(q+k̂) 换成 αB₀(q)。',
          copy:'替换频谱值，不改刚才的读取地址。共同系数 α 与 q 无关，移到求和号外面；指数里仍然保留 q+k̂。',
          note:'理想成对掩膜与正确波矢下为等式；实际估计和掩膜误差保留为近似关系。',
          formula:formula([part('sum',String.raw`v(\mathbf r)\approx\frac\alpha{N^2}\sum_{\mathbf q}B_0(\mathbf q)e^{2\pi i(\mathbf q+\widehat{\mathbf k})\cdot\mathbf r/N}`)])},
        {key:'splitKernel',at:18/36,title:'指数里的加法，变成两个旋转因子的乘法。',
          copy:'同一个指数拆为两项：青色只含 q，橙色只含 k̂。频率地址多了 k̂，因此每项都多乘同一个橙色因子。',
          formula:formula([part('split',String.raw`e^{2\pi i(\mathbf q+\widehat{\mathbf k})\cdot\mathbf r/N}=e^{2\pi i\mathbf q\cdot\mathbf r/N}e^{2\pi i\widehat{\mathbf k}\cdot\mathbf r/N}`)])},
        {key:'factorOut',at:22/36,title:'固定 r 后，橙色因子与 q 无关，可以提出求和。',
          copy:'橙色因子沿弧线移出求和。留下的青色部分与左上方 u 的定义逐项相同。',
          formula:formula([part('factor',String.raw`v(\mathbf r)\approx\alpha e^{2\pi i\widehat{\mathbf k}\cdot\mathbf r/N}\underbrace{\frac1{N^2}\sum_{\mathbf q}B_0(\mathbf q)e^{2\pi i\mathbf q\cdot\mathbf r/N}}_{u(\mathbf r)}`)])},
        {key:'recognizeU',at:26/36,title:'这整个青色求和，就是一直保留的 u(r)。',
          copy:'把青色求和收成 u(r)，橙色因子仍留在式中。至此，额外相位的来源完整地保留在原公式里。',
          formula:formula([part('extra',String.raw`v(\mathbf r)\approx\alpha e^{i\delta(\mathbf r)}u(\mathbf r)`),part('delta',String.raw`,\quad\delta(\mathbf r)=\frac{2\pi}{N}\widehat{\mathbf k}\cdot\mathbf r`)],['delta'])},
        {key:'extraAngle',at:29/36,title:'乘上这个单位复数，长度不变，多转 δ(r)。',
          copy:'固定一个 r，让同一根示意箭头绕原点转过 δ。上方公式保持原位：橙色因子对应橙色圆弧；下一步才反向撤掉它。',
          note:'箭头是复乘几何示意，不是估计出的 α。转角由本组锁定波矢与显示坐标计算；相角按模 2π 比较，δ 与未知共同相位 φΔ 不同。',
          formula:formula([part('extra',String.raw`v(\mathbf r)\approx\alpha e^{i\delta(\mathbf r)}u(\mathbf r)`),part('delta',String.raw`,\quad\delta(\mathbf r)=\frac{2\pi}{N}\widehat{\mathbf k}\cdot\mathbf r`)],['delta'])}
      ],
      visibility:{enter:[0,.04]},cues:{inverse:[3.5/36,6.5/36],derivationEnter:[7/36,9/36],
        derivationRow:[10/36,10.7/36],addressSubstitution:[11/36,13/36],bandSubstitution:[14.5/36,17/36],
        kernelSplit:[18.5/36,21/36],factorOutside:[22.5/36,25/36],recognizeU:[26.5/36,28.5/36],
        deltaReveal:[27.5/36,29/36],positivePlane:[29/36,30/36],positiveTurn:[30.5/36,34/36]}
    },
    {
      key:'finalShift',duration:7000,label:'反向旋转',action:'撤掉已知额外转角',
      title:'既然额外转了 δ，就按 −δ 转回去。',
      copy:'放大一个实际位置的复数箭头。保留原箭头，副本反向旋转，长度保持不变。',
      note:'这个角度由锁定波矢和坐标确定；未知共同相位 φΔ 留到对齐后再估计。',
      footer:'已知 δ · 反向撤掉 · 长度保持',domain:'空域 · 单点反向旋转',layout:'shift',
      formula:formula([part('delta',String.raw`\delta(\mathbf r)=\frac{2\pi}{N}\widehat{\mathbf k}\cdot\mathbf r`)]),
      steps:[{key:'knownAngle',at:0},
        {key:'reverse',at:.24,formula:formula([part('undo',String.raw`e^{i\delta(\mathbf r)}e^{-i\delta(\mathbf r)}=1`),part('target',String.raw`,\quad v_{\widehat{\mathbf k}}(\mathbf r)=v(\mathbf r)e^{-i\delta(\mathbf r)}`)],['undo'])},
        {key:'alignedPoint',at:.80,title:'这个位置的已知额外转角，已经撤掉。',
          copy:'输出仍在原坐标，模长保留。接下来把相同规则用于整张旁带场。',
          formula:formula([part('target',String.raw`v_{\widehat{\mathbf k}}(\mathbf r)=v(\mathbf r)e^{-i\delta(\mathbf r)}\approx\alpha u(\mathbf r)`)] )}],
      visibility:{enter:[0,.12]},cues:{pointLayout:[0,0],shift:[.30,.75]}
    },
    {
      key:'finalShiftScan',duration:5000,label:'全场校正',action:'逐点撤掉已知额外转角',
      title:'每个位置，按自己的角度转回去。',
      copy:'左边读取 v，右边写入 vₖ。两个光标始终对应同一个空域坐标。',
      note:'每个位置使用自己的 δ。颜色记录复数相角；乘法操作保持该点的模长与坐标。',
      footer:'单点动作推广到全场',domain:'空域 · 全场校正',layout:'shift',
      formula:formula([part('target',String.raw`v_{\widehat{\mathbf k}}(\mathbf r)=v(\mathbf r)e^{-i\delta(\mathbf r)}`)]),
      visibility:{enter:[0,.08]},cues:{scanReferenceHide:[0,.10],scanArrange:[0,.15],scanGuide:[.12,.18],
        scanPointClear:[.20,.25],shiftOutput:[.12,.18],shiftScan:[.25,.90]}
    },
    {
      key:'finalCompare',duration:15000,label:'幅相对比',action:'位置对齐后比较共同复比例',
      title:'已知位置差已消去，现在只比较共同系数 α。',
      copy:'将同一点的 u 与 vₖ 放到同一复平面。它们剩下的共同关系，由 α 描述。',
      note:'两根实际箭头共用线性标尺；实际共同相位接近零时，两箭头保持同向。',
      footer:'已知的位置差已消去 · 未知共同幅相待估',domain:'空域 · 共同复比例',layout:'shift',
      formula:formula([part('model',alignedRelation),part('coefficient',String.raw`,\quad\alpha=m e^{i\phi_\Delta}`)],['model']),
      visibility:{enter:[0,.12]},cues:{scanRelease:[0,.07],compareExit:[0,.07],compare:[.08,.14],
        alphaDemo:[.14,.16],alphaStretch:[.18,.30],alphaFormulaExpand:[.36,.40],alphaRotate:[.40,.52],
        alphaFormulaMerge:[.54,.60],alphaShared:[.62,.70],alphaRetire:[.72,.76]},
      steps:[{key:'compare',at:0},
    {key:'alphaStretch',at:.16,title:'乘上 m：把同一根箭头伸长或缩短。',
      copy:'中间用一对示意箭头拆解 α 的作用。先复制样品箭头，只改变长度；参考箭头留在原处，二者共用同一线性标尺。',
      note:'中间是复乘几何示意，不是本组估计值。对任意 z，|mz|=m|z|；m>0 且 z≠0 时方向不变。两侧仍是本组实际复数场。',
      formula:alphaFormula([part('model',String.raw`z\xrightarrow{\times m}mz`),part('magnitude',String.raw`,\quad `+alphaTokens.magnitude)],['magnitude'])},
    {key:'alphaRotate',at:.36,title:'再乘单位复数：长度不变，转过共同角度。',
      copy:'保持刚才缩放后的长度，再旋转 φΔ。伸缩和旋转合在一起，就是乘 α=m·exp(iφΔ)；两步作用于同一个样品复数。',
      note:'单位复数的模长为 1；m>0 且 z≠0 时，相角相加（模 2π）。示意转角不代替观测；实际共同相位接近零时，两箭头同向。',
      formula:alphaFormula([part('model',String.raw`z\xrightarrow{\times m}mz\xrightarrow{\times e^{i\phi_\Delta}}m e^{i\phi_\Delta}z=\alpha z`),part('phase',String.raw`,\quad `+alphaTokens.phase)],['phase'])},
    {key:'commonAcross',at:.56,title:'换一份样品信息，同一个 α 继续起作用。',
      copy:'示意箭头换一个方向，同一个 α 仍给出相同的伸缩与转角。随后回到实际观测。',
      note:'理想模型满足精确比例；噪声或位移误差下是近似关系。动画只解释比例的几何意义，最终数字仍由全场累计得到。',
      formula:alphaFormula([part('model',String.raw`z\xrightarrow{\times m}mz\xrightarrow{\times e^{i\phi_\Delta}}\alpha z`),part('relation',String.raw`,\quad `+alignedRelation)],['relation'])},
        {key:'actualReturn',at:.76,title:'回到实际位置，检验共同关系。',
          copy:'换两个实际位置，比较同标尺箭头；共同系数的数值仍由后面的全场累计得到。'},
        {key:'handoff',at:.90,title:'怎样消去样品自身的相位，留下 α？',
          copy:'回到最初位置，保留这对实际箭头。下一步取参考场的共轭，与旁带相乘。'}]
    },
    {
      key: "finalProduct",
      duration: 12800,
      label: "共轭相乘",
      action: "同点共轭相乘",
      title: "取同一个空域位置，同时算乘积与参考能量。",
      copy: "若 vₖ≈αu，两边乘 u* 就有 u*vₖ≈α|u|²。两个光标取同一个实际 r，分别形成复数乘积 z 和非负参考能量 e。",
      note: "共轭使 u*u=|u|²，因此每个位置都在用同一 α 乘参考能量。这解释了为何分子要取共轭乘积、分母要取能量。精确等式限于正确波矢、匹配 OTF 和掩膜、准确相对步进及无噪声模型。",
      footer: "相同 r · 橙色 z 进入分子 · 青色 e 进入分母",
      domain: "空域 · 幅相计算",
      layout: "product",
      formula: { parts: [
        {key:"productName", tex:String.raw`z(\mathbf r)=`},
        {key:"conjugate", tex:String.raw`u^*(\mathbf r)`},
        {key:"multiply", tex:String.raw`v_{\widehat{\mathbf k}}(\mathbf r)`},
        {key:"energy", tex:String.raw`\approx\alpha\underbrace{|u(\mathbf r)|^2}_{e(\mathbf r)}`}
      ], join:"", emphasis:[{"at":0,"parts":["conjugate"]},{"at":0.5,"parts":["multiply","energy","productName"]}] },
      visibility: {enter:[0,.12]},
      cues: {productDock:[.02,.16],lockRetire:[.16,.22],conjugate:[.25,.5],multiply:[.5,.8125]}
    },
    {
      key: "finalSum",
      duration: 17600,
      label: "双路累加",
      action: "全场双路累计",
      title: "扫过全部 N² 个位置，分别累计 C 与 E₀。",
      copy: "先慢看第一个像素的贡献，再按行遍历整张空域网格。复数乘积进入 C，参考能量进入 E₀；两条累计通道分开显示。",
      note: "每个位置有 z≈αe，同一个 α 可提出求和，所以 C≈αE₀。Σ 遍历完整 N² 空域位置，包含零贡献项；两路读数使用同一前缀和，不把搜索公共点数或工作掩膜点数当成累计次数。",
      footer: "完整空域网格 · 每个位置参与一次 · 累计完成后才相除",
      domain: "空域 · 幅相计算",
      layout: "sum",
      formula: { parts: [
        {key:"cross", tex:String.raw`C=\sum_{\mathbf r}z(\mathbf r)`},
        {key:"energySum", tex:String.raw`E_0=\sum_{\mathbf r}e(\mathbf r)`},
        {key:"domain", tex:String.raw`\mathbf r\in\{0,\ldots,N-1\}^2`}
      ], join:String.raw`,\qquad `, emphasis:[{"at":0,"parts":["cross","energySum"]}] },
      visibility: {enter:[0,.12]},
      cues: {"sumFirst":[0.09090909090909091,0.09090909090909091],"sumSweep":[0.22727272727272727,0.9545454545454546],"contribution":[0.09090909090909091,0.20454545454545456],"sumScan":[0.22727272727272727,0.22727272727272727]}
    },
    {
      key: "finalDivide",
      duration: 8000,
      label: "能量归一",
      action: "除以参考能量",
      title: "全部累加完成，C 除以 E₀ 得到一个复系数。",
      copy: "先看 C≈αE₀：共同复比例乘参考能量，得到分子。E₀>0 时，把两路完整累计量相除，读出 α̂；箭头在除法完成后揭示。",
      note: "相除的原因是消去参考能量，留下共同复比例。理想比例下 C=αE₀；有误差时 C/E₀ 仍是给定两场的单个复比例最小二乘解。完整推导留在原理区；本拍不再除 H，也不试探旋转。",
      footer: "N² 项已累计 · C ÷ E₀ · 一个共同复系数",
      domain: "复系数 · 参数读出",
      layout: "result",
      formula: { parts: [
        {key:"reason", tex:String.raw`C\approx\alpha E_0\quad\Longrightarrow\quad`},
        {key:"divide", tex:String.raw`\widehat\alpha=\frac{{\color{#efb879}C}}{{\color{#7ad5cd}E_0}}`}
      ], join:"", emphasis:[{"at":0,"parts":["reason"]},{"at":0.25,"parts":["divide"]}] },
      visibility: {enter:[0,.12]},
      cues: {"resultEnter":[0.03,0.13],"divide":[0.25,0.6],"divideExit":[0.88,0.97]}
    },
    {
      key: "finalRead",
      duration: 8000,
      label: "读取幅相",
      action: "读取幅相",
      title: "一个复比例，读出反差与三帧共用的相位。",
      copy: "箭头长度给出 m̂，相角给出 φ̂Δ。φ̂Δ 加到每帧已知相对相移上；接下来用这个复比例的倒数，补偿临时旁带。",
      note: "m̂=|α̂|，φ̂Δ=arg α̂。临时旁带的 2/3 权重已补偿余弦展开的 1/2，模长直接给调制度，不再乘 2。相对步进必须已知且准确；这些参数来自同一组三帧观测。",
      footer: "模长 → 调制度 · 相角 → 共同相位 · 参数交给解混矩阵",
      domain: "复系数 · 参数读出",
      layout: "result",
      formula: { parts: [
        {key:"modulation", tex:String.raw`\widehat m=|\widehat\alpha|`},
        {key:"phase", tex:String.raw`\widehat\phi_\Delta=\arg\widehat\alpha`},
        {key:"frames", tex:String.raw`\widehat\phi_j=\phi'_j+\widehat\phi_\Delta`}
      ], join:String.raw`,\qquad `, emphasis:[{"at":0,"parts":["phase"]},{"at":0.4,"parts":["modulation"]},{"at":0.7,"parts":["frames"]}] },
      visibility: {enter:[0,.12]},
      cues: {"readReady":[0,0],"readEnter":[0.03,0.13],"phaseRead":[0.1,0.4],"lengthRead":[0.4,0.7],"cards":[0.65,0.95]}
    }
  ];
  const timeline = Clock.define(definitions);
  const entry = Clock.freeze({
  "id": "locked-spectrum",
  "from": "refine",
  "title": prepareSteps[0].title,
  "copy": prepareSteps[0].copy,
  "note": prepareSteps[0].note,
  "footer": "k̂ 已锁定 · 对应地址已确定 · 共同幅相待估。",
  "action": "同源信息与共同复比例",
  "equation": '$$'+prepareSteps[0].formula.parts.map(p=>p.tex).join('')+'$$'

});
  const formulas = Object.fromEntries(timeline.beats.map(b => [b.key, '$$' + b.formula.parts.map(p => p.tex).join(b.formula.join) + '$$']));
  const scene = Clock.freeze({
    id: 'get-peak', legacyId: 'least-squares-fit', label: '共同幅相估计', duration: timeline.duration,
    title: definitions[0].title, copy: definitions[0].copy, note: definitions[0].note, equation: formulas.finalPrepare,
    objective: '位置对齐后，估计两份公共信息的共同复比例，读取调制度与共同相位，并将倒数用于补偿旁带。',
    inputs: ['estimate.finalPeak', 'locked-wavevector'], outputs: ['estimated-modulation', 'estimated-phase', 'locked-wavevector'],
    entry: entry.id, exit: 'estimated-parameter-cards', phase: 'coefficient', chapter: '② 求幅相 / 复数值',
    source: { commit: '711afd12cb8c4fd4207bbca7ee7610c5aed4f732', file: 'Correlation.java', methods: ['getPeak', 'commonRegion'] },
    review: { numerical: 'automated', formula: 'automated', transition: 'automated', visual: 'pending-user' }
  });
  // Navigation stops share one deterministic calculation timeline. The legacy
  // composite API remains available for saved beat locators and numerical tools.
  const ids = ['least-squares-fit','get-peak-inverse','get-peak-point','get-peak-scan','get-peak-compare','get-peak-product','get-peak-sum','get-peak-divide','get-peak-read'];
  const stops = Clock.freeze(timeline.beats.map((b,i) => ({ ...scene,
    id: ids[i], sceneId: scene.legacyId, getPeakBeat:b.key,
    unit:'web/parameter-demo/scenes/get-peak/storyboard.js',
    label:b.label, title:b.title, copy:b.copy, note:b.note, equation:formulas[b.key], duration:b.duration,
    inputs:[i ? ids[i-1] : entry.id], outputs:[ids[i+1] || scene.exit],
    beats:[{key:b.key,action:b.action,start:0,end:1}]
  })));
  function stopProgress(stop, progress) {
    const b=timeline.beats.find(b=>b.key===stop.getPeakBeat);
    // A stop's endpoint belongs to that stop, even though the composite clock
    // assigns exact internal boundaries to the next beat.
    return timeline.progressFor(b.key, Math.min(progress, b.index===timeline.beats.length-1 ? 1 : 1-1e-9));
  }
  const api = { timeline, scene, stops, stopProgress, entry, formulas: Clock.freeze(formulas),alphaTokens:Clock.freeze(alphaTokens) };
  if (node) module.exports = api; else root.SIMGetPeak = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
