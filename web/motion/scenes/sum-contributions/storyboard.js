/* Scene-owned beats: narration, equations and operation cues share one timeline. */
(function(root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Clock = node ? require('../../../shared/animation/beat-clock.js') : root.SIMBeatClock;
  const definitions = [
  {
    "key": "firstWeight",
    "action": "慢看第一项乘法",
    "duration": 6500,
    "title": "先慢看第 1 项：归位频带乘自己的 H*。",
    "copy": "从方向 1 的零级开始。左图给输入，中图逐点形成 H*C；右侧累计频谱 F_sum 先保持为零。",
    "equation": "$$B_{1,0}=H_{1,0}^*C_{1,0},\\qquad F_{\\rm sum}^{(0)}=0$$",
    "note": "F_sum 专指融合累计频谱，与前面的逆矩阵 U 及 OTF 校正参考频谱 U 区分。",
    "cues": {
      "firstWeight": [
        0.12,
        0.82
      ]
    }
  },
  {
    "key": "firstAdd",
    "action": "慢看第一项累加",
    "duration": 6500,
    "title": "再慢看加法：把第 1 项加入累计结果。",
    "copy": "中图的 H*C 已完成，保持不动；右图从零累计到第 1 项，明确先乘、后加。",
    "equation": "$$F_{\\rm sum}^{(1)}=F_{\\rm sum}^{(0)}+B_{1,0}$$",
    "note": "右图使用该项真实复数数组的前后累计值。中间帧是讲解用插值，终点就是实际加法。",
    "cues": {
      "firstAdd": [
        0.12,
        0.82
      ]
    }
  },
  {
    "key": "remainingBands",
    "action": "累计其余八项",
    "duration": 14000,
    "title": "其余八项执行同样的乘法与加法。",
    "copy": "按方向与级次逐项读取完整频带，先形成 H*C，再加入同一个 F_sum。下方九个标记记录当前项与已完成项。",
    "equation": "$$F_{\\rm sum}^{(j+1)}=F_{\\rm sum}^{(j)}+H_j^*C_j$$",
    "note": "每一项只计一次，包括每方向零级。全部九项完成后，才引入它们留下的传递系数。",
    "cues": {
      "remaining": [
        0.04,
        0.92
      ]
    }
  },
  {
    "key": "basicResponse",
    "action": "辨认基础传递系数 R₀",
    "duration": 5000,
    "title": "九项之和是 F_sum，基础传递系数记作 R₀。",
    "copy": "理想且参数准确时，各项共享同一个 S(q)，所以 F_sum=R₀S。R₀ 对每条频带的 |H|² 都只计一次；下一幕再对照源码分母。",
    "equation": "$$F_{\\rm sum}=\\sum_{d,\\ell}H_{d,\\ell}^*C_{d,\\ell}=R_0S,\\qquad R_0=\\sum_{d,\\ell}|H_{d,\\ell}|^2$$",
    "note": "含噪声或参数失配时不把 F_sum=R₀S 当作精确数据恒等式。F_sum 与 R₀ 从实际重建数组读取。"
  }
];
  const timeline = Clock.define(definitions);
  const {key, action, cues, ...opening} = definitions[0];
  const scene = { ...{
  "label": "九项相加",
  "stageIndex": 17,
  "id": "sum-contributions",
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
