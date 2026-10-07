/* Immutable A snapshot, live B result, explicit empty/ready rendering. */
(function () {
  'use strict';

  const Lab = window.SIMLab;
  Lab.createComparisons = function ({
    acquisition: D
  }) {
    const C = window.SIMCore,
      {
        $,
        gray: draw
      } = Lab.ui;
    const {
      base,
      groups: groupMeta,
      groupOf,
      experiments,
      labels
    } = Lab.presets;
    const sel = $('wAexperiment');
    let reference = null,
      active = null,
      busy = false,
      initialized = false;
    function settings() {
      const x = D.readSettings(Object.keys(labels));
      x.seed = D.latest.params.seed;
      x.directions = D.latest.params.directionOn.map(Number).join('/');
      x.phases = D.latest.params.phaseOn.map(Number).join('/');
      return x;
    }
    function settingText(id, v) {
      if (id === 'wAcounts') return Math.round(10 ** Number(v)) + ' e⁻';
      if (id === 'wAreconMode') return v === 'known' ? '真值对照' : '数据估计';
      if (id === 'wAshot') return v ? '开' : '关';
      if (id === 'wAphase' || /^wAphi\d$/.test(id)) return Number(v) === 0 ? '0' : `${v}π/12`;
      if (id === 'wAangle' || /^wAang\d$/.test(id)) return v + '°';
      if (id === 'wAmerr' || id === 'wAotf') return v + '%';
      return String(v);
    }
    function snapshot() {
      const l = D.latest,
        mode = D.latest.mode,
        chosen = mode === 'known' ? l.known : l.estimated;
      const frames = l.data.groups.flatMap(g => g.frames),
        Q = l.params.electrons,
        B = l.params.background;
      const count = frames.length ? frames.reduce((s, f) => s + f.pixels.reduce((v, x) => v + x * Q - B, 0), 0) / (frames.length * l.data.n ** 2) : null;
      return {
        settings: settings(),
        params: l.params,
        raw: l.data,
        mode,
        truth: l.truth.map(t => ({
          index: t.index,
          m: t.m,
          mean: t.mean,
          period: t.period
        })),
        pixels: l.result.pixels?.slice() || null,
        reason: l.result.reason,
        used: {
          ...chosen.modulations
        },
        rmse: l.result.ok ? C.rmse(l.result.pixels, C.makeSample(l.data.n)) : null,
        count,
        reliable: l.estimated.estimates.filter(e => e.ok).length,
        estimateCount: l.estimated.estimates.length
      };
    }
    const text = (id, value) => {
      $(id).textContent = value;
    };
    const f = x => x == null ? '—' : x.toFixed(4);
    /* 指标明细改为分层结构：RMSE 独占一行作视觉焦点，真值/采用 m 拆三列对齐
       （差异 >5% 时高亮该方向），次要信息合并成一行中点分隔。
       目的是让"估计器准不准"这一对比一眼可见——原先两行 m 值同权重平铺，看不出差别。 */
    const METRIC_MISMATCH = 0.05;
    function metrics(id, s) {
      const clipped = s.pixels ? 100 * s.pixels.filter(x => x < 0 || x > 1).length / s.pixels.length : null;
      const root = $(id);
      root.replaceChildren();
      root.classList.add('metric-stack');
      const head = document.createElement('div');
      head.className = 'metric-head';
      const hl = document.createElement('span');
      hl.className = 'metric-head-label';
      hl.textContent = 'RMSE';
      const hv = document.createElement('span');
      hv.className = 'metric-head-value';
      hv.textContent = f(s.rmse);
      head.append(hl, hv);
      const table = document.createElement('div');
      table.className = 'metric-m-table';
      const headRow = document.createElement('div');
      headRow.className = 'metric-m-row metric-m-head';
      headRow.append(el('span', 'metric-m-label', ''));
      for (const i of [1, 2, 3]) headRow.append(el('span', 'metric-m-cell', '方向 ' + i));
      table.append(headRow);
      const rows = [['真值 m', s.truth, 'truth'], ['采用 m', s.used, 'used']];
      for (const [label, src, kind] of rows) {
        const row = document.createElement('div');
        row.className = 'metric-m-row metric-m-' + kind;
        row.append(el('span', 'metric-m-label', label));
        for (let i = 0; i < 3; i++) {
          let txt = '—',
            diff = false;
          if (kind === 'truth') {
            const t = src.find(t => t.index === i);
            txt = t ? t.m.toFixed(3) : '—';
          } else {
            txt = src[i] === undefined ? '—' : src[i].toFixed(3);
            const t = s.truth.find(t => t.index === i);
            // 只有"采用"侧且真值可得时才判断偏差，避免真值缺失时误标
            if (t && src[i] !== undefined && Math.abs(src[i] - t.m) > METRIC_MISMATCH * Math.max(Math.abs(t.m), 1e-6)) diff = true;
          }
          row.append(el('span', 'metric-m-cell' + (diff ? ' is-off' : ''), txt));
        }
        table.append(row);
      }
      const foot = document.createElement('div');
      foot.className = 'metric-foot';
      const bits = [['信号', s.count == null ? '—' : s.count.toFixed(0) + ' e⁻'], ['m 估计', s.reliable + '/' + s.estimateCount], ['截断', clipped == null ? '—' : clipped.toFixed(1) + '%'], ['来源', s.mode === 'known' ? '真值' : '估计']];
      for (const [k, v] of bits) foot.append(el('span', 'metric-foot-item', k + ' ' + v));
      root.append(head, table, foot);
    }
    function el(tag, cls, txt) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (txt !== undefined) e.textContent = txt;
      return e;
    }
    function render() {
      if (busy) return;
      $('wApairResults').hidden = !reference;
      $('wApairEmpty').hidden = !!reference;
      $('wAclearA').disabled = !reference;
      if (!reference) {
        for (const id of ['wApairChanges', 'wApairRelation', 'wApairALabel', 'wApairBLabel', 'wApairDelta']) text(id, '');
        for (const id of ['wApairARmse', 'wApairBRmse']) text(id, '—');
        for (const id of ['wApairAMetrics', 'wApairBMetrics']) $(id).replaceChildren();
        for (const id of ['wApairA', 'wApairB', 'wApairDiff']) {
          const canvas = $(id);
          canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
      }
      const b = snapshot(),
        a = reference;
      const changes = Object.keys(labels).filter(id => a.settings[id] !== b.settings[id]);
      const sameRaw = a.raw === b.raw,
        sameAcquisition = JSON.stringify(a.params) === JSON.stringify(b.params),
        unchanged = changes.length === 0;
      text('wApairRelation', sameRaw ? '同一批 raw：A / B 复用完全相同的原始帧与噪声实现。' : sameAcquisition ? '相同采集设置与种子：raw 已重新计算，数值可复现；这不是一次新的独立噪声测量。' : a.params.seed === b.params.seed ? '不同采集：A / B 改变了采集条件；保留同一随机种子以便复现，不能据此认定噪声实现相同。' : '不同采集：B 的采集条件或噪声种子已改变。');
      text('wApairChanges', unchanged ? '当前 B 与 A 的设置相同。可只改一个采集或重建参数。' : `相对 A 改变了 ${changes.length} 项：` + changes.map(id => `${labels[id]} ${settingText(id, a.settings[id])} → ${settingText(id, b.settings[id])}`).join('；'));
      text('wApairALabel', a.label || '保存时的控制台结果');
      const matchesPreset = active && Object.entries(active.b).every(([id, v]) => String(b.settings[id]) === String(v)) && changes.length === 1;
      text('wApairBLabel', matchesPreset ? active.bLabel : '实时结果 · 设置差异见上方');
      draw('wApairA', a.pixels);
      draw('wApairB', b.pixels);
      metrics('wApairAMetrics', a);
      metrics('wApairBMetrics', b);
      text('wApairARmse', f(a.rmse));
      text('wApairBRmse', f(b.rmse));
      if (a.pixels && b.pixels) {
        draw('wApairDiff', Float64Array.from(b.pixels, (v, i) => Math.abs(v - a.pixels[i])), .25);
        const delta = b.rmse - a.rmse;
        text('wApairDelta', `ΔRMSE ${delta > 0 ? '+' : ''}${delta.toFixed(4)} · ${Math.abs(delta) < 1e-8 ? '整体误差相同' : delta > 0 ? 'B 的误差较大' : 'B 的误差较小'}`);
      } else {
        draw('wApairDiff', null);
        text('wApairDelta', '至少一边没有可用重建；先检查相位秩、采集开关或激发是否被阻断。');
      }
    }
    function clear() {
      reference = null;
      active = null;
      showGroupHint(sel.value);
      text('wApairGuide', experiments.find(e => e.id === sel.value).guide);
      render();
    }
    function load(id) {
      const e = experiments.find(x => x.id === id);
      if (!e) return;
      busy = true;
      try {
        D.reset();
        D.assign({
          ...base,
          ...e.a
        });
        D.update();
        reference = snapshot();
        reference.label = e.aLabel;
        D.assign(e.b);
        D.update();
        active = e;
        sel.value = id;
        text('wApairGuide', e.guide);
        showGroupHint(e.id);
      } finally {
        busy = false;
      }
      render();
    }
    function showGroupHint(id) {
      const e = experiments.find(x => x.id === id);
      if (!e) return;
      const g = groupMeta[groupOf[e.id]];
      text('wAgroupHint', g.teaching);
    }
    function init() {
      if (initialized) return;
      initialized = true;
      sel.replaceChildren();
      const byGroup = {
        signal: [],
        contrast: [],
        calib: [],
        recon: []
      };
      for (const e of experiments) {
        const g = groupOf[e.id] || 'signal';
        byGroup[g].push(e);
      }
      for (const [g, items] of Object.entries(byGroup)) {
        if (!items.length) continue;
        const og = document.createElement('optgroup');
        og.label = groupMeta[g].title + ' · ' + groupMeta[g].hint;
        for (const e of items) {
          const opt = new Option(e.name, e.id);
          og.append(opt);
        }
        sel.append(og);
      }
      showGroupHint(sel.value || experiments[0].id);
      sel.addEventListener('change', () => {
        showGroupHint(sel.value);
        const e = experiments.find(x => x.id === sel.value);
        text('wApairGuide', e.guide + ' 点击“载入对照”后生效。');
      });
      text('wApairGuide', experiments.find(e => e.id === sel.value).guide);
      $('wAloadPair').addEventListener('click', () => load(sel.value));
      $('wAsaveA').addEventListener('click', () => {
        reference = snapshot();
        active = null;
        text('wApairGuide', '已保存当前结果为 A。只改变一个采集或重建参数；上方会列出全部差异，并提示是否复用同一批 raw。');
        render();
      });
      $('wAclearA').addEventListener('click', clear);
      D.subscribe(render);
      render();
    }
    return {
      init,
      load,
      clear,
      experiments,
      get reference() {
        return reference;
      }
    };
  };
})();
