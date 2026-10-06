/* Declarative experiment catalog; no DOM access or initialization here. */
(function () {
  'use strict';

  const base = {
    wAp: 13,
    wAm: .9,
    wAbalance: 1,
    wAillumBg: 0,
    wAcounts: 3,
    wAbg: 0,
    wAnoise: 0,
    wAshot: false,
    wAreconMode: 'known',
    wAangle: 0,
    wAphase: 0,
    wAmerr: 0,
    wAotf: 0,
    wAepsr: .02
  };
  /* 11 项对照按「误差来源与认知目的」分四组：讲课时按组推进，
     自学时先读组说明再逐项拖动。groupMeta.teaching 直接用作讲解词。 */
  const groupMeta = {
    signal: {
      title: '信号不足',
      hint: '信号变弱：三种降低信噪比的途径，破坏方式不同',
      teaching: '计数降低、读出噪声增加和光子型背景升高，都会降低信噪比并影响调制度估计。正确扣除背景均值后，背景的散粒噪声仍会留下。'
    },
    contrast: {
      title: '对比度不足',
      hint: '条纹变淡：调制度是量测出来的，不是设定出来的',
      teaching: '调制度 m 决定照明一级频带的强度，也影响解调归一化与噪声放大。本页可比较已知真值与原始帧估计，或观察非调制照明如何稀释条纹对比度。'
    },
    calib: {
      title: '校准错误',
      hint: '几何与频率失配：增加光子不会自动纠正错误参数',
      teaching: '相位原点、角度、调制度和 OTF 截止的采用值若有系统偏差，仅增加光子数不会修正它们。本组保持原始帧不变，逐一检查错误参数对重建的影响。'
    },
    recon: {
      title: '重建侧',
      hint: '正则化权衡与背景均值扣除验证',
      teaching: '正则化对照复用同一批原始帧，观察平滑与细节的取舍；背景扣除验证会改变原始帧的常量背景，并在关闭噪声时检查扣均值后的重建是否一致。'
    }
  };
  const groupOf = {
    estimate: 'contrast',
    counts: 'signal',
    read: 'signal',
    background: 'signal',
    illumination: 'contrast',
    phase: 'calib',
    angle: 'calib',
    modulation: 'calib',
    otf: 'calib',
    regularization: 'recon',
    background_mean: 'recon'
  };
  const experiments = [{
    id: 'estimate',
    name: '调制度：真值输入与数据估计',
    a: {
      wAcounts: 2,
      wAm: .4,
      wAshot: true,
      wAnoise: 2
    },
    b: {
      wAreconMode: 'estimated'
    },
    aLabel: '同一批 raw，使用调制度真值',
    bLabel: '同一批 raw，使用估计调制度',
    guide: '只切换调制度来源；其他校准量仍完全已知。比较采用的 m、RMSE 与细条纹。真值输入也不能消除噪声和有限带宽误差；单次噪声下 RMSE 不保证严格排序。'
  }, {
    id: 'counts',
    name: '信号计数：Q = 10000 → 100',
    a: {
      wAcounts: 4,
      wAshot: true,
      wAnoise: 2
    },
    b: {
      wAcounts: 2
    },
    aLabel: '高计数：Q = 10000 e⁻',
    bLabel: '低计数：Q = 100 e⁻',
    guide: '只降低信号计数尺度 Q，照明调制度不变。已知 m 用于隔离采集噪声的影响。观察低计数下条纹与噪声；Q 不是画面实际平均计数，更不是总光子数。'
  }, {
    id: 'read',
    name: '读出噪声：σr = 0 → 10 e⁻',
    a: {
      wAcounts: 2,
      wAshot: true
    },
    b: {
      wAnoise: 10
    },
    aLabel: '仅散粒噪声，σr = 0',
    bLabel: '增加读出噪声，σr = 10 e⁻',
    guide: '只增加读出噪声标准差；光路、信号计数尺度和背景不变。Poisson 噪声在两边均开启。看 B 的细条纹是否被噪声淹没，并核对 RMSE。'
  }, {
    id: 'illumination',
    name: '非调制照明：Iu = 0 → 0.3',
    a: {
      wAshot: true,
      wAnoise: 2
    },
    b: {
      wAillumBg: .3
    },
    aLabel: '无非调制照明，Iu = 0',
    bLabel: '加入非调制照明，Iu = 0.3',
    guide: '只增加激发样品的非调制光。总计数上升，调制度由 0.900 降至约 0.692；绝对条纹调制幅度不变。平均照明已正确归一化，重建不应仅因输入变亮就被判为更好。'
  }, {
    id: 'background',
    name: '检测背景：B = 0 → 50 e⁻',
    a: {
      wAcounts: 2,
      wAshot: true,
      wAnoise: 2
    },
    b: {
      wAbg: 50
    },
    aLabel: '无检测背景，B = 0',
    bLabel: '检测背景 B = 50 e⁻/像素/帧',
    guide: '只增加检测端的光子型背景，照明调制度保持 0.900。两边都减去正确背景均值，B 的散粒噪声仍会留下。再做“验证背景扣除”无噪声对照，可单独验证背景均值是否正确扣除。'
  }, {
    id: 'phase',
    name: '公共相位失配：0 → π/6',
    a: {},
    b: {
      wAphase: 2
    },
    aLabel: '无噪声，采用正确相位',
    bLabel: '同一 raw，重建相位统一偏移 π/6',
    guide: '保持 raw 和 m 不变，只给重建相位加 π/6。三个相位间隔没有改变，但一级频带的复相位错误。它不是逐帧相位抖动；上方实际采集相位与重建同时平移时则是另一个实验。'
  }, {
    id: 'angle',
    name: '角度失配：0° → 3°',
    a: {},
    b: {
      wAangle: 3
    },
    aLabel: '无噪声，采用正确角度',
    bLabel: '同一 raw，各方向采用角度 +3°',
    guide: '只给重建载频方向统一加 3°，频带被搬到错误位置。raw 不变，比较条纹错位与 RMSE。下方支持域仍按真实已校准载频绘制，不能用它判断错误搬移后的保真度。'
  }, {
    id: 'modulation',
    name: '调制度失配：0 → −30%',
    a: {},
    b: {
      wAmerr: -30
    },
    aLabel: '无噪声，采用 m = 0.900',
    bLabel: '同一 raw，采用 m = 0.630',
    guide: '只把重建采用的调制度乘以 0.7，照明实际 m 仍为 0.900。它影响一级频带的幅度归一化和融合权重；不要把该滑块当作改变真实照明。'
  }, {
    id: 'otf',
    name: 'OTF 截止失配：0 → +20%',
    a: {},
    b: {
      wAotf: 20
    },
    aLabel: '无噪声，采用正确圆瞳 OTF',
    bLabel: '同一 raw，假设检测截止高 20%',
    guide: '只把重建模型的检测截止频率乘以 1.2。真实检测带宽不变，不会凭空增加可测信息。此实验只检查圆瞳 OTF 的尺度误差，不代表球差、离焦等完整像差。'
  }, {
    id: 'regularization',
    name: '正则化：ε = 0.005 → 0.1',
    a: {
      wAcounts: 2,
      wAshot: true,
      wAnoise: 2,
      wAepsr: .005
    },
    b: {
      wAepsr: .1
    },
    aLabel: '同一批低计数 raw，ε = 0.005',
    bLabel: '同一批低计数 raw，ε = 0.1',
    guide: '只增加正则强度，真实采集与采用的 m 均不变。比较噪声抑制与细条纹损失。更平滑、RMSE 更小都不自动意味着分辨率更高。'
  }, {
    id: 'background_mean',
    name: '验证背景扣除：关闭全部噪声',
    a: {
      wAcounts: 2
    },
    b: {
      wAbg: 50
    },
    aLabel: '无噪声，B = 0',
    bLabel: '无噪声，B = 50 e⁻/像素/帧',
    guide: '只改变常量检测背景；Poisson 和读出噪声都关闭。原始帧变亮，但正确扣背景后 A / B 重建应在数值精度内相同。与“检测背景”对照：扣均值不等于去掉背景散粒噪声。'
  }];
  const labels = {
    wAp: '标称周期',
    wAm: '相干偏振系数 v',
    wAnoise: '读出噪声 σr',
    wAepsr: '正则 ε',
    wAbalance: '入射功率比',
    wAillumBg: '非调制照明 Iu',
    wAcounts: '计数尺度 Q',
    wAbg: '检测背景 B',
    wAangle: '重建角度偏差',
    wAphase: '公共相位偏差',
    wAmerr: '采用 m 相对偏差',
    wAotf: '检测截止估计偏差',
    wAreconMode: '调制度来源',
    wAshot: 'Poisson 噪声',
    seed: '噪声种子',
    directions: '采集方向开关',
    phases: '相位帧'
  };
  for (let i = 1; i <= 3; i++) {
    labels['wAang' + i] = '采集方向 ' + i;
    labels['wAphi' + i] = '采集相位 ' + i;
  }
  window.SIMLab.presets = {
    base,
    groups: groupMeta,
    groupOf,
    experiments,
    labels
  };
})();
