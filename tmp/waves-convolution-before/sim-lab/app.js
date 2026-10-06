/* Single startup entry. Modules register factories; no module starts another. */
(function () {
  'use strict';

  try {
    const Lab = window.SIMLab;
    const {
      $,
      typeset
    } = Lab.ui;
    let activeTab = 1;
    let initialized = false;
    const scene = Lab.createScene({
      isActive: () => activeTab === 1
    });
    const acquisition = Lab.createAcquisition();
    const comparisons = Lab.createComparisons({
      acquisition
    });
    function switchTab(which) {
      activeTab = which;
      scene.stop();
      for (const i of [1, 2]) {
        $('tab' + i + 'Content').hidden = i !== which;
        $('tab' + i + 'Btn').classList.toggle('active', i === which);
        $('tab' + i + 'Btn').setAttribute('aria-selected', String(i === which));
      }
      if (which === 1) scene.update();else acquisition.update();
      const top = document.querySelector('.page-head').getBoundingClientRect().bottom + window.scrollY - 10;
      if (window.scrollY > top) window.scrollTo({
        top: Math.max(0, top),
        behavior: 'instant'
      });
    }
    function followHash() {
      if (location.hash !== '#compare') return;
      switchTab(2);
      requestAnimationFrame(() => $('compare').scrollIntoView({
        block: 'start'
      }));
    }
    function init() {
      if (initialized) return;
      initialized = true;
      typeset();
      Lab.convOtf.init();
      scene.init();
      acquisition.init();
      scene.update();
      acquisition.update();
      // Render even without A: saved HTML text cannot stand in for canvas pixels.
      comparisons.init();
      $('tab1Btn').addEventListener('click', () => switchTab(1));
      $('tab2Btn').addEventListener('click', () => switchTab(2));
      $('t1_reset').addEventListener('click', scene.reset);
      $('t2_reset').addEventListener('click', () => {
        acquisition.reset();
        comparisons.clear();
      });
      $('wAideal').addEventListener('click', () => {
        acquisition.idealPreset();
        comparisons.clear();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) scene.stop();
      });
      window.addEventListener('hashchange', followHash);
      switchTab(1);
      followHash();
      document.documentElement.dataset.simReady = 'true';
    }
    Lab.app = {
      init,
      switchTab,
      scene,
      acquisition,
      comparisons
    };
    init();
  } catch (error) {
    const message = document.getElementById('labStartupError');
    message.hidden = false;
    message.textContent = '实验室加载未完成，请刷新页面后重试。';
    console.error('SIM laboratory initialization failed:', error);
  }
})();
