/* Standalone preview shell; the estimation and chapter renderer are reusable. */
(function (root) {
  'use strict';
  const M = root.SIMParameterStory, P = root.SIMParameterPreview, $ = id => document.getElementById(id);
  const interactive = 'a,button,input,select,textarea,summary,[contenteditable="true"]';
  try {
    // The standalone connection study supplies one acquisition; entry and exit
    // illustrations use the same provisional and formal arrays as estimation.
    const capture = root.SIMParameterEstimation.capture();
    const chapter = root.SIMMotionParameterChapter.create({ raw: capture.raw, config: capture.config,
      direction: 0 });
    const lesson = chapter.lesson, view = P.createView($('pe-art'), lesson);
    const formulaView = P.createFormulaView($('pe-equation'),lesson);
    const reduced = root.matchMedia('(prefers-reduced-motion: reduce)');
    let scene = -1, note = '', player, scrubbing = false;
    const shortLabels = { read: '估计结果', fit: '估计幅相', coarse: '相关峰' };
    $('pe-step-total').textContent = '/ ' + P.scenes.length;
    $('pe-progress').max = String(P.scenes.length);
    $('pe-stops').style.gridTemplateColumns = 'repeat(' + P.scenes.length + ', minmax(0, 1fr))';
    $('pe-timeline-track').style.minWidth = P.scenes.length * 96 + 'px';
    $('pe-stops').setAttribute('aria-label', P.scenes.length + ' 个停点');
    const stops = P.scenes.map((data, index) => {
      const button = document.createElement('button'); button.type = 'button';
      button.innerHTML = '<span>' + String(index + 1).padStart(2, '0') + '</span>' + (shortLabels[data.id] || data.label);
      button.setAttribute('aria-label', '定位到第 ' + (index + 1) + ' 步：' + data.label);
      button.addEventListener('click', () => player.seek(index + 1)); $('pe-stops').appendChild(button); return button;
    });
    function render(playback) {
      const s = view.draw(playback.position), data = P.scenes[s.step];
      if (scene !== s.step) {
        scene = s.step;
        $('pe-chapter').textContent = data.chapter; $('pe-title').textContent = data.title; $('pe-copy').textContent = data.copy;
        $('pe-step-number').textContent = String(scene + 1).padStart(2, '0');
        $('pe-svg-title').textContent = data.title; $('pe-svg-description').textContent = data.copy + ' ' + data.note;
        $('pe-stage-label').textContent = data.section === 'entry' ? 'ENTRY / 解法 → 临时数据' : data.section === 'exit' ? 'EXIT / 估计参数 → 正式重建' : scene < P.index('least-squares-fit') ? '① 找位置 / 频率坐标' : '② 求幅相 / 复数值';
        stops.forEach((button, index) => index === scene ? button.setAttribute('aria-current', 'step') : button.removeAttribute('aria-current'));
        if (!scrubbing) stops[scene].scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      }
      if(s.id==='refine'||s.id==='least-squares-fit') {
        const copy=root.SIMParameterLesson[s.id==='refine'?'refinementNarrative':'leastSquaresNarrative'](s.progress);
        $('pe-title').textContent=copy.title;$('pe-copy').textContent=copy.copy;
        $('pe-svg-title').textContent=copy.title;$('pe-svg-description').textContent=copy.copy+' '+data.note;
      }
      const formula = formulaView.draw(s);
      if (note !== formula.note) { note = formula.note; $('pe-note').textContent = note; }
      $('pe-progress').value = String(playback.position);
      $('pe-progress').setAttribute('aria-valuetext', '第 ' + (scene + 1) + ' 步：' + data.label);
      const done = playback.position === P.scenes.length;
      $('pe-replay').disabled = playback.playing || playback.reduced;
      $('pe-play').textContent = playback.playing ? '暂停 Ⅱ' : done ? '已到最后' : '下一步 →';
      $('pe-play').disabled = done && !playback.playing;
      $('pe-previous').disabled = playback.playing || playback.position === 0;
      $('pe-next').disabled = playback.playing || done;
      $('pe-status').textContent = (playback.playing ? '正在进入第 ' : '停在第 ') + (scene + 1) + ' 步 / 共 ' + P.scenes.length + ' 步';
      $('pe-speed').textContent = playback.speed + '×'; $('pe-speed').setAttribute('aria-label', '播放速度，当前 ' + playback.speed + ' 倍');
    }
    player = M.createPlayer({ render, reducedMotion: reduced.matches, durations: P.durations });
    $('pe-replay').addEventListener('click', () => {
      if (player.state().playing) return;
      const step = P.state(player.state().position).step; player.seek(step); player.go(step + 1);
    });
    $('pe-previous').addEventListener('click', () => player.navigate(-1)); $('pe-next').addEventListener('click', () => player.navigate(1));
    $('pe-play').addEventListener('click', () => player.toggle()); $('pe-restart').addEventListener('click', () => player.seek(0));
    $('pe-progress').addEventListener('input', () => player.seek(Number($('pe-progress').value)));
    $('pe-progress').addEventListener('pointerdown', () => { scrubbing = true; player.pause(); });
    const finishScrub = () => {
      if (!scrubbing) return;
      scrubbing = false; stops[scene].scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    };
    document.addEventListener('pointerup', finishScrub); document.addEventListener('pointercancel', finishScrub);
    root.addEventListener('blur', finishScrub);
    $('pe-speed').addEventListener('click', () => { const speeds = [.5, 1, 1.5, 2]; player.setSpeed(speeds[(speeds.indexOf(player.state().speed) + 1) % speeds.length]); });
    document.addEventListener('click', event => {
      if (event.button !== 0 || event.defaultPrevented || event.target.closest(interactive) || root.getSelection()?.toString()) return;
      player.navigate(event.clientX < root.innerWidth / 2 ? -1 : 1);
    });
    document.addEventListener('keydown', event => {
      if (event.target.closest(interactive) || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (['ArrowLeft', 'ArrowRight', ' ', 'Home', 'End'].includes(event.key)) event.preventDefault();
      if (event.key === 'ArrowLeft') player.navigate(-1);
      if (event.key === 'ArrowRight') player.navigate(1);
      if (event.key === ' ') player.toggle();
      if (event.key === 'Home') player.seek(0);
      if (event.key === 'End') player.seek(P.scenes.length);
    });
    reduced.addEventListener('change', event => player.setReducedMotion(event.matches));
    document.addEventListener('visibilitychange', () => { if (document.hidden) player.pause(); });
    root.addEventListener('pagehide', () => player.pause());
    $('pe-app').setAttribute('aria-busy', 'false'); player.seek(0);
    root.SIMParameterDemo = { lesson, view, player, chapter, preview: P, formulaView };
  } catch (error) {
    $('pe-app').setAttribute('aria-busy', 'false'); $('pe-error').hidden = false;
    $('pe-error').textContent = '参数估计 Demo 未能完成初始化：' + error.message;
    console.error(error);
  }
})(window);
