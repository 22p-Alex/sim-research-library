/* Buildless, offline renderer. SVG objects retain their identity throughout
 * the story. All animation state comes from the one SIMMotion playhead.
 * KaTeX emits native MathML, so no network fonts or CDN runtime are needed. */
(function () {
  'use strict';
  const M = window.SIMMotion, A = window.SIMAtlas;
  const Chapter = window.SIMMotionParameterChapter;
  let Flow, rehearsal;
  let buildDemixMatrix, buildDemixProof, drawDemix;
  let buildSources, drawRelocationGrid;
  let buildFrames, paintAcquisition;
  let buildEncodingAlgebra;
  const $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let lesson, player, fullStages, currentScene = -1, currentStopIndex = -1, focusBeforeDialog = null;
  let excitationPhase = 0, fourierLesson = null;
  let timeline = null, scrubbing = false;
  let parameterChapter, parameterView, parameterFormulaView, bridgeView, reconstruction;
  let headingHandoff,noteHandoff;
  const stopButtons = [];
  const motionFormulaNodes = new Map();
  const create = (tag, attrs = {}, parent, text) => {
    const el = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    if (text !== undefined) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  };
  // Setting textContent recreates its text node even when the text is equal.
  // Keep stable SVG labels, paths, MathML styles and transport DOM untouched.
  // These reads access stored DOM values; none requests computed layout.
  const attr = (el, name, value) => {
    const next = String(value);
    if (el.getAttribute(name) !== next) el.setAttribute(name, next);
  };
  const style = (el, name, value) => {
    const next = String(value);
    if (el.style.getPropertyValue(name) !== next) el.style.setProperty(name, next);
  };
  const setText = (el, value) => {
    const next = String(value);
    if (el.textContent !== next) el.textContent = next;
  };
  const opacity = (el, value) => style(el, 'opacity', value);
  const compact = value => Math.abs(value) < 5e-9 ? '0' : Number(value.toPrecision(4)).toString();
  const complex = z => `${compact(z.re)} ${z.im < 0 ? '−' : '+'} ${compact(Math.abs(z.im))}i`;
  function math(el, wrapped) {
    const tex = wrapped.replace(/^\$\$|\$\$$/g, '');
    el.innerHTML = window.katex.renderToString(tex, { output: 'mathml', displayMode: true, throwOnError: true, strict: 'error' });
  }
  function imageURL(read, size = 256) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const rgb = read(x, y, size), index = 4 * (y * size + x);
      pixels.data[index] = rgb[0]; pixels.data[index + 1] = rgb[1]; pixels.data[index + 2] = rgb[2]; pixels.data[index + 3] = rgb[3] ?? 255;
    }
    ctx.putImageData(pixels, 0, 0); return canvas.toDataURL('image/png');
  }
  function spatialURL(pixels, maximumValue = 1) {
    const n = Math.sqrt(pixels.length);
    return imageURL((x, y, size) => {
      const p = pixels[Math.floor(y * n / size) * n + Math.floor(x * n / size)];
      const v = Math.round(M.clamp(p / maximumValue) * 255); return [v * .87, v * .97, v];
    });
  }
  const maximum = spectra => spectra.reduce((max, z) => {
    for (let i = 0; i < z.re.length; i++) max = Math.max(max, Math.hypot(z.re[i], z.im[i]));
    return max;
  }, 0);
  function spectrumURL(z, max, color = [189, 219, 229], range = 48, supportRadius = null) {
    const n = Math.sqrt(z.re.length), scale = Math.log1p(max);
    return imageURL((x, y, size) => {
      const fx = Math.floor((x - size / 2) * range / size), fy = Math.floor((y - size / 2) * range / size);
      // Separated bands have no signal outside the OTF support. Let the fixed
      // panel show through there instead of translating an opaque rectangle.
      if (supportRadius !== null && Math.hypot(fx, fy) >= supportRadius) return [0, 0, 0, 0];
      const index = A.idx(fx, fy, n), v = Math.log1p(Math.hypot(z.re[index], z.im[index])) / scale;
      return [9 + color[0] * v, 17 + color[1] * v, 23 + color[2] * v];
    });
  }
  const cameras = [], sources = [], acquisitionArrows = [];
  const matrixView = { mixingRows: [], inverseRows: [], weights: [], tokens: [], sourceTerms: [], operators: [], inverseHandoff: [] };
  const inverseView = { tokens: {}, formulas: [] };
  const encodingAlgebraView = [];
  const proofView = { factors: [], grouped: [], sums: [] }, calculationView = { products: [] };
  function formulaBox(parent, x, y, width, height, tex, attrs = {}) {
    const box = create('foreignObject', { x, y, width, height, ...attrs }, parent);
    const content = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    attr(content, 'class', 'demix-proof-math'); box.appendChild(content); math(content, tex); return box;
  }
  function canvasLayer(parent, x, y, width, height, pixelHeight = 128) {
    const foreign = create('foreignObject', { x, y, width, height }, parent);
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = pixelHeight;
    canvas.style.width = canvas.style.height = '100%'; canvas.style.display = 'block'; foreign.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    return { canvas, ctx, data: ctx.createImageData(128, pixelHeight) };
  }
  function arrowPath(x1, y1, x2, y2, head = 7) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    return `M ${x1} ${y1} L ${x2} ${y2} M ${x2 - head * Math.cos(angle - .43)} ${y2 - head * Math.sin(angle - .43)} L ${x2} ${y2} L ${x2 - head * Math.cos(angle + .43)} ${y2 - head * Math.sin(angle + .43)}`;
  }
  function drawMotion(time) {
    const story = M.story(time), s = M.sample(story.demixTime), acquisition = M.acquisitionState(time), demix = M.demixState(time);
    opacity($('demix-stage'), story.demix);
    cameras.forEach((camera, i) => {
      const f = s.frames[i], phase = acquisition.frames[i].phase, pose = acquisition.firstPose;
      const dock = demix.inversion.weights * (1 - demix.proof);
      attr(camera.root, 'transform', i === 0 && time < 6 ? `translate(${pose.x} ${pose.y}) scale(${pose.size / 224})`
        : `translate(${M.lerp(f.x, 1330, dock)} ${M.lerp(f.y, 307 + i * 76, dock)}) scale(${M.lerp(f.scale, .18, dock)})`);
      opacity(camera.root, f.opacity * acquisition.frames[i].opacity);
      paintAcquisition(camera, phase); opacity(camera.phaseGuide, acquisition.stripOpacity);
      opacity(camera.spectrum, s.spectrum); opacity(camera.probe, s.spectrum);
      const preview = phase < lesson.capture.raw.groups[0].frames[i].phase - 1e-12;
      setText(camera.label, preview ? '相移预览' : s.reveal > .5 ? `D${'₀₁₂'[i]}` : s.spectrum > .5 ? `FFT / D${'₀₁₂'[i]}` : `FRAME 0${i + 1}`);
      const nearest = Math.round(phase / (2 * Math.PI / 3));
      setText(camera.phase, Math.abs(phase - nearest * 2 * Math.PI / 3) < 1e-12 ? `φ = ${M.phaseLabels[nearest]}` : `φ ≈ ${(phase / Math.PI).toFixed(3)}π`);
      style(camera.label, 'font-size', `${M.lerp(18, 32, s.reveal)}px`); style(camera.phase, 'font-size', `${M.lerp(14, 29, s.reveal)}px`);
      opacity(camera.probeText, 1 - s.reveal);
      opacity(camera.label, 1 - dock);
      opacity(camera.phase, 1 - s.reveal);
      attr(camera.label, 'x', M.lerp(-112, 0, s.reveal));
      attr(camera.label, 'text-anchor', s.reveal > .5 ? 'middle' : 'start');
    });
    sources.forEach((source, b) => {
      const f = s.sources[b];
      attr(source.root, 'transform', `translate(${f.x} ${f.y}) scale(${f.scale})`);
      opacity(source.root, f.opacity * s.bands); opacity(source.band, 1);
      setText(source.titleBase, s.shifted > .5 ? 'C' : 'A');
      const shift = -M.orders[b] * lesson.group.kx * s.shifted * 262 / 48;
      const shiftY = -M.orders[b] * lesson.group.ky * s.shifted * 262 / 48;
      attr(source.moving, 'transform', `translate(${shift} ${shiftY})`);
      opacity(source.ghost, s.shifted * .55);
      const qx = 6 - M.orders[b] * lesson.group.kx * s.shifted;
      attr(source.marker, 'transform', `translate(${qx * 262 / 48} ${shiftY})`);
      setText(source.pointLabel, s.shifted < .01 ? 'f' : ['q = f', 'q = f − k', 'q = f + k'][b]);
      setText(source.shiftLabel, s.shifted < .01 ? '检测坐标 f' : b === 0 ? '0 级 · 保持原位' : `${b === 1 ? '← −k' : '+k →'} · 频带与 OTF 同步`);
      opacity(source.shiftArrow, s.shifted * (b === 0 ? 0 : .7));
      attr(source.shiftArrow, 'd', arrowPath(0, 89, shift, 89, 5));
      setText(source.sourceFrequency, s.shifted < .99 ? '仍带 OTF 衰减' : '回到样品来源 q · 仍保留 H(f)');
      attr(source.sourceFrequency, 'y', 199);
      opacity(source.result, s.shifted);
    });
    drawRelocationGrid(time);
    opacity($('opening-labels'), (1 - s.reveal) * acquisition.completed);
    acquisitionArrows.forEach((arrow, i) => {
      opacity(arrow.group, acquisition.arrows[i]); attr(arrow.path, 'stroke-dashoffset', 1 - acquisition.arrows[i]);
    });
    const demixGroup = $('demix-equations');
    drawDemix(demix, s);
    opacity($('final-callout'), s.focus);
    fullStages.draw(time, excitationPhase);
    opacity(demixGroup, Math.max(demix.reveal, demix.origin.opacity));
    for (const [name, value] of Object.entries(demix.panels)) {
      const panel = $(`demix-formula-${name}`);
      opacity(panel, value); attr(panel, 'aria-hidden', value === 0);
    }
    const frame = M.encodingFrame(time), formulaGroup = $('encoding-pair-equations');
    opacity(formulaGroup, frame.formulaOpacity);
    attr(formulaGroup, 'transform', `translate(0 ${frame.formulaOffset})`);
    attr(formulaGroup, 'aria-hidden', frame.formulaOpacity === 0);
    for (const [side, point] of [['positive', frame.panels[2].points[0]], ['negative', frame.panels[1].points[1]]]) {
      style($(`encoding-${side}`), '--encoding-emphasis', point.emphasis);
      attr($(`encoding-${side}`), 'data-in-passband', point.inside);
    }
    const sum = M.encodingSumState(time), notation = M.encodingNotationState(time), compactOpacity = notation.compact * (1 - sum.expanded);
    const derivation = M.encodingDerivationState(time);
    const algebra = derivation.formula;
    opacity($('encoding-derivation'), algebra.opacity); attr($('encoding-derivation'), 'aria-hidden', algebra.opacity === 0);
    attr($('encoding-algebra-tokens'), 'transform', `translate(${algebra.x} ${algebra.y}) scale(${algebra.scale})`);
    algebra.tokens.forEach((pose, i) => {
      const group = encodingAlgebraView[i];
      attr(group, 'transform', `translate(${pose.x} ${pose.y}) scale(${pose.scale})`);
      opacity(group, pose.opacity); attr(group, 'aria-hidden', pose.opacity === 0);
    });
    for (const name of ['theta', 'identity', 'cancel', 'half', 'substitute', 'factor', 'notation', 'theorem']) {
      const box = $(`encoding-algebra-${name}`), alpha = algebra[name];
      opacity(box, alpha); attr(box, 'aria-hidden', alpha === 0);
      attr(box, 'transform', `translate(0 ${10 * (1 - alpha)})`);
    }
    for (const phase of ['forward', 'numeric', 'inverse']) {
      const el = $(`encoding-coordinate-${phase}`);
      opacity(el, notation[phase]); attr(el, 'aria-hidden', notation[phase] === 0);
    }
    style($('encoding-coordinate-forward'), 'transform', `translateY(${30 * (1 - M.ramp(time, 2.48, 2.58))}px)`);
    for (const part of ['source', 'shift', 'destination']) style($(`encoding-symbol-${part}`), '--symbol-focus', notation[`${part}Focus`]);
    style($('encoding-numeric-destination'), '--symbol-focus', notation.destinationFocus);
    for (const id of ['encoding-inverse-source', 'encoding-lookup-term']) style($(id), '--symbol-focus', notation.lookupFocus);
    opacity($('encoding-lookup-note'), notation.lookupDetail); attr($('encoding-lookup-note'), 'aria-hidden', notation.lookupDetail === 0);
    $('encoding-lookup-note').hidden = notation.lookupDetail === 0;
    opacity($('encoding-sum-expanded'), sum.expanded); opacity($('encoding-sum-compact'), compactOpacity);
    attr($('encoding-sum-expanded'), 'aria-hidden', sum.expanded === 0); attr($('encoding-sum-compact'), 'aria-hidden', compactOpacity === 0);
    style($('encoding-sum-term-zero'), '--term-emphasis', Math.max(sum.zeroFocus, sum.sumFocus));
    for (const side of ['positive', 'negative']) {
      style($(`encoding-sum-weight-${side}`), '--term-emphasis', sum.weightFocus);
      style($(`encoding-sum-term-${side}`), '--term-emphasis', sum.sumFocus);
    }
    for (const id of ['encoding-sum-plus-one', 'encoding-sum-plus-two']) style($(id), '--term-emphasis', sum.sumFocus);
    const detection = M.detectionState(time);
    const contextOpacity = detection.opacity * detection.copy * acquisition.clear;
    opacity($('detection-context'), contextOpacity); attr($('detection-context'), 'aria-hidden', contextOpacity === 0);
    for (const domain of ['spatial', 'frequency']) {
      style($(`detection-${domain}-input`), '--detection-emphasis', detection.inputFocus);
      style($(`detection-${domain}-filter`), '--detection-emphasis', detection.filterFocus);
      style($(`detection-${domain}-result`), '--detection-emphasis', detection.resultFocus);
    }
    style($('detection-pair'), '--detection-emphasis', detection.filterFocus);
    attr($('detection-equations'), 'data-filter-progress', detection.filter);
    setText($('detection-formula-cue'), detection.filter === 0 ? 'e₀ = sI₀：检测前已受条纹调制的荧光发射'
      : detection.filter < 1 ? '卷积与滤波同步呈现：圈内逐渐衰减，圈外逐渐消失'
      : 'f 的位置不变，三个来源仍混在同一个观测值里；一帧还不足以解开');
    setText($('acquisition-phase-number'), (acquisition.phase / Math.PI).toFixed(3));
    attr($('acquisition-equations'), 'data-phase', acquisition.phase);
    style($('acquisition-phase-term'), '--detection-emphasis', acquisition.shifting ? 1 : .25);
    for (let i = 0; i < 3; i++) style($(`acquisition-phase-${i}`), '--phase-focus', acquisition.active === i ? 1 : 0);
  }
  function draw(time, animateCopy = true) {
    const frame = Flow.frame(time), index = Flow.sceneIndex(time);
    drawMotion(frame.baseTime);
    bridgeView.resetEntry();
    if (index !== currentScene) showScene(index, animateCopy);
    const beat = frame.owner === 'motion' ? M.scenePresentation(frame.id, frame.progress) : null;
    if (beat) {
      if(frame.id==='separate-bands'){
        $('equation').hidden=beat.mode!=='separatedStatus';
        $('demix-equations').hidden=beat.mode==='separatedStatus';
      }
      setText($('scene-title'), beat.title); setText($('scene-description'), beat.copy);
      setText($('scene-svg-description'), beat.copy + ' ' + beat.note);
      setText($('equation-note'), beat.note); $('equation-note').hidden = !beat.note;
      setText($('stage-caption'), `${beat.beat + 1} / ${beat.beatCount} · ${beat.action}`);
      const host = $('equation'), key = frame.id + ':' + beat.mode;
      if (host.getAttribute('data-motion-formula-mode') !== key) {
        if (!motionFormulaNodes.has(key)) {
          const group = document.createElement('span');
          group.setAttribute('data-motion-formula-beat', key);
          math(group, beat.equation); motionFormulaNodes.set(key, group);
        }
        host.innerHTML = ''; host.appendChild(motionFormulaNodes.get(key));
        attr(host, 'data-motion-formula-mode', key);
      }
    }
    if (Flow.scenes[index].id === 'frequency-encoding') {
      const view = M.encodingDerivationState(frame.baseTime).view, copy = view || Flow.scenes[index];
      setText($('scene-title'), copy.title); setText($('scene-description'), copy.copy);
      setText($('scene-svg-description'), copy.copy + ' ' + copy.note);
      setText($('encoding-algebra-description'), copy.copy + ' ' + copy.note);
      setText($('equation-note'), copy.note); $('equation-note').hidden = !copy.note;
      setText($('equation-domain'), view ? view.domain : copy.formulaDomain);
      setText($('view-label'), view ? 'EULER → FOURIER / 从余弦到移频' : 'SPECIMEN → DETECTION / 编码与检测');
      setText($('stage-caption'), view ? `${M.encodingDerivationStages.indexOf(view) + 1} / ${M.encodingDerivationStages.length} · ${view.domain}` : 'TRACK A PAIR / q = (±14, 0)');
    }
    let motionAlpha = 1, provisionalAlpha = 0, parameterAlpha = 0, adoptedAlpha = 0, pairAlpha = 0;
    const enter = M.ramp(frame.progress, 0, .12);
    if (frame.owner === 'bridge') {
      bridgeView.draw(frame.id, frame.progress);
      if (frame.id === 'provisional-split') {
        const state = Chapter.provisionalState(frame.progress);
        motionAlpha = state.matrix; provisionalAlpha = 1;
        setText($('view-label'), state.nominalFailure > 0 ? 'NOMINAL PARAMETERS / 标称值重建对照'
          : state.observation.intro > 0 ? 'OBSERVATION → OTF × SPECTRA / 从观测展开频带'
          : state.notation.active ? 'ROW → MATRIX → VECTOR / 逐行乘加 → 矩阵合写'
          : state.seconds >= 94 ? 'WEIGHT FACTOR → BAND FACTOR / 系数比例 → 输出比例'
          : state.seconds >= 86 ? 'ACTUAL / TEMPORARY WEIGHT / 在原公式上比较权重'
          : state.seconds >= 82 ? 'MATRIX → ROW PRODUCT / 矩阵项飞入组成公式'
          : state.seconds >= 74 ? 'WEIGHT → MATRIX / 权重回到矩阵'
          : state.seconds >= 54.5 ? 'ACTUAL WEIGHTS / 实际权重的结构' : 'WEIGHTS → ACTUAL PARAMETERS / 权重 → 实际参数');
        setText($('equation-domain'), state.nominalFailure > 0 ? '直接代入标称值 · 结果对照'
          : state.observation.intro > 0 ? '观测 D → H 与照明频谱 → 临时频带'
          : state.seconds >= 94 ? '临时权重 → 临时矩阵 → 临时输出'
          : state.seconds >= 86 ? 'u 与 ũ · 原公式内替换'
          : state.seconds >= 74 ? 'u → U → A = UD'
          : state.seconds >= 54.5 ? '实际权重 → 已知与未知' : '逆矩阵权重 → 照明参数');
        opacity($('demix-source-definitions'), state.context);
        opacity(matrixView.caption, state.context);
        cameras.forEach(camera => opacity(camera.root, Number(camera.root.style.opacity) * state.context));
        const formula = state.notation.active ? bridgeView.drawProvisionalFormula(frame.progress)
          : parameterFormulaView.draw({ id: frame.id, progress: frame.progress });
        setText($('scene-title'), formula.title); setText($('scene-description'), formula.copy);
        setText($('equation-note'), formula.note); $('equation-note').hidden = !formula.note;
        attr($('equation'), 'data-parameter-focus', state.focus || '');
        setText($('scene-svg-description'), formula.copy + ' ' + formula.note);
        setText($('stage-caption'), { knownHighlight: '第一行 · 高亮系数', knownMessage: '第一行 · 已知常数，直接可算',
          knownRestore: '第一行 · 文字退去，系数恢复', sideHighlight: '第二、三行 · 高亮系数', sideMessage: '旁带 · 需要知道 φⱼ 和 m',
          sideRestore: '旁带 · 文字退去，系数恢复', gather: '来源列 → A(f) · 权重 → U · 观测列 → D(f)',
          whyEstimate: '同一照明公式 → 三种可观察差异', wavevectorReason: 'k → 方向与间距',
          modulationReason: 'm → 固定标尺下的条纹反差', phaseReason: 'φΔ → 三帧条纹共同平移', nominalPlug: '直接代回硬件标称值',
          vectorFailure: '结果一 · 亚像素错位', phaseFailure: '结果二 · 反相抵消与黑边下冲',
          nominalResidual: '实际误差 · 周期性残余条纹', actualWeights: '重新显示逆矩阵 U',
          extractWeight: '从矩阵取出旁带权重 → 左侧放大', showWeight: '等号 → 原有系数',
          expandWeight: '实际相位 → 已知相移 + 共同偏移', splitWeight: '权重因式分解 · 未知部分与 j 无关',
          returnWeight: '同一个 u → U 的原单元格', matrixApply: '权重行 × 观测列 → 对应的 A',
          rowProduct: '矩阵项飞入 → 三次相乘、逐项相加', nameKnown: '原公式中的 u₊₁,₁ → 原位展开',
          coefficientScale: 'ũ 与 u 只差共同幅相因子', outputScale: '系数的共同比例 → 输出的共同比例',
          matrixNotation: '临时 +1 行归位 → 补齐 0、+1、−1 三行',
          vectorNotation: '中央收拢 → Ã = ŨD', observationModel: 'D = H × M × 三份样品频谱',
          substituteObservation: '提出标量 H → ŨM 相邻', temporaryResponse: 'ŨM → 各级次的对角系数',
          expandBands: '同一批 H、S 与系数 → 三份临时频带',
          ready: 'Ã = ŨD → 公共区参数估计' }[state.mode]);
      }
      else {
        motionAlpha=0; adoptedAlpha=1;
        const teaching=Chapter.adoptedState(frame.progress,frame.id).teaching;
        $('equation').hidden=!!teaching;
        if(teaching){
          setText($('scene-title'),teaching.title);setText($('scene-description'),teaching.copy);
          setText($('equation-note'),teaching.note);setText($('scene-svg-description'),teaching.copy+' '+teaching.note);
          setText($('stage-caption'),teaching.shot+' · '+teaching.title);
        }
        if(frame.id==='adopted-weights'){
          const transfer=M.ramp(frame.progress,0,2/28);
          parameterAlpha=1-transfer;adoptedAlpha=transfer;
          parameterView.drawScene('least-squares-fit',1);pairAlpha=1-transfer;
        }
      }
    } else if (frame.owner === 'parameters') {
      motionAlpha = 0;
      const split = frame.sceneId === 'shared' ? Chapter.sharedEntryState(frame.progress) : null;
      const parameterState=parameterChapter.state(frame.sceneId,frame.progress);
      const state = parameterView.drawScene(parameterState.id,parameterState.progress);
      parameterAlpha = 1; pairAlpha = 1;
      if (frame.sceneId === 'shared') {
        provisionalAlpha = 1 - split.handoff;
        if (provisionalAlpha) bridgeView.draw('provisional-split', 1);
        if (split.progress < 1) {
          parameterAlpha = split.context; pairAlpha = split.handoff;
          bridgeView.drawEntry(frame.progress);
        }
        const copy = split.progress < 1 ? Chapter.sharedEntryFormulaAt(frame.progress) : Flow.scenes[index];
        setText($('scene-title'), copy.title); setText($('scene-description'), copy.copy);
        setText($('scene-svg-description'), copy.copy + ' ' + copy.note);
        setText($('stage-caption'), split.progress < 1 ? 'Ã → 0、+1、−1 → 0、+1' : '0 级 + +1 级 / 相机数据估计');
      } else if(frame.sceneId==='refine'||frame.getPeakBeat) {
        const copy=window.SIMParameterLesson[frame.sceneId==='refine'?'refinementNarrative':'leastSquaresNarrative'](state.progress);
        setText($('scene-title'),copy.title);setText($('scene-description'),copy.copy);
        setText($('scene-svg-description'),copy.copy+' '+(copy.note||window.SIMParameterLesson.formulaAt(state).note));
        setText($('stage-caption'),frame.getPeakBeat?copy.action:copy.mode==='returnSpectrum'?'位置锁定 → 完整频谱 → 共同幅相':'空域相位斜坡 → 小数频移 → 三轮 5×5');
      }
      const useEntryFormula = split && split.progress < 1;
      const formula = useEntryFormula ? bridgeView.drawEntryFormula(frame.progress) : parameterFormulaView.draw(state);
      if(formula.title) {
        setText($('scene-title'),formula.title);setText($('scene-description'),formula.copy);
        setText($('scene-svg-description'),formula.copy+' '+formula.note);
      }
      if(frame.getPeakBeat) setText($('equation-domain'),window.SIMGetPeak.presentation(state.progress).domain);
      setText($('equation-note'), formula.note); $('equation-note').hidden = !formula.note;
    } else if (frame.id === 'separate-bands' && M.scenes.find(s=>s.id==='separate-bands').applicationProgress(frame.progress) < .42) {
      const p=M.scenes.find(s=>s.id==='separate-bands').applicationProgress(frame.progress),reveal=M.ramp(p,.30,.42);
      adoptedAlpha=1-reveal;motionAlpha=reveal;bridgeView.drawApplication(p);
    }
    for (const [id, alpha] of [['motion-content', motionAlpha], ['provisional-stage', provisionalAlpha], ['parameter-stage', parameterAlpha], ['adopted-stage', adoptedAlpha], ['frequency-handoff-stage', pairAlpha]]) {
      opacity($(id), alpha); attr($(id), 'aria-hidden', alpha === 0);
    }
    attr($('scene'), 'data-flow-scene', Flow.scenes[index].id);
    attr($('scene'), 'data-parameter-source', 'estimated-from-observations');
    if(frame.owner==='parameters'&&frame.sceneId!=='shared') {
      const previous=Flow.scenes[index-1],Study=window.SIMParameterLesson;
      let copy=previous;
      if(previous.owner==='parameters') {
        const end=parameterChapter.state(previous.sceneId,1);
        const narrative=end.id==='refine'?Study.refinementNarrative(1):end.id==='least-squares-fit'?Study.leastSquaresNarrative(end.progress):{};
        copy={...previous,...narrative,...Study.formulaAt(end)};
      }
      const state=parameterChapter.state(frame.sceneId,frame.progress);
      if(Study.formulaAt(state).title) {
        const handoff=Study.formulaTransition(state,reduced.matches),from=handoff.previous;
        headingHandoff.draw(from?{...Study.scene(from.id),...Study.formulaAt(from)}:null,handoff);
      } else headingHandoff.draw(copy,window.SIMTextTransition.state(frame.progress,Flow.durations[index-1],0,reduced.matches));
    } else headingHandoff.reset();
    if(frame.owner==='parameters') {
      const Study=window.SIMParameterLesson,state=parameterChapter.state(frame.sceneId,frame.progress),handoff=Study.formulaTransition(state,reduced.matches);
      if(handoff.previous)noteHandoff.draw(Study.formulaAt(handoff.previous),handoff);else noteHandoff.reset();
    } else noteHandoff.reset();
  }
  function showScene(index, animateCopy = true) {
    const data = Flow.scenes[index]; currentScene = index;
    $('chapter').textContent = data.chapter; $('scene-title').textContent = data.title;
    $('scene-description').textContent = data.copy; $('scene-number').textContent = String(index + 1).padStart(2, '0');
    parameterFormulaView?.reset();
    math($('equation'), data.equation); $('equation-note').textContent = data.note;
    attr($('equation'), 'data-motion-formula-mode', '');
    $('equation-note').hidden = !data.note;
    $('equation-domain').textContent = data.formulaDomain;
    const pair = data.domainPair;
    $('equation').hidden = !!pair || data.encodingFormula || data.detectionFormula || data.acquisitionFormula || data.demixFormula;
    $('demix-equations').hidden = !data.demixFormula;
    $('encoding-sum-equations').hidden = !data.encodingFormula;
    $('detection-equations').hidden = !data.detectionFormula;
    $('acquisition-equations').hidden = !data.acquisitionFormula;
    $('domain-equations').hidden = !pair; $('domain-guide').hidden = !pair?.guide;
    $('fourier-open').hidden = index !== 0;
    const topicLabels = { weights: '同一频率怎样加权？看推导与实际权重 ↗', rmse: 'RMSE 是什么？为什么本例 SIM 的误差更大？ ↗' };
    $('theory-context').hidden = !topicLabels[data.theoryTopic];
    $('equation-info').hidden = !!data.demixFormula || data.owner !== 'motion';
    $('theory-context').textContent = topicLabels[data.theoryTopic] || '';
    $('app').classList.toggle('has-domain-pair', !!pair);
    $('app').classList.toggle('has-demix-formula', data.demixFormula);
    if (pair) {
      for (const side of ['left', 'bridge', 'right']) {
        $(`domain-${side}-label`).textContent = pair[`${side}Label`];
        math($(`domain-${side}`), pair[side]);
        const detail = $(`domain-${side}-detail`), equation = pair[`${side}Detail`];
        detail.hidden = !equation;
        if (equation) math(detail, equation);
        else detail.innerHTML = '';
      }
      $('domain-guide').textContent = pair.guide;
    }
    $('scene-svg-description').textContent = data.copy + ' ' + data.note;
    const stageIndex = data.stageIndex;
    $('view-label').textContent = data.demixFormula ? 'LINEAR SYSTEM / 三帧 · 三个来源' : data.detectionFormula ? 'BEFORE → AFTER / 同一检测 · 空域与频域' : data.encodingSum ? 'WEIGHT → SUM / 编码系数 → 频谱叠加' : stageIndex === 0 ? 'REAL SPACE → FOURIER SPACE / 样品 → 频谱' : stageIndex < 5 ? 'SPECIMEN → DETECTION / 编码与检测' : stageIndex === 5 ? 'REAL SPACE / 相机观测' : stageIndex === 6 ? 'FOURIER SPACE / 检测频谱' : stageIndex < 10 ? 'LINEAR SYSTEM / 三帧 · 三个来源' : stageIndex < 13 ? 'FOURIER SPACE / 频带归位' : stageIndex < 16 ? 'MULTIPLE DIRECTIONS / 频率覆盖' : stageIndex < 20 ? 'COMPLEX SPECTRUM / 复数融合' : 'IMAGE & VALIDATION / 重建与验证';
    $('stage-caption').textContent = data.demixFormula ? (data.id === 'verify-demix' ? '0 · 0 · 1 / 验证来源系数' : data.id === 'separate-bands' ? 'WEIGHT → SUM / 符号乘加' : data.id === 'mixed-sources' ? '05 → 06 → A / 来源进入方程' : 'M → M⁻¹ / 符号权重') : data.detectionFormula ? 'SAME f / 衰减后仍是混合' : data.encodingSum ? '1 DIRECTION · FIXED PHASE / φ₀ = 0' : stageIndex === 0 ? 'q：样品频率坐标 · 单位：DFT 格' : stageIndex === 3 ? 'TRACK A PAIR / q = (±14, 0)' : stageIndex < 5 ? 'TRACK ONE FREQUENCY / q = (14, 0)' : stageIndex < 7 ? '3 PHASES · 1 DIRECTION' : stageIndex < 10 ? 'M → M⁻¹ / 矩阵解混' : stageIndex < 13 ? 'f → q / KEEP THE SAME VALUE' : stageIndex < 16 ? '3 DIRECTIONS · 9 BANDS' : stageIndex < 20 ? 'WEIGHT → SUM → FILTER' : 'THE SAME DATA, BACK IN REAL SPACE';
    if (data.owner !== 'motion') {
      $('view-label').textContent = data.owner === 'parameters' ? 'PARAMETER ESTIMATION / 同一组三帧'
        : data.id === 'provisional-split' ? 'WEIGHTS → ACTUAL PARAMETERS / 权重 → 实际参数' : 'PHASE SEPARATION / 估计值 → 正式权重';
      $('stage-caption').textContent = data.owner === 'parameters' ? '0 级 + +1 级 / 相机数据估计' : data.id === 'provisional-split' ? '波矢 · 调制度 · 相位' : 'k̂ · φ̂ⱼ · m̂ → 正式重建';
    }
    for (const el of [$('scene-copy'), $('equation'), $('domain-equations')]) {
      if (typeof el.getAnimations === 'function') el.getAnimations().forEach(animation => animation.cancel());
    }
    if (animateCopy && !reduced.matches && data.owner!=='parameters') {
      for (const el of [$('scene-copy'), pair ? $('domain-equations') : $('equation')]) {
        if (typeof el.animate !== 'function') continue;
        el.animate([{ opacity: .2, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 320, easing: 'ease-out' });
      }
    }
  }
  function sizeTimeline() {
    const strip = $('timeline-scroll'), content = $('timeline-content'), slider = $('progress');
    timeline = M.timelineGeometry(strip.clientWidth, Flow.scenes.length);
    content.style.width = `${timeline.width}px`;
    content.style.setProperty('--stop-count', Flow.scenes.length);
    content.style.setProperty('--track-start', `${timeline.start}px`);
    content.style.setProperty('--track-length', `${timeline.length}px`);
    slider.style.left = `${timeline.sliderLeft}px`; slider.style.width = `${timeline.sliderWidth}px`;
    slider.style.setProperty('--thumb-size', `${timeline.thumbSize}px`);
  }
  function followStop(index, animate = false) {
    const strip = $('timeline-scroll');
    if (!timeline || !stopButtons[index] || !strip.clientWidth || scrubbing) return;
    const center = timeline.start + index * timeline.stepWidth;
    const left = M.clamp(center - strip.clientWidth / 2, 0, Math.max(0, timeline.width - strip.clientWidth));
    strip.scrollTo({ left, behavior: animate && !reduced.matches ? 'smooth' : 'instant' });
  }
  function update(state) {
    draw(state.position, !state.jumping);
    if(rehearsal){const frame=Flow.frame(state.position);rehearsal.sync(frame.id,frame.progress);}
    const index = Flow.sceneIndex(state.position), scene = Flow.scenes[index], stopped = !state.playing;
    const compareExposures = stopped && Math.abs(state.position - 2) < 1e-8;
    $('chapter-replay').hidden = (scene.owner === 'motion' && !scene.beats) || state.reduced;
    $('chapter-replay').disabled = state.playing;
    $('encoding-replay').hidden = scene.id !== 'frequency-encoding' || state.reduced;
    $('encoding-replay').disabled = state.playing;
    $('demix-mix-replay').hidden = scene.id !== 'mixed-sources' || state.reduced;
    $('demix-mix-replay').disabled = state.playing;
    $('demix-matrix-replay').hidden = !['inverse-demix', 'verify-demix', 'separate-bands'].includes(scene.id) || state.reduced;
    setText($('demix-matrix-replay'), scene.id === 'verify-demix' ? '↺ 重看抵消' : scene.id === 'separate-bands' ? '↺ 重看逐点解混' : '↺ 重看求逆');
    $('demix-matrix-replay').disabled = state.playing;
    $('excitation-phases').hidden = !compareExposures;
    for (let j = 0; j < 3; j++) {
      $(`excitation-phase-${j}`).disabled = !compareExposures;
      attr($(`excitation-phase-${j}`), 'aria-pressed', j === excitationPhase);
    }
    $('progress').value = String(state.position);
    style($('timeline-content'), '--progress', `${state.position / state.last * 100}%`);
    attr($('progress'), 'aria-valuetext', `第 ${index + 1} 步：${scene.label}`);
    $('edge-prev').disabled = state.playing || state.position <= 0;
    $('edge-next').disabled = state.playing || state.position >= state.last;
    const paused = stopped && Math.abs(state.position - state.target) > 1e-8;
    setText($('pause'), state.playing ? 'Ⅱ 暂停' : paused ? '继续 →' : state.position >= state.last ? '↺ 再看一遍' : '下一步 →');
    attr($('pause'), 'aria-label', $('pause').textContent);
    const status = state.playing ? `${state.jumping ? '快速跳转到' : '前往'}第 ${state.target + 1} 步` : paused ? '已暂停 · 可继续或回退' : `停在第 ${index + 1} 步 / 共 ${Flow.scenes.length} 步`;
    if ($('playback-status').textContent !== status) $('playback-status').textContent = status;
    setText($('speed'), `${state.speed}×`); attr($('speed'), 'aria-label', `播放速度，当前 ${state.speed} 倍速`);
    $('speed').disabled = state.reduced;
    if (currentStopIndex !== index) {
      stopButtons.forEach(button => {
        const i = Number(button.dataset.stop); button.classList.toggle('done', i < index);
        if (i === index) attr(button, 'aria-current', 'step');
        else if (button.getAttribute('aria-current') !== null) button.removeAttribute('aria-current');
      });
      currentStopIndex = index;
      followStop(index, state.playing && !state.jumping);
    }
    const hint = $('gesture-hint');
    if (state.reduced) setText(hint, '已遵循系统“减少动态效果”设置 · 点击左右切换');
    else {
      const html = state.position > .05
        ? '<kbd>←</kbd> 左侧返回 <span class="hint-divider">/</span> 右侧继续 <kbd>→</kbd><span class="hint-divider">·</span> 空格暂停'
        : '<kbd>←</kbd> 左侧返回 <span class="hint-divider">/</span> 点击右半屏，开始 <kbd>→</kbd>';
      if (hint.innerHTML !== html) hint.innerHTML = html;
    }
  }
  function populateTheory() {
    document.querySelectorAll('[data-equation]').forEach(el => math(el, el.dataset.equation));
    const row = (parent, cells) => { const tr = document.createElement('tr'); cells.forEach(value => { const td = document.createElement('td'); td.textContent = value; tr.appendChild(td); }); parent.appendChild(tr); };
    lesson.group.phases.forEach((phase,j)=>row($('adopted-mixing-values'),['D'+['₀','₁','₂'][j],...M.orders.map(order=>{
      const a=order===0?1:lesson.group.m/2;
      return complex({re:a*Math.cos(order*phase),im:a*Math.sin(order*phase)});
    })]));
    lesson.group.weights.forEach((weights,b)=>row($('adopted-inverse-values'),[['A₀','A₊₁','A₋₁'][b],...weights.map(complex)]));
    lesson.probe.observed.forEach((value, j) => row($('observed-values'), [`D${'₀₁₂'[j]}`, complex(value), complex(lesson.probe.weights[2][j])]));
    lesson.probe.orders.forEach(order => row($('component-values'), [String(order.order), `(${order.specimenFrequency.join(', ')})`, complex(order.value)]));
    $('closure-note').textContent = `代回三帧观测的最大复数误差：${lesson.probe.closureError.toExponential(2)}。H(f) = ${lesson.probe.orders[2].h.toFixed(6)}。`;
    const p = lesson.pipeline, q = A.idx(14, 0, p.spectrumSize), scaled = z => complex({ re: z.re[q] / 128 ** 2, im: z.im[q] / 128 ** 2 });
    p.groups.forEach((group, d) => row($('parameter-values'), [`方向 ${d + 1}`, `(${[group.kx, group.ky].map(compact).join(', ')})`, `${group.angle.toFixed(3)}°`, group.period.toFixed(3)]));
    const overlap = A.idx(6, 0, p.spectrumSize), denominator = p.regularizedDenominator[overlap];
    p.bands.forEach(band => {
      const detector = [6 + band.kx, band.ky];
      row($('overlap-values'), [`${band.direction + 1} / ${band.order > 0 ? '+' : ''}${band.order}`, `(${detector.join(', ')})`, band.h[overlap].toFixed(6), (band.h[overlap] / denominator).toFixed(6)]);
    });
    $('overlap-audit').textContent = `各带计一次的 R₀ = ${p.signalResponse[overlap].toFixed(6)}；实际 R = ${p.denominator[overlap].toFixed(6)}，w² = ${(p.settings.w ** 2).toFixed(4)}。因此此处 ŜW = ${(p.signalResponse[overlap] / denominator).toFixed(6)} S；乘切趾窗后为 ${p.effectiveTransfer[overlap].toFixed(6)} S。`;
    [['融合分子 U', scaled(p.numerator)], ['分母 R', compact(p.denominator[q])], ['正则项 w²', compact(p.settings.w ** 2)], ['Wiener 后 ŜW', scaled(p.preApoSpectrum)], ['切趾窗 Papo', compact(p.apodization[q])], ['最终频谱 Ŝ', scaled(p.spectrum)], ['样品真值 |S|', compact(lesson.audit.truthAmplitude)]].forEach(cells => row($('fusion-audit'), cells));
    $('final-audit').textContent = `幅度保留 ${(lesson.audit.ratio * 100).toFixed(2)}%，相位误差 ${lesson.audit.phaseError.toFixed(4)}°。宽场 RMSE ${lesson.audit.widefieldRMSE.toFixed(4)}；SIM RMSE ${lesson.audit.simRMSE.toFixed(4)}。`;
    $('rmse-audit').textContent = `同一 0—1 强度标尺、未截断数据：宽场 RMSE = ${lesson.audit.widefieldRMSE.toFixed(4)}，SIM RMSE = ${lesson.audit.simRMSE.toFixed(4)}。这些数由图像与真值计算得到，没有用于调参或重建。`;
    $('rmse-transfer-note').textContent = `例如本例直流（q = 0，决定平均亮度）的传递比例约为 ${p.effectiveTransfer[A.idx(0, 0, p.spectrumSize)].toFixed(4)}。所以这里的亮度误差有明确的计算来源；页面没有对输出另做真值拟合或亮度归一化。`;
  }
  const interactiveSelector = 'a,button,input,select,textarea,summary,dialog,[role="button"],[contenteditable="true"]';
  const dialogOpen = () => $('theory').open || $('fourier-lesson').open;
  function navigate(direction) {
    if (dialogOpen()) return;
    player.navigate(direction);
  }
  function openTheory(topic = null) {
    focusBeforeDialog = document.activeElement; player.pause(); $('theory').showModal();
    if (topic) {
      const heading = $(`theory-${topic}`);
      heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'start', behavior: 'instant' });
    } else {
      $('theory-close').focus(); $('theory').scrollTop = 0;
    }
  }
  function bind() {
    $('encoding-replay').addEventListener('click', () => {
      if (player.state().playing) return;
      player.seek(2); player.go(3);
    });
    $('chapter-replay').addEventListener('click', () => {
      if (player.state().playing) return;
      const index = Flow.sceneIndex(player.state().position);
      player.seek(index - 1); player.go(index);
    });
    $('demix-mix-replay').addEventListener('click', () => {
      if (player.state().playing) return;
      const index = Flow.index('mixed-sources'); player.seek(index - 1 + .12); player.go(index);
    });
    $('demix-matrix-replay').addEventListener('click', () => {
      if (player.state().playing) return;
      const index = Flow.sceneIndex(player.state().position);
      player.seek(index - 1 + .12); player.go(index);
    });
    $('fourier-open').addEventListener('click', () => {
      if (!fourierLesson) fourierLesson = window.SIMMotionFourier.create({ math, create, attr, arrowPath, pauseMain: () => player.pause(), reduced });
      fourierLesson.open();
    });
    $('progress').max = String(Flow.scenes.length - 1); $('scene-total').textContent = `/ ${Flow.scenes.length}`;
    for (let j = 0; j < 3; j++) $(`excitation-phase-${j}`).addEventListener('click', () => {
      const state = player.state();
      if (state.playing || Math.abs(state.position - 2) > 1e-8 || dialogOpen()) return;
      excitationPhase = j;
      update(state);
    });
    Flow.scenes.forEach((scene, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.stop = i;
      button.innerHTML = `<span class="stop-number">${String(i + 1).padStart(2, '0')}</span>${scene.label}`;
      button.setAttribute('aria-label', `快速跳转到第 ${i + 1} 步：${scene.label}`);
      button.title = '快速跳转并停在这一步';
      button.addEventListener('click', () => player.jump(i));
      button.addEventListener('focus', () => followStop(i));
      $('scene-stops').appendChild(button); stopButtons.push(button);
    });
    sizeTimeline();
    window.addEventListener('resize', () => { sizeTimeline(); followStop(currentStopIndex); update(player.state()); });
    document.fonts?.ready.then(() => { update(player.state()); });
    // Wheel / trackpad scrolling browses the strip without changing the scene.
    $('timeline-scroll').addEventListener('wheel', event => {
      const strip = $('timeline-scroll');
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || timeline.width <= strip.clientWidth) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1;
      strip.scrollTo({ left: M.clamp(strip.scrollLeft + event.deltaY * unit, 0, timeline.width - strip.clientWidth), behavior: 'instant' });
      event.preventDefault();
    }, { passive: false });
    $('edge-prev').addEventListener('click', () => navigate(-1)); $('edge-next').addEventListener('click', () => navigate(1));
    $('progress').addEventListener('input', e => player.seek(Number(e.target.value)));
    // Keep the range stationary under the pointer while dragging. Recenter
    // only on release; otherwise scrolling feeds back into native range input.
    $('progress').addEventListener('pointerdown', () => { scrubbing = true; player.pause(); });
    const finishScrub = () => { if (scrubbing) { scrubbing = false; followStop(currentStopIndex); } };
    document.addEventListener('pointerup', finishScrub);
    document.addEventListener('pointercancel', finishScrub);
    window.addEventListener('blur', finishScrub);
    $('restart').addEventListener('click', () => player.seek(0));
    $('pause').addEventListener('click', () => {
      const state = player.state();
      if (!state.playing && state.position === state.last) player.seek(0); else player.toggle();
    });
    $('speed').addEventListener('click', () => { const speeds = [1, .65, 1.5]; player.setSpeed(speeds[(speeds.indexOf(player.state().speed) + 1) % speeds.length]); });
    document.addEventListener('click', event => {
      if (event.button !== 0 || dialogOpen()) return;
      const direction = M.clickDirection(event.clientX, window.innerWidth, !!event.target.closest(interactiveSelector), !!window.getSelection()?.toString());
      if (direction) navigate(direction);
    });
    document.addEventListener('pointermove', event => {
      const active = !event.target.closest(interactiveSelector) && !dialogOpen();
      $('app').classList.toggle('hover-prev', active && event.clientX < window.innerWidth / 2);
      $('app').classList.toggle('hover-next', active && event.clientX >= window.innerWidth / 2);
    });
    document.documentElement.addEventListener('pointerleave', () => $('app').classList.remove('hover-prev', 'hover-next'));
    document.addEventListener('keydown', event => {
      if (dialogOpen() || event.target.closest(interactiveSelector) || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
      if (event.key === ' ') { event.preventDefault(); player.toggle(); }
      if (event.key === 'Home') { event.preventDefault(); player.seek(0); }
      if (event.key === 'End') { event.preventDefault(); player.seek(Flow.scenes.length - 1); }
    });
    $('theory-open').addEventListener('click', () => openTheory());
    $('equation-info').addEventListener('click', () => openTheory(Flow.scenes[currentScene].theoryTopic));
    $('theory-context').addEventListener('click', () => openTheory(Flow.scenes[currentScene].theoryTopic));
    $('theory-close').addEventListener('click', () => $('theory').close());
    $('theory').addEventListener('close', () => focusBeforeDialog?.focus());
    $('theory').addEventListener('click', event => {
      if (event.target !== $('theory')) return;
      const bounds = $('theory').getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $('theory').close();
    });
    if (!document.fullscreenEnabled) $('fullscreen').hidden = true;
    $('fullscreen').addEventListener('click', async () => {
      try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
      catch { $('playback-status').textContent = '浏览器未允许全屏，可继续在当前窗口操作。'; }
    });
    document.addEventListener('fullscreenchange', () => { $('fullscreen').innerHTML = document.fullscreenElement ? '⛶ <span>退出全屏</span>' : '⛶ <span>全屏</span>'; $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? '退出全屏' : '进入全屏'); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) player.pause(); });
    reduced.addEventListener('change', event => player.setReducedMotion(event.matches));
    window.addEventListener('pagehide', () => { rehearsal?.destroy(); player.destroy(); parameterView.destroy(); parameterFormulaView.destroy(); });
  }
  try {
    Flow = Chapter.plan(M);
    const capture = A.capture({ sample: 'star-points', directions: 3, m: .8, noise: 'none' });
    parameterChapter = Chapter.create({ raw: capture.raw, config: { n: capture.raw.n, cutoff: A.KC }, direction: 0 });
    reconstruction = parameterChapter.reconstructAll();
    lesson = M.createLesson({ capture, pipeline: reconstruction.pipeline });
    const sceneContext = { arrowPath, M, A, $, lesson, create, attr, style, setText, opacity, compact, complex, math, imageURL, spectrumURL, spatialURL, maximum, formulaBox, canvasLayer };
    ({ buildEncodingAlgebra } = window.SIMMotionHostViews.algebra({ ...sceneContext, encodingAlgebraView }));
    ({ buildFrames, paintAcquisition } = window.SIMMotionHostViews.frames({ ...sceneContext, cameras, acquisitionArrows }));
    ({ buildSources, drawGrid: drawRelocationGrid } = window.SIMMotionHostViews.relocation({ ...sceneContext, sources }));
    ({ buildDemixMatrix, buildDemixProof, drawDemix } = window.SIMMotionHostViews.matrix({ ...sceneContext, matrixView, inverseView, proofView, calculationView }));
    buildFrames(); buildSources(); buildDemixMatrix(); buildDemixProof(); buildEncodingAlgebra(); populateTheory();
    parameterView = window.SIMParameterLesson.createView($('parameter-stage'), parameterChapter.lesson,
      { sharedPairContainer: $('frequency-handoff-stage'),reducedMotion:()=>reduced.matches });
    headingHandoff=window.SIMTextTransition.create({document,host:$('scene-copy'),fields:[
      {node:$('scene-title'),tag:'h1',key:'title'},{node:$('scene-description'),tag:'p',key:'copy'}]});
    noteHandoff=window.SIMTextTransition.create({document,host:$('equation-note-slot'),fields:[{node:$('equation-note'),tag:'p',key:'note'}]});
    parameterFormulaView = window.SIMParameterLesson.createFormulaView($('equation'), { lesson:parameterChapter.lesson,reducedMotion:()=>reduced.matches,formulaAt: s =>
      s.id === 'provisional-split' ? Chapter.provisionalFormulaAt(s) : window.SIMParameterLesson.formulaAt(s),
      formulaMode: s => s.id === 'provisional-split' ? 'provisional-' + Chapter.provisionalState(s.progress).formulaKey : window.SIMParameterLesson.formulaMode(s) });
    bridgeView = window.SIMMotionParameterView.create({ reconstruction, lesson,
      create, attr, opacity, math, formulaBox, spectrumURL, imageURL, maximum, complex, compact, arrowPath, sharedPair: parameterView.sharedPair,
      inverseHandoff: matrixView.inverseHandoff, inverseMatrix: matrixView.backward });
    fullStages = window.SIMMotionStages.create({ lesson, create, attr, opacity, spatialURL, spectrumURL, imageURL, maximum, arrowPath, compact });
    player = M.createPlayer({ render: update, reducedMotion: reduced.matches, durations: Flow.durations, pacing: Flow.pacing }); bind();
    const registry=window.SIMSceneRegistry.create(Flow.scenes,{kind:'motion',getPeak:window.SIMGetPeak,chapter:Chapter,motion:M});
    rehearsal=window.SIMRehearsal.mount({document,container:$('scene-rehearsal'),toggle:$('rehearsal-toggle'),registry,player,
      current:()=>{const s=Flow.frame(player.state().position);return {id:s.id,progress:s.progress};}});
    player.seek(0);
  } catch (error) {
    $('fatal-error').hidden = false; $('fatal-error').textContent = `动画未能初始化：${error.message}。请保留 HTML 与 web、vendor 文件夹的相对位置，并使用支持 MathML 的现代桌面浏览器。`;
    console.error(error);
  }
})();
