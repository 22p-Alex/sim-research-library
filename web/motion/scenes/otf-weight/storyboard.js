/* Scene-owned beats: narration, equations and operation cues share one timeline. */
(function(root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Clock = node ? require('../../../shared/animation/beat-clock.js') : root.SIMBeatClock;
  const definitions = [
  {
    "key": "fitObjective",
    "action": "先建立多带共同拟合目标",
    "duration": 7000,
    "title": "寻找同一个样品值，让各路预测都符合观测。",
    "copy": "暂存原高频点，改看重叠点 q=(6,0)。两条频带记录同一个 S，却经过不同的 H。用同一个待估值 z 分别乘各路 H，再把预测与观测的差一起衡量。",
    "equation": "$$\\widehat S=\\operatorname*{arg\\,min}_{z\\in\\mathbb C}\\underbrace{\\left[\\sum_b|C_b-H_bz|^2+w^2|z|^2\\right]}_{J(z)}$$",
    "note": "b 表示方向与级次组成的频带编号；z 是当前 q 处待估的样品复数值。前面为比较幅相各除自身 H；这里让多条观测共同约束一个样品值。w²|z|² 限制过大的解。"
  },
  {
    "key": "normalEquation",
    "action": "共轭权重的来源",
    "duration": 8000,
    "title": "让总误差最小，便得到共轭权重与模平方。",
    "copy": "展开刚才的残差平方和，对 z 的共轭求偏导并令其为零。各路观测前出现 H*，待估样品值前留下 |H|²；分子与分母由同一个目标一起产生。",
    "equation": "$$\\frac{\\partial J}{\\partial z^*}=0\\quad\\Longrightarrow\\quad(\\sum_b|H_b|^2+w^2)\\widehat S=\\sum_b H_b^*C_b$$",
    "note": "J 就是上一拍的目标函数。现在只推导基础等权拟合式，尚未执行共轭乘法；下一拍先计算一条分子贡献，再累计全部频带。固定版本的额外零级分母稍后单独说明。"
  },
  {
    "key": "conjugateWeight",
    "action": "一条频带乘 H*",
    "duration": 8000,
    "title": "已有 H，再乘自身 H*，形成一条加权贡献。",
    "copy": "先处理方向 1 的零级。左图是 C₁,₀，中图是对应 H*，右图逐复数频点形成 |H|²S；接下来保留这份结果直接累加。",
    "equation": "$$B_{d,\\ell}={\\color{#7ad5cd}H_{d,\\ell}^*}C_{d,\\ell}=|H_{d,\\ell}|^2S$$",
    "note": "本拍只完成一条贡献，不除 H。完整融合权重还包含后续分母，且不同于三帧解混的逆矩阵权重 u。",
    "cues": {
      "weight": [
        0.12,
        0.82
      ]
    }
  },
  {
    "key": "weightReady",
    "action": "保留加权结果",
    "duration": 4000,
    "title": "一条贡献算好，再收集全部九条。",
    "copy": "保留右侧的零级加权结果。下一幕直接把它加入累计频谱，再处理其余八条频带；标记始终留在重叠点。",
    "equation": "$$B_{d,\\ell}=H_{d,\\ell}^*C_{d,\\ell},\\qquad F_{\\rm sum}=\\sum_{d,\\ell}B_{d,\\ell}$$",
    "note": "所有贡献使用同一频率坐标 q；先计算复数，再取模长显示。"
  }
];
  const timeline = Clock.define(definitions);
  const {key, action, cues, ...opening} = definitions[0];
  const scene = { ...{
  "label": "OTF 加权",
  "stageIndex": 16,
  "id": "otf-weight",
  "theoryTopic": "weights",
  "encodingFormula": false,
  "demixFormula": false,
  "detectionFormula": false,
  "acquisitionFormula": false,
  "domainPair": null,
  "formulaDomain": "频域 · 覆盖与融合",
  "chapterIndex": 6,
  "chapter": "07 / Wiener 融合"
}, ...opening,
    timeline, beats: timeline.beats, duration: timeline.duration,
    present(progress, clock = timeline) {
      const state = clock.at(progress);
      return { ...state.definition, mode: state.mode, beat: state.beat, beatCount: clock.beats.length,
        local: state.local, cues: state.cues, progress: state.progress };
    }
  };
  if (node) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
