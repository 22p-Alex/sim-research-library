/* A beat owns its duration, local cues and visibility. No DOM or playback clock. */
(function (root) {
  'use strict';
  const clamp = x => Math.max(0, Math.min(1, x));
  const round = x => Math.round(x * 1e12) / 1e12;
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ramp = (x, a, b) => {
    a = round(a); b = round(b);
    // A duration edit must not change which side owns an exact cue boundary.
    if(a===b)return Number(x>=a-1e-10);
    if(x>=b-1e-10)return 1;
    if(x<=a+1e-10)return 0;
    return ease((x-a)/(b-a));
  };
  function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze); Object.freeze(value);
    }
    return value;
  }
  function define(beats) {
    if (!Array.isArray(beats) || !beats.length) throw new Error('分镜不能为空。');
    const keys = new Set(), cues = new Set();
    const duration = beats.reduce((sum, b) => {
      if (!b.key || keys.has(b.key) || !Number.isFinite(b.duration) || b.duration <= 0) throw new Error('分镜名称必须唯一，时长必须为正数。');
      keys.add(b.key);
      const ranges = [...Object.entries(b.cues || {}), ...Object.entries(b.visibility || {})];
      for (const [key, range] of ranges) {
        if (!Array.isArray(range) || range.length !== 2 || range.some(x => !Number.isFinite(x) || x < 0 || x > 1) || range[0] > range[1]) throw new Error('无效的分镜局部区间：' + key);
      }
      for (const key of Object.keys(b.cues || {})) {
        if (cues.has(key)) throw new Error('重复动作：' + key);
        cues.add(key);
      }
      return sum + b.duration;
    }, 0);
    let elapsed = 0;
    const compiled = freeze(beats.map((b, index) => {
      const start = elapsed / duration; elapsed += b.duration;
      return { ...b, index, start, end: elapsed / duration };
    }));
    function at(progress) {
      if (!Number.isFinite(progress)) throw new Error('场景进度必须为有限数值。');
      const p = round(clamp(progress));
      const beat = compiled.find(b => p < round(b.end)) || compiled.at(-1);
      const signals = {}, panels = compiled.map(b => {
        // Keep unclamped local time for step cues at the start of future beats.
        const local = round((p - b.start) / (b.end - b.start));
        for (const [key, [a, z]] of Object.entries(b.cues || {})) signals[key] = ramp(local, a, z);
        const enter = b.visibility?.enter || [0, 0];
        const exit = b.visibility?.exit;
        return ramp(local, ...enter) * (exit ? 1 - ramp(local, ...exit) : 1);
      });
      return { progress: p, beat: beat.index, definition: beat, mode: beat.key,
        local: round(clamp((p - beat.start) / (beat.end - beat.start))), cues: signals, panels };
    }
    function progressFor(key, local = 0) {
      const beat = compiled.find(b => b.key === key);
      if (!beat || !Number.isFinite(local) || local < 0 || local > 1) throw new Error('分镜定位无效。');
      return round(beat.start + (beat.end - beat.start) * local);
    }
    return Object.freeze({ beats: compiled, duration, at, progressFor });
  }
  const api = { define, freeze, ramp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SIMBeatClock = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
