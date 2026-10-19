/* Scene-owned beats: narration, equations and operation cues share one timeline. */
(function(root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Clock = node ? require('../../../shared/animation/beat-clock.js') : root.SIMBeatClock;
  const definitions = [
  {
    "key": "basicDenominator",
    "action": "接住基础 R₀",
    "duration": 6000,
    "title": "基础拟合给出 R₀，下面对照本页复现版本。",
    "copy": "左图保持 F_sum，中图显示每条频带只计一次的 R₀。基础等权拟合至此得到分母 R₀+w²；接下来切换到本页固定 fairSIM 版本的计数约定。",
    "equation": "$$F_{\\rm sum}\\approx R_0S,\\qquad R_0=\\sum_{d,\\ell}|H_{d,\\ell}|^2$$",
    "note": "R₀ 解释分子，并不是本页实际使用的 R。此拍尚未做归一化，右图继续保留 F_sum。"
  },
  {
    "key": "sourceDenominator",
    "action": "源码额外计入零级",
    "duration": 9000,
    "title": "固定 fairSIM 版本分支：分母额外累计零级。",
    "copy": "中图从 R₀ 加上各方向的 |H_d,0|²，逐渐形成实际 R。分子保持不动；这是固定源码的计数行为，不是前一基础拟合式自然推出的额外项。",
    "equation": "$$R={\\color{#7ad5cd}R_0}+{\\color{#efb879}\\sum_d|H_{d,0}|^2}$$",
    "note": "当前实现对每方向零级重复计数，保留这一实际分母，不能把它当作基础拟合式自动推出的结果。高频 q=(14,0) 的零级为零，不受这项影响。",
    "cues": {
      "extraZero": [
        0.12,
        0.82
      ]
    }
  },
  {
    "key": "normalize",
    "action": "加正则项后归一化",
    "duration": 9000,
    "title": "使用实际 R+w² 归一化，抑制弱传递处的增益。",
    "copy": "中图改为实际 1/(R+w²)，右图逐复数频点形成 Wiener 频谱。理想数据下总传递率为 R₀/(R+w²)，不会自动等于 1。",
    "equation": "$$\\widehat S_{\\rm W}=\\frac{F_{\\rm sum}}{R+w^2}\\approx\\frac{R_0}{R+w^2}S,\\qquad w=0.05$$",
    "note": "w² 限制传递很弱时的反演增益；无法传递的频率不能凭除法产生。后续切趾还会进一步改变幅度。",
    "cues": {
      "normalize": [
        0.12,
        0.82
      ]
    }
  }
];
  const timeline = Clock.define(definitions);
  const {key, action, cues, ...opening} = definitions[0];
  const scene = { ...{
  "label": "Wiener 滤波",
  "stageIndex": 18,
  "id": "wiener",
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
