/* Chapter 1: analytic scene, ray diagram, line profiles and animation. */
(function () {
  'use strict';

  const Lab = window.SIMLab;
  Lab.createScene = function ({
    isActive
  }) {
    const C = window.SIMCore;
    const {
      $,
      value,
      fmt,
      tex,
      math,
      set,
      badge,
      output,
      gray
    } = Lab.ui;
    let mode = 'sim',
      phase = 0,
      sceneRAF = 0,
      current = null,
      initialized = false;
    function markPlay(id, playing, idleText) {
      const b = $(id);
      if (!b) return;
      b.textContent = playing ? '暂停动画' : idleText;
      b.classList.toggle('is-playing', playing);
      b.setAttribute('aria-pressed', String(playing));
    }
    function stopAnimations() {
      cancelAnimationFrame(sceneRAF);
      sceneRAF = 0;
      markPlay('t1_btn_sim_anim', false, '相移动画');
    }
    function drawLens(s) {
      const svg = $('t1_cv_illum_lens'),
        uniform = mode === 'widefield',
        passed = s.ex.transmitted;
      // Fixed scale in each pupil view: R ∝ 1/d_c, r ∝ 1/P_i.
      // A point in the back focal plane becomes a tilted plane wave. The
      // longitudinal distances below are schematic; they are not an NA calibration.
      const cx = 238,
        pupilY = 80,
        lensY = 177,
        sampleY = 324,
        f = lensY - pupilY;
      const R = 720 * s.kc,
        r = 540 * s.fi,
        ratio = r / R,
        pcx = 610,
        pcy = 148,
        pR = 352 * s.kc,
        pr = 264 * s.fi;
      const dirX = s.kx / s.fi,
        dirY = s.ky / s.fi,
        blue = '#397dac',
        amber = '#b98235',
        blocked = '#bb514c';
      const n = v => Number(v.toFixed(3));
      const line = (x1, y1, x2, y2, attrs = '') => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${attrs}/>`;
      const text = (x, y, label, cls = 'optic-label', attrs = '') => `<text x="${x}" y="${y}" class="${cls}" ${attrs}>${label}</text>`;
      const sourceColor = sign => passed ? sign < 0 ? blue : amber : blocked;
      let parts = `<defs>
      <marker id="optic-blue-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${blue}"/></marker>
      <marker id="optic-amber-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${amber}"/></marker>
      <clipPath id="optic-strip-clip"><rect x="118" y="324" width="240" height="18" rx="2"/></clipPath>
    </defs>`;
      parts += text(18, 20, '沿照明方向的纵向截面', 'optic-small');
      parts += line(492, 18, 492, 375, 'stroke="#e1e7ee"');
      parts += line(cx, 55, cx, 353, 'stroke="#c5cfdb" stroke-dasharray="4 5"');
      parts += text(18, 67, '后焦瞳面', 'optic-note');
      parts += `<rect x="38" y="76" width="${n(cx - R - 38)}" height="8" rx="2" fill="#64758a"/><rect x="${n(cx + R)}" y="76" width="${n(438 - cx - R)}" height="8" rx="2" fill="#64758a"/>`;
      for (const sign of [-1, 1]) parts += line(cx + sign * R, 70, cx + sign * R, 90, 'stroke="#344f73" stroke-width="2"');
      parts += `<rect x="54" y="164" width="368" height="26" rx="9" fill="#f1f5fa" stroke="#afc0d3"/>
      <path d="M64 177 Q238 141 412 177 Q238 207 64 177Z" fill="#e8f0f8" stroke="#7f9eba" stroke-width="1.3"/>`;
      parts += text(18, 152, '物镜 · 等效透镜', 'optic-note');
      if (uniform) {
        parts += text(cx, 45, '独立均匀照明', 'optic-note', 'text-anchor="middle"');
        for (const t of [-.6, -.2, .2, .6]) parts += line(cx + t * R, 88, cx + t * R, sampleY, `data-ray="uniform" stroke="${blue}" stroke-width="1.6" opacity=".65" marker-end="url(#optic-blue-arrow)"`);
      } else {
        for (const sign of [-1, 1]) {
          const xp = cx + sign * r,
            color = sourceColor(sign),
            labelX = sign < 0 ? 135 : 342;
          parts += text(labelX, 44, sign < 0 ? '光束 1' : '光束 2', 'optic-note', `text-anchor="middle" style="fill:${color}"`);
          parts += `<path d="M${labelX} 51 L${n(xp)} 64 V71" fill="none" stroke="${color}" stroke-width="1" opacity=".55"/>`;
          parts += `<circle cx="${n(xp)}" cy="${pupilY}" r="4.5" fill="${color}" stroke="white" stroke-width="1.5"/>`;
          if (!passed) {
            parts += `<path d="M${n(xp - 5)} 95l10 10m-10 0l10-10" stroke="${blocked}" stroke-width="1.6"/>`;
            continue;
          }
          // Three distinct parallel rays per beam: no fabricated common focus.
          const slope = -sign * r / f,
            shift = -slope * (sampleY - lensY),
            marker = sign < 0 ? 'blue' : 'amber';
          for (const d of [-24, 0, 24]) {
            const lx = cx + shift + d,
              sx = cx + d;
            parts += line(xp, pupilY + 5, lx, lensY, `stroke="${color}" stroke-width="1.1" opacity=".3"`);
            parts += line(lx, lensY, sx, sampleY, `data-ray="outgoing" stroke="${color}" stroke-width="${d === 0 ? 1.8 : 1.2}" opacity="${d === 0 ? .9 : .55}"`);
            const ya = 253,
              yb = 275;
            parts += line(lx + slope * (ya - lensY), ya, lx + slope * (yb - lensY), yb, `stroke="${color}" stroke-width="1.4" marker-end="url(#optic-${marker}-arrow)"`);
          }
          for (const y of [231, 294]) {
            const x = cx + shift + slope * (y - lensY);
            parts += line(x - 24, y + slope * 24, x + 24, y - slope * 24, `stroke="${color}" stroke-width="1" opacity=".25"`);
          }
        }
      }
      parts += text(18, 239, uniform ? '均匀照明' : passed ? '两组倾斜平面波' : '入瞳阻断', 'optic-note');
      parts += text(18, 257, uniform ? '照明强度不随位置变化' : passed ? '每组箭线彼此平行' : '样品侧没有激发光', 'optic-small');
      parts += line(70, 346, 406, 346, 'stroke="#8e9cab" stroke-width="2"');
      parts += '<g clip-path="url(#optic-strip-clip)"><rect x="118" y="324" width="240" height="18" fill="black"/>';
      for (let i = 0; i < 160; i++) {
        const u = (i + .5) / 160 * 120,
          v = s.at(u * dirX, u * dirY).illumination,
          g = Math.round(Math.max(0, Math.min(1, v / 2)) * 255);
        parts += `<rect x="${118 + i * 1.5}" y="324" width="1.55" height="18" fill="rgb(${g},${g},${g})"/>`;
      }
      parts += '</g>';
      parts += text(cx, 367, '样品面 · 沿照明方向读取 I(u)', 'optic-note', 'text-anchor="middle"');
      parts += text(cx, 387, '纵向距离仅作示意；不绘制有限光斑包络', 'optic-small', 'text-anchor="middle"');
      parts += text(pcx, 20, '瞳面俯视 · 固定标尺', 'optic-small', 'text-anchor="middle"');
      parts += `<circle cx="${pcx}" cy="${pcy}" r="88" fill="#f2f4f7" stroke="#d4dde7" stroke-dasharray="3 4"/>`;
      parts += line(pcx - 96, pcy, pcx + 96, pcy, 'stroke="#d9e1e9"') + line(pcx, pcy - 96, pcx, pcy + 96, 'stroke="#d9e1e9"');
      parts += `<circle data-optic="aperture" cx="${pcx}" cy="${pcy}" r="${n(pR)}" fill="${uniform ? '#edf4fb' : 'white'}" stroke="#6f8faf" stroke-width="1.8"/>`;
      parts += line(pcx, pcy, pcx, pcy - pR, 'stroke="#7b91a9" stroke-width="1.2"');
      parts += text(pcx + 7, n(pcy - pR / 2), 'R', 'optic-note');
      if (!uniform) for (const sign of [-1, 1]) {
        const x = pcx + sign * pr * dirX,
          y = pcy - sign * pr * dirY,
          color = sourceColor(sign);
        parts += line(pcx, pcy, x, y, `stroke="${color}" stroke-dasharray="2 3" opacity=".7"`);
        parts += `<circle data-optic="beam-${sign < 0 ? 'negative' : 'positive'}" cx="${n(x)}" cy="${n(y)}" r="3.7" fill="${color}" stroke="white" stroke-width="1.1"/>`;
      }
      parts += text(pcx, 259, uniform ? '均匀宽场' : `r / R = ${n(ratio)}`, 'optic-reading', 'text-anchor="middle"');
      parts += text(pcx, 280, uniform ? '无干涉调制' : passed ? '双束位于入瞳内' : '双束已超出入瞳', 'optic-note', `text-anchor="middle" style="fill:${passed ? '#47647d' : blocked}"`);
      parts += text(pcx, 311, `照明频率方向 ${fmt(Math.atan2(s.ky, s.kx) * 180 / Math.PI)}°`, 'optic-note', 'text-anchor="middle"');
      parts += text(pcx, 333, 'd_c 改变入瞳半径 R', 'optic-small', 'text-anchor="middle"');
      parts += text(pcx, 351, 'P_i 改变光束径向位置 r', 'optic-small', 'text-anchor="middle"');
      svg.innerHTML = parts;
      svg.setAttribute('data-state', uniform ? 'uniform' : passed ? 'transmitted' : 'blocked');
      svg.setAttribute('aria-label', uniform ? '均匀宽场照明：样品侧照明恒定' : `双束照明，光束径向位置与入瞳半径之比 ${n(ratio)}，${passed ? '双束通过，样品侧为两组倾斜平面波' : '双束被阻断，样品侧无激发光'}`);
    }
    function drawWaves(s) {
      const w = 660,
        left = 46,
        right = 644,
        scale = (right - left) / 120,
        colors = ['#cbd5e1', '#38bdf8', '#fbbf24', '#4ade80'];
      const names = ['CH1 · 样品', 'CH2 · 照明', 'CH3 · 发射 = 样品 × 照明', 'CH4 · 相机 = 发射经过镜头模糊'];
      const keys = ['sample', 'illumination', 'emission', 'camera'];
      let svg = '';
      for (let row = 0; row < 4; row++) {
        const top = 30 + row * 90,
          bottom = top + 52;
        if (row === 3) svg += '<rect x="8" y="282" width="644" height="79" rx="7" fill="#143426" fill-opacity=".65"/>';
        svg += `<text x="${left}" y="${top - 10}" fill="${colors[row]}" font-size="12">${names[row]}</text>`;
        for (const v of [0, 1, 2]) {
          const y = bottom - v * 26;
          svg += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#334155" stroke-dasharray="3 3"/><text x="23" y="${y + 4}" fill="#94a3b8" font-size="10">${v}</text>`;
        }
        const points = [];
        for (let i = 0; i <= 600; i++) {
          const x = i / 5,
            v = s.at(x, 120),
            px = left + x * scale;
          points.push(`${px.toFixed(2)},${(bottom - v[keys[row]] * 26).toFixed(2)}`);
        }
        svg += `<polyline points="${points.join(' ')}" fill="none" stroke="${colors[row]}" stroke-width="1.5"/>`;
      }
      svg += '<text x="46" y="380" fill="#94a3b8" font-size="11">x = 0 px</text><text x="570" y="380" fill="#94a3b8" font-size="11">120 px</text>';
      $('t1_waves').innerHTML = svg;
    }
    function sceneParams() {
      return {
        samplePeriod: value('t1_ss'),
        illumPeriod: value('t1_si'),
        angle: value('t1_sa'),
        m: value('t1_m'),
        phase,
        mode,
        cutoffPeriod: value('t1_cutoff_range')
      };
    }
    function updateScene() {
      const p = sceneParams(),
        s = C.scene(p),
        w = 600,
        h = 240;
      const arrays = {
        sample: new Float64Array(w * h),
        emission: new Float64Array(w * h),
        camera: new Float64Array(w * h)
      };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = s.at(x, y),
          i = y * w + x;
        arrays.sample[i] = v.sample;
        arrays.emission[i] = v.emission;
        arrays.camera[i] = v.camera;
      }
      gray('t1_cv_sample', arrays.sample, 2);
      gray('t1_cv_mod', arrays.emission, 2);
      gray('t1_cv_camera', arrays.camera, 2);
      for (const id of ['t1_cv_sample', 't1_cv_mod', 't1_cv_camera']) {
        const ctx = $(id).getContext('2d');
        ctx.strokeStyle = 'rgba(56,189,248,.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(0, 120);
        ctx.lineTo(600, 120);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      drawLens(s);
      drawWaves(s);
      for (const id of ['t1_cutoff_range', 't1_ss', 't1_si']) output(id, ' px');
      output('t1_sa', '°');
      output('t1_m');
      math('t1_phi_out', `${fmt(phase / Math.PI)}\\pi`);
      $('t1_cv_illum_lens_footer').innerHTML = `<span>激发截止周期 <strong>${fmt(s.exPeriod)} px</strong></span><span>平均照明 ${tex(`I_0=${s.ex.mean}`)}</span>${mode === 'sim' ? '<span>光束径向位置 / 入瞳半径 ' + fmt(s.fi * s.exPeriod) + '</span>' : ''}`;
      const sim = s.ex.mean && s.ex.m > 0;
      set('t1_cP', sim ? s.diff < 1e-10 ? '∞' : fmt(1 / s.diff) + ' px' : '—（均匀照明无差频）');
      set('t1_cH', sim ? s.hd.toFixed(3) : '—');
      set('t1_cM', s.ex.mean ? s.ex.m.toFixed(2) : '无激发');
      set('t1_cG', sim ? s.maxGain.toFixed(2) + '×' : '—');
      let status,
        tone = 'green',
        label;
      if (!s.ex.mean) {
        status = '理想点光束均超出入瞳：平均照明、发射荧光和无噪声相机信号均为零；无可恢复频带。';
        label = '无激发';
        tone = 'red';
      } else if (s.ex.m === 0) {
        status = s.hs > 0 ? '均匀照明：样品本征频率位于检测通带内，保留其衰减后的条纹。' : '均匀照明：样品本征频率位于截止点或通带外，只保留平均亮度。';
        label = '均匀照明';
        tone = s.hs > 0 ? 'blue' : 'amber';
      } else if (s.diff < 1e-10) {
        status = '差频为零：差频项成为随相位变化的直流亮度，直流 OTF 为 1。相机是否还有空间条纹，取决于其余频率是否在通带内。';
        label = '差频为直流';
        tone = 'blue';
      } else if (s.hd > 0 && s.hs === 0) {
        status = '样品细条纹超出检测带宽，差频进入通带。相机还可能含照明频率项；需多相位解混才能恢复原频带。';
        label = '差频可传递';
      } else if (s.hs > 0) {
        status = '样品本征频率已可直接传递；相机同时保留所有位于通带内的样品、照明、差频和和频分量。';
        label = '本征频率可见';
        tone = 'blue';
      } else {
        status = '样品本征频率与差频均在检测通带外或截止点。可能仍能看到照明条纹，但这不等于恢复了样品细节。';
        label = '目标频率未传递';
        tone = 'amber';
      }
      set('t1_cam_status', status);
      badge('t1_txt_det_badge', label, tone);
      badge('t1_txt_ex_badge', !s.ex.mean ? '两束光被阻断' : mode === 'widefield' ? '均匀宽场' : s.ex.m === 0 ? '无调制' : `照明真值 ${s.ex.m.toFixed(2)}`, !s.ex.mean ? 'red' : 'blue');
      $('t1_cutoff_explain').innerHTML = `检测 ${tex(`f_c=${s.kc.toFixed(4)}\\,\\mathrm{px}^{-1}`)}；${tex(`H(f_s)=${s.hs.toFixed(3)}`)}，${tex(`H(f_i)=${s.hi.toFixed(3)}`)}。蓝色虚线为波形取样行。`;
      current = {
        params: p,
        model: s,
        arrays
      };
    }
    function toggleAnimation() {
      if (sceneRAF) {
        stopAnimations();
        return;
      }
      markPlay('t1_btn_sim_anim', true);
      let last = 0;
      function step(now) {
        if (!isActive() || document.hidden) {
          stopAnimations();
          return;
        }
        if (!last) last = now;
        const delta = (now - last) / 1000;
        if (delta >= 1 / 30) {
          phase = (phase + delta) % C.TAU;
          $('t1_phi').value = phase / Math.PI;
          updateScene();
          last = now;
        }
        sceneRAF = requestAnimationFrame(step);
      }
      sceneRAF = requestAnimationFrame(step);
    }
    function reset() {
      stopAnimations();
      for (const el of $('tab1Content').querySelectorAll('input[type=range]')) el.value = el.defaultValue;
      mode = 'sim';
      phase = 0;
      Lab.convOtf.reset();
      set('t1_btn_laser_toggle', '切换为均匀宽场');
      $('t1_btn_laser_toggle').setAttribute('aria-pressed', 'true');
      updateScene();
    }
    function init() {
      if (initialized) return;
      initialized = true;
      $('t1_btn_sim_anim').addEventListener('click', toggleAnimation);
      $('t1_btn_laser_toggle').addEventListener('click', () => {
        mode = mode === 'sim' ? 'widefield' : 'sim';
        set('t1_btn_laser_toggle', mode === 'sim' ? '切换为均匀宽场' : '切换为双束干涉');
        $('t1_btn_laser_toggle').setAttribute('aria-pressed', String(mode === 'sim'));
        updateScene();
      });
      for (const id of ['t1_cutoff_range', 't1_ss', 't1_si', 't1_sa', 't1_m', 't1_phi']) {
        const el = $(id);
        if (el) el.addEventListener('input', () => {
          phase = value('t1_phi') * Math.PI;
          updateScene();
        });
      }
    }
    return {
      init,
      update: updateScene,
      reset,
      stop: stopAnimations,
      get current() {
        return current;
      }
    };
  };
})();
