/* Chapter 2: controls → cached acquisition → estimated/known reconstruction.
 * Subscribers receive a complete computed state, after the view has rendered.
 */
(function () {
  'use strict';

  const Lab = window.SIMLab;
  Lab.createAcquisition = function () {
    const C = window.SIMCore,
      E = window.SIMExperiment;
    const {
      $,
      value,
      fmt,
      piTex,
      piPlain,
      tex,
      math,
      set,
      badge,
      output,
      gray
    } = Lab.ui;
    const N = 128,
      sample = C.makeSample(N),
      listeners = new Set();
    let seed = 240924,
      acquisitionKey = '',
      acquisition = null,
      latest = null;
    let modalFocus = null,
      initialized = false;
    function acquisitionParams() {
      return {
        period: value('wAp'),
        exPeriod: 9,
        visibility: value('wAm'),
        kc: 1 / 12,
        readNoise: value('wAnoise'),
        seed,
        opticsMode: 'finite',
        contrastRollOff: 'none',
        spotRadius: .12,
        decenter: 0,
        balance: value('wAbalance'),
        illumBackground: value('wAillumBg'),
        electrons: 10 ** value('wAcounts'),
        background: value('wAbg'),
        shotNoise: $('wAshot').checked,
        angles: [1, 2, 3].map(i => value('wAang' + i)),
        phases: [1, 2, 3].map(i => value('wAphi' + i) * Math.PI / 12),
        directionOn: [1, 2, 3].map(i => $('wAdir' + i).checked),
        phaseOn: [true, true, true]
      };
    }
    function reconstructionOptions() {
      return {
        eps: value('wAepsr'),
        phaseError: value('wAphase') * Math.PI / 12,
        angleError: value('wAangle'),
        modulationError: value('wAmerr') / 100,
        otfError: value('wAotf') / 100,
        errorsAffectEstimator: true
      };
    }
    function drawMap(p, result) {
      const kc = p.kc,
        angles = result.ok ? result.angles : [],
        bands = result.ok ? result.bands : [];
      const radial = a => Math.max(kc, ...bands.map(b => C.radialSupport(a, kc, b.period, [b.angle])));
      // Fixed physical viewport, sized for the largest admissible illumination frequency.
      // Changing P_i must move the sideband centers, not resize the objective's OTF.
      const scale = 102 / (kc + 1 / p.exPeriod),
        r = kc * scale,
        c = 120;
      let svg = '<rect width="240" height="240" fill="white"/>';
      svg += '<line x1="8" y1="120" x2="232" y2="120" stroke="#e2e8f0"/><line x1="120" y1="8" x2="120" y2="232" stroke="#e2e8f0"/>';
      const circles = [[0, 0]];
      for (const b of bands) for (const sign of [-1, 1]) circles.push([sign * Math.cos(b.angle * Math.PI / 180) / b.period, sign * Math.sin(b.angle * Math.PI / 180) / b.period]);
      for (const [x, y] of circles) svg += `<circle cx="${c + x * scale}" cy="${c - y * scale}" r="${r}" fill="#dbeafe" fill-opacity=".2" stroke="#60a5fa" stroke-dasharray="4 3"/>`;
      svg += `<circle cx="120" cy="120" r="${r}" fill="#eff6ff" stroke="#2563eb"/>`;
      const pts = [];
      for (let deg = 0; deg < 360; deg++) {
        const a = deg * Math.PI / 180,
          rr = radial(a) * scale;
        pts.push(`${(c + rr * Math.cos(a)).toFixed(2)},${(c - rr * Math.sin(a)).toFixed(2)}`);
      }
      svg += `<polygon points="${pts.join(' ')}" fill="none" stroke="#b91c1c" stroke-width="1.4"/>`;
      for (const a of [0, 60, 120]) for (const sign of [-1, 1]) {
        const x = sign * Math.cos(a * Math.PI / 180) / 7.5,
          y = sign * Math.sin(a * Math.PI / 180) / 7.5,
          inside = result.ok && (Math.hypot(x, y) < kc || bands.some(b => C.inSupport(x, y, kc, b.period, [b.angle])));
        svg += `<circle cx="${c + x * scale}" cy="${c - y * scale}" r="3.5" fill="${inside ? '#16a34a' : '#94a3b8'}"/>`;
      }
      for (const tick of [-2, -1, 1, 2]) {
        const x = c + tick * r,
          y = c - tick * r;
        svg += `<line x1="${x}" y1="117" x2="${x}" y2="123" stroke="#64748b"/><text x="${x}" y="134" text-anchor="middle" fill="#64748b" font-size="9">${tick}</text>`;
        svg += `<line x1="117" y1="${y}" x2="123" y2="${y}" stroke="#64748b"/><text x="112" y="${y + 3}" text-anchor="end" fill="#64748b" font-size="9">${tick}</text>`;
      }
      svg += `<foreignObject x="202" y="96" width="37" height="22"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:10px;color:#64748b">${tex('f_x/f_c')}</div></foreignObject><foreignObject x="126" y="2" width="40" height="24"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:10px;color:#64748b">${tex('f_y/f_c')}</div></foreignObject>`;
      $('wAmap').innerHTML = svg;
      set('wAext', result.ok ? `${angles.length} 个方向` : '暂无重建');
    }
    function updateReconstruction() {
      const p = acquisitionParams(),
        options = reconstructionOptions(),
        key = JSON.stringify(p);
      if (key !== acquisitionKey) {
        acquisition = E.capture(sample, N, p);
        acquisitionKey = key;
      }
      const estimated = E.run(acquisition.raw, acquisition.calibration, options);
      const truthMods = Object.fromEntries(acquisition.truth.map(t => [t.index, t.m]));
      const known = E.run(acquisition.raw, acquisition.calibration, options, truthMods);
      const isKnown = $('wAreconMode').value === 'known',
        selected = isKnown ? known : estimated,
        r = selected.result;
      const frames = acquisition.raw.groups.flatMap(g => g.frames.map(f => ({
          group: g,
          frame: f
        }))),
        wf = acquisition.widefield;
      gray('wAc0', sample);
      gray('wAc1', wf);
      gray('wAc2', frames.length ? frames[0].frame.pixels : null);
      gray('wAc3', r.pixels);
      $('wAc2_footer').innerHTML = frames.length ? `方向 ${frames[0].group.index + 1} · ${tex(`\\phi=${piTex(frames[0].frame.phase)}`)}` : '未选择采集帧';
      set('wAc2h', `查看 ${frames.length} 帧`);
      const distinct = C.uniqueAngles(acquisition.calibration.groups.filter(g => acquisition.raw.groups.find(x => x.index === g.index)?.frames.length).map(g => g.angle));
      let status = '',
        tone = 'blue',
        label;
      const err = options.phaseError || options.angleError || options.modulationError || options.otfError;
      // A mismatch that also reaches the estimator can trip its reliability screen,
      // so the sidebands are dropped and the artefact never becomes visible.
      const estimatorPolluted = !!err && options.errorsAffectEstimator !== false;
      if (!r.ok) {
        tone = 'red';
        label = '无法重建';
        if (r.reason === 'no-data') status = '没有采集帧。请开启至少一个采集方向。';else if (r.reason === 'blocked') status = '激发光被阻断，无法重建。请增大照明周期或调整光路。';else if (r.reason === 'phase-rank') status = `相位矩阵秩为 ${r.system.rank}/3。请使用三个不同相位；0 与 2π 等价。`;else status = '相位过于接近，无法稳定重建。请拉开三个相位的间隔。';
      } else if (r.reason === 'widefield') {
        label = '仅零级频带';
        tone = 'amber';
        // The known-m run on identical raw isolates screening from real bandwidth loss.
        const screenedOut = !isKnown && known.result.ok && known.result.reason !== 'widefield';
        status = isKnown ? '调制度为零，当前只能得到宽场结果。' : screenedOut && estimatorPolluted ? '调制度估计未通过可靠性筛查，当前只保留宽场信息。可将调制度切换为“使用真值对照”，观察失配伪影。' : '未能可靠估计调制度，当前只保留宽场信息。可提高信号计数后重试。';
      } else {
        label = isKnown ? '已知参数对照' : '数据估计重建';
        if (err) {
          label = '含校准失配';
          tone = 'amber';
          status = isKnown ? '使用真值对照保留一级频带，可在图像中观察校准失配造成的条纹错位与伪影。' : `失配同时进入估计与重建${r.omitted?.length ? `；方向 ${r.omitted.map(x => x + 1).join('、')} 仅保留宽场信息` : ''}。详见重建设置。`;
        } else if (r.omitted?.length) {
          tone = 'amber';
          status = `方向 ${r.omitted.map(x => x + 1).join('、')} 的估计不可靠，仅保留该方向的宽场信息。`;
        } else if (r.condition > 10) {
          label = '相位病态';
          tone = 'amber';
          status = '相位过于接近，噪声容易被放大。请调整相位间隔。';
        } else if (distinct.length < 3) {
          label = '方向覆盖受限';
          tone = 'amber';
          status = `当前只有 ${distinct.length} 个不同方向，其他方向的细节可能无法恢复。`;
        }
      }
      badge('wAc3b', label, tone);
      set('wAc3_footer', r.ok ? `${r.total} 帧联合重建` : '未生成结果');
      set('wAst', status);
      $('wAst').hidden = !status;
      set('wAme', [0, 1, 2].map(i => {
        const e = estimated.estimates.find(e => e.index === i);
        return e?.ok ? e.m.toFixed(3) : '—';
      }).join(' / '));
      const reliable = estimated.estimates.filter(e => e.ok).length;
      set('wAquality', `${reliable} / ${estimated.estimates.length}`);
      const signalCounts = frames.length ? frames.reduce((sum, {
        frame
      }) => sum + frame.pixels.reduce((s, v) => s + v * p.electrons - p.background, 0), 0) / (frames.length * N * N) : null;
      set('wAphotons', signalCounts === null ? '—' : Math.max(0, signalCounts).toFixed(1));
      const maxFi = Math.max(0, ...(r.bands || []).map(b => 1 / b.period));
      const gain = r.ok ? 1 + maxFi / p.kc : null;
      set('wAk3', gain ? gain.toFixed(2) + '×' : '—');
      const rmse = result => result.ok ? C.rmse(result.pixels, sample).toFixed(4) : '—';
      set('wAcurrentRmse', rmse(r));
      set('wArmse', `RMSE：估计参数 ${rmse(estimated.result)} / 已知调制度 ${rmse(known.result)} / 无噪声宽场 ${C.rmse(wf, sample).toFixed(4)}`);
      const condition = r.ok ? r.condition : r.system?.condition;
      set('wAcondition', `相位条件数：${condition === undefined ? '—' : Number.isFinite(condition) ? condition.toFixed(2) : '∞'}`);
      const clipped = r.pixels ? Array.from(r.pixels).filter(x => x < 0 || x > 1).length / r.pixels.length : 0;
      set('wAclip', r.ok ? `重建显示截断：${(100 * clipped).toFixed(1)}% 像素` : '');
      for (const id of ['wAp', 'wAm', 'wAnoise', 'wAepsr', 'wAbalance', 'wAillumBg', 'wAbg']) output(id, id === 'wAp' ? ' px' : '');
      set('wAcounts_out', Math.round(p.electrons) + ' e⁻');
      output('wAangle', '°');
      output('wAmerr', '%');
      output('wAotf', '%');
      math('wAphase_out', piTex(options.phaseError));
      for (let i = 1; i <= 3; i++) {
        output('wAang' + i, '°');
        math('wAphi' + i + '_out', piTex(p.phases[i - 1]));
      }
      const reasons = {
        'phase-rank': '相位秩不足',
        'ill-conditioned': '相位病态',
        'weak-overlap': '重叠区信号不足',
        'weak-modulation': '调制未可靠检出',
        'model-mismatch': '模型匹配不佳',
        'fit': '通过筛查',
        'boundary': '触及物理边界'
      };
      $('wAestimates').innerHTML = [0, 1, 2].map(i => {
        const t = acquisition.truth.find(x => x.index === i),
          e = estimated.estimates.find(x => x.index === i),
          used = selected.modulations?.[i];
        if (!t) return `<tr><td>${i + 1}</td><td colspan="6">未采集该方向</td></tr>`;
        const detail = e ? `${reasons[e.reason]}<small>${e.points} 点 · 相关 ${e.correlation === undefined ? '—' : e.correlation.toFixed(3)} · 残差 ${e.residual == null ? '—' : e.residual.toFixed(3)}</small>` : '无可用帧或无激发';
        const estimate = e?.ok ? e.m.toFixed(3) : `—${e?.rawM != null ? `<small>候选 ${e.rawM.toFixed(3)}</small>` : ''}`;
        return `<tr><td>${i + 1}<small>${p.angles[i]}°</small></td><td>${t.m > 0 ? t.period.toFixed(3) : '无调制载频'}</td><td>${t.mean.toFixed(3)}<small>透过 ${t.plus.T.toFixed(2)} / ${t.minus.T.toFixed(2)}</small></td><td>${t.mean ? t.edge < 1 ? `${t.m.toFixed(3)}<small>v×${t.edge.toFixed(2)}</small>` : t.m.toFixed(3) : '无激发'}</td><td class="${e?.ok ? '' : 'unreliable'}">${estimate}</td><td>${used === undefined ? '—' : used > 0 ? used.toFixed(3) : '仅零级'}</td><td class="${e?.ok ? '' : 'unreliable'}">${detail}</td></tr>`;
      }).join('');
      drawMap(p, r);
      latest = {
        params: p,
        options,
        data: acquisition.raw,
        calibration: acquisition.calibration,
        truth: acquisition.truth,
        estimated,
        known,
        result: r,
        wf,
        mode: isKnown ? 'known' : 'estimated'
      };
      renderMismatchImpact(p, r);
      if (!$('wAmodal').hidden) fillModal();
      for (const listener of listeners) listener(latest);
    }
    /* 失配卡片不用固定讲解：按当前滑块取值与筛查结果，动态生成“这次调整产生的影响”。 */
    function renderMismatchImpact(p, r) {
      const a = value('wAangle'),
        ph = value('wAphase'),
        me = value('wAmerr'),
        oe = value('wAotf'),
        eps = value('wAepsr');
      const act = acquisition.calibration.groups.filter(g => $('wAdir' + (g.index + 1)).checked && acquisition.raw.groups.find(x => x.index === g.index)?.frames.length);
      const per = act.length ? Math.min(...act.map(g => g.period || value('wAp'))) : value('wAp');
      const ext = 1 + 1 / (per * p.kc),
        segs = [];
      if (a) segs.push(`角度 +${a}°：支持域边缘（≈${ext.toFixed(2)}× 检测截止）的频带位置误差 ≈ ${(ext * Math.sin(a * Math.PI / 180)).toFixed(2)}× 检测截止`);
      if (ph) segs.push(`相位 +${piPlain(ph * Math.PI / 12)}（三相位间隔不变）：重建条纹整体平移 ≈ ${(ph * per / 24).toFixed(1)} px`);
      if (me) segs.push(`采用 m ×${(1 + me / 100).toFixed(2)}：一级频带幅度与融合权重同比例失真，不改变真实照明`);
      if (oe) segs.push(`假设截止 ×${(1 + oe / 100).toFixed(2)}：OTF 权重失配，真实检测带宽不变`);
      const estMis = a || ph || oe,
        est = latest.estimated.estimates,
        rel = est.filter(e => e.ok).length;
      if (estMis && $('wAreconMode').value === 'known') segs.push(`估计筛查通过 ${rel}/${est.length} 个方向；当前使用真值 m，一级频带不因调制度估计被拒而丢弃`);else if (estMis && rel < est.length) segs.push(`失配同时进入估计器：筛查通过 ${rel}/${est.length} 个方向，被拒方向降级为零级${r.reason === 'widefield' ? '，重建已退化为宽场，拖滑块看似无效——这是估计器的自我保护，不是伪影本身' : ''}`);else if (estMis) segs.push(`筛查通过 ${rel}/${est.length}、一级频带保留：失配直接表现为频带错位、泄漏、鬼影与方向性条纹`);
      $('wAerrImpact').textContent = (segs.length ? '只改变估计与重建、不重新生成 raw。' : '未注入失配：拖动任一滑块看它的单独影响。') + (segs.length ? segs.join('；') + '。' : '') + `正则 ε=${fmt(eps)}：|T|=${fmt(eps)} 处融合权重减半，越大越平滑。`;
    }
    function fillModal() {
      if (!latest) return;
      const data = latest.data;
      let html = '';
      for (let d = 0; d < 3; d++) for (let q = 0; q < 3; q++) {
        const group = data.groups.find(g => g.index === d),
          frame = group?.frames.find(f => f.index === q);
        html += `<div><canvas id="raw_${d}_${q}" width="128" height="128" style="width:100%;display:block;border-radius:6px"></canvas><p class="legend">方向 ${d + 1} · ${tex(`\\phi=${piTex(latest.params.phases[q])}`)}${frame ? '' : ' · 未采集'}</p></div>`;
      }
      $('wAmodalGrid').innerHTML = html;
      for (let d = 0; d < 3; d++) for (let q = 0; q < 3; q++) {
        const f = data.groups.find(g => g.index === d)?.frames.find(f => f.index === q);
        gray(`raw_${d}_${q}`, f?.pixels || null);
      }
      const total = data.groups.reduce((s, g) => s + g.frames.length, 0);
      set('wAmodalInfo', `本次实际采集 ${total} 帧。显示的是同一批 raw（光电子计数除以计数尺度 Q），尚未扣除背景和照明标定；所有图固定标尺 0–1。噪声种子 ${seed}。`);
    }
    function openModal() {
      modalFocus = document.activeElement;
      fillModal();
      $('wAmodal').hidden = false;
      $('wAmodal').style.display = 'flex';
      $('wAmodalClose').focus();
    }
    function closeModal() {
      $('wAmodal').hidden = true;
      $('wAmodal').style.display = 'none';
      modalFocus?.focus();
    }
    let pending = 0;
    function queueReconstruction() {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        pending = 0;
        updateReconstruction();
      });
    }
    function syncDirections() {
      for (const i of [1, 2, 3]) {
        const enabled = $('wAdir' + i).checked;
        $('wAang' + i).disabled = !enabled;
        $('wAdirCard' + i).classList.toggle('is-off', !enabled);
        set('wAdirState' + i, enabled ? '采集' : '停用');
      }
      const count = [1, 2, 3].filter(i => $('wAdir' + i).checked).length;
      set('wAdirectionCount', `${count} 个方向 · ${count * 3} 帧`);
    }
    function readSettings(ids) {
      return Object.fromEntries(ids.filter(id => document.getElementById(id)).map(id => {
        const element = $(id);
        return [id, element.type === 'checkbox' ? element.checked : element.value];
      }));
    }
    function assign(values) {
      for (const [id, value] of Object.entries(values)) {
        const element = $(id);
        if (element.type === 'checkbox') element.checked = value;else element.value = value;
      }
      syncDirections();
    }
    function reset() {
      cancelAnimationFrame(pending);
      pending = 0;
      for (const element of $('tab2Content').querySelectorAll('input[type=range]')) {
        element.value = element.defaultValue;
      }
      $('wAreconMode').value = 'estimated';
      $('wAshot').checked = true;
      for (const i of [1, 2, 3]) $('wAdir' + i).checked = true;
      seed = 240924;
      syncDirections();
      updateReconstruction();
    }
    function idealPreset() {
      reset();
      assign({
        wAshot: false,
        wAnoise: 0,
        wAbg: 0,
        wAillumBg: 0
      });
      updateReconstruction();
    }
    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
    function init() {
      if (initialized) return;
      initialized = true;
      for (const i of [1, 2, 3]) {
        $('wAdir' + i).addEventListener('change', () => {
          syncDirections();
          queueReconstruction();
        });
      }
      for (const element of $('tab2Content').querySelectorAll('input[type=range]')) {
        element.addEventListener('input', queueReconstruction);
      }
      for (const id of ['wAreconMode', 'wAshot']) $(id).addEventListener('change', queueReconstruction);
      $('wAresample').addEventListener('click', () => {
        seed++;
        updateReconstruction();
      });
      $('wAc2h').addEventListener('click', openModal);
      $('wAmodalClose').addEventListener('click', closeModal);
      $('wAmodal').addEventListener('click', e => {
        if (e.target === $('wAmodal')) closeModal();
      });
      document.addEventListener('keydown', e => {
        if (!$('wAmodal').hidden) {
          if (e.key === 'Escape') closeModal();
          if (e.key === 'Tab') {
            e.preventDefault();
            $('wAmodalClose').focus();
          }
        }
      });
      syncDirections();
    }
    return {
      init,
      reset,
      idealPreset,
      assign,
      readSettings,
      subscribe,
      update: updateReconstruction,
      get latest() {
        return latest;
      }
    };
  };
})();
