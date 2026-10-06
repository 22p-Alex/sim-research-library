from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
before = root / 'tmp/sim-structure-before'
out = root / 'sim-lab'
out.mkdir(exist_ok=True)
demo = (before / 'sim-demo.js').read_text()
comparison = (before / 'sim-comparison.js').read_text()

def between(text, start, end):
    return text[text.index(start):text.index(end)]

# Each file registers a module. Only app.js constructs and starts controllers.
ui = between(demo, '  const fmt=', '  function markPlay(')
(out/'ui.js').write_text('''/* DOM, math formatting and grayscale rendering shared by this page only. */
(function () {
  'use strict';
  const $ = id => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing SIM laboratory element: ${id}`);
    return element;
  };
  const value = id => Number($(id).value);
''' + ui + '''
  window.SIMLab = {
    ui: { $, value, fmt, piTex, piPlain, tex, math, typeset, set, badge, output, gray }
  };
})();
''')

scene = between(demo, '  function drawLens(', '  function acquisitionParams(')
scene = scene.replace("uniform=mode==='widefield'", "uniform=s.mode==='widefield'") if False else scene
scene = scene.replace('window.SIMDemo.scene={params:p,model:s,arrays};', 'current={params:p,model:s,arrays};')
scene = scene.replace('activeTab!==1', '!isActive()')
bind_start = scene.index("  $('t1_btn_sim_anim').addEventListener")
bindings = scene[bind_start:]
scene = scene[:bind_start]
reset = between(demo, '  function resetTab1()', '  function resetTab2()').replace('resetTab1()', 'reset()').replace('window.SIMConvOtf.reset()', 'Lab.convOtf.reset()')
play = between(demo, '  function markPlay(', '  function switchTab(')
(out/'scene.js').write_text('''/* Chapter 1: analytic scene, ray diagram, line profiles and animation. */
(function () {
  'use strict';
  const Lab = window.SIMLab;
  Lab.createScene = function ({ isActive }) {
    const C = window.SIMCore;
    const { $, value, fmt, tex, math, set, badge, output, gray } = Lab.ui;
    let mode = 'sim', phase = 0, sceneRAF = 0, current = null, initialized = false;
''' + play + scene + reset + '''
    function init() {
      if (initialized) return;
      initialized = true;
''' + bindings + '''
    }
    return { init, update: updateScene, reset, stop: stopAnimations, get current() { return current; } };
  };
})();
''')

acquisition = between(demo, '  function acquisitionParams()', "  $('wAideal').addEventListener")
acquisition = acquisition.replace('directionOn:directionOn.slice(),phaseOn:phaseOn.slice()', "directionOn:[1,2,3].map(i=>$('wAdir'+i).checked),phaseOn:[true,true,true]")
acquisition = acquisition.replace('window.SIMDemo.latest=latest;', '')
acquisition = acquisition.replace('syncScope();renderMismatchImpact(p,r);', 'renderMismatchImpact(p,r);')
acquisition = acquisition.replace("document.dispatchEvent(new CustomEvent('sim-updated'));", 'for (const listener of listeners) listener(latest);')
acquisition = acquisition.replace('directionOn[g.index]', "$('wAdir'+(g.index+1)).checked")
acquisition = acquisition.replace('truth:acquisition.truth,estimated,known,result:r,wf}', "truth:acquisition.truth,estimated,known,result:r,wf,mode:isKnown?'known':'estimated'}")
# Move event registration to init(), keeping data/model updates explicit.
modal_bindings = between(acquisition, "  $('wAc2h').addEventListener", '  let pending=0;')
acquisition = acquisition.replace(modal_bindings, '')
acquisition = acquisition[:acquisition.index('  function updateToggleState()')]
(out/'acquisition.js').write_text('''/* Chapter 2: controls → cached acquisition → estimated/known reconstruction.
 * Subscribers receive a complete computed state, after the view has rendered.
 */
(function () {
  'use strict';
  const Lab = window.SIMLab;
  Lab.createAcquisition = function () {
    const C = window.SIMCore, E = window.SIMExperiment;
    const { $, value, fmt, piTex, piPlain, tex, math, set, badge, output, gray } = Lab.ui;
    const N = 128, sample = C.makeSample(N), listeners = new Set();
    let seed = 240924, acquisitionKey = '', acquisition = null, latest = null;
    let modalFocus = null, initialized = false;
''' + acquisition + '''
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
        if (element.type === 'checkbox') element.checked = value;
        else element.value = value;
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
      assign({ wAshot: false, wAnoise: 0, wAbg: 0, wAillumBg: 0 });
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
      $('wAresample').addEventListener('click', () => { seed++; updateReconstruction(); });
''' + modal_bindings + '''
      syncDirections();
    }
    return { init, reset, idealPreset, assign, readSettings, subscribe, update: updateReconstruction,
      get latest() { return latest; } };
  };
})();
''')

presets = between(comparison, '  const base=', '  let reference=null')
labels = between(comparison, '  const labels=', '  function settings()')
presets = presets.replace(",wAerrScope:'both'", '')
presets = re.sub(r"name:'\d+ · ", "name:'", presets)
labels = labels.replace("wAerrScope:'失配作用范围',", '').replace("phases:'采集相位开关'", "phases:'相位帧'")
(out/'presets.js').write_text('''/* Declarative experiment catalog; no DOM access or initialization here. */
(function () {
  'use strict';
''' + presets + labels + '''
  window.SIMLab.presets = { base, groups: groupMeta, groupOf, experiments, labels };
})();
''')

comp = comparison[comparison.index('  function settings()'):comparison.index('  /* 下拉框按四组')]
a = comp.index('    const x={};'); b = comp.index('\n    x.seed=', a)
comp = comp[:a]+"    const x = D.readSettings(Object.keys(labels));"+comp[b:]
comp = comp.replace("const l=D.latest,mode=$('wAreconMode').value", 'const l=D.latest,mode=D.latest.mode')
comp = re.sub(r"    if\(id==='wAerrScope'\).*?\n", '', comp)
a = comp.index('  function draw(');b=comp.index('  const text=',a);comp=comp[:a]+comp[b:]
comp = comp.replace("    $('wApairResults').hidden=!reference;$('wAclearA').disabled=!reference;", "    $('wApairResults').hidden=!reference;\n    $('wApairEmpty').hidden=!!reference;\n    $('wAclearA').disabled=!reference;")
comp = comp.replace("    if(!reference){text('wApairRelation','');return;}", '''    if (!reference) {
      for (const id of ['wApairChanges', 'wApairRelation', 'wApairALabel', 'wApairBLabel', 'wApairDelta']) text(id, '');
      for (const id of ['wApairARmse', 'wApairBRmse']) text(id, '—');
      for (const id of ['wApairAMetrics', 'wApairBMetrics']) $(id).replaceChildren();
      for (const id of ['wApairA', 'wApairB', 'wApairDiff']) {
        const canvas = $(id);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }''')
comp = comp.replace('可只改下方一个参数', '可只改一个采集或重建参数')
comp = comp.replace("      ['真值 m',s.truth,t=>t.m,'truth'],\n      ['采用 m',s.used,null,'used'],", "      ['真值 m',s.truth,'truth'],\n      ['采用 m',s.used,'used'],")
comp = comp.replace('[label,src,get,kind]', '[label,src,kind]')
comp = comp.replace("  function assign(values){for(const [id,v] of Object.entries(values)){const el=$(id);if(el.type==='checkbox')el.checked=v;else el.value=v;}}", '')
comp = comp.replace('D.resetTab2();assign(', 'D.reset();D.assign(').replace('D.updateReconstruction()', 'D.update()').replace('      assign(e.b);', '      D.assign(e.b);')
comp = comp.replace("  function clear(){reference=null;active=null;showGroupHint($('wAexperiment').value);render();}", "  function clear(){reference=null;active=null;showGroupHint(sel.value);text('wApairGuide',experiments.find(e=>e.id===sel.value).guide);render();}")
setup = between(comparison, "  const sel=$('wAexperiment');", '  window.SIMComparisons=')
setup = setup.replace("  const sel=$('wAexperiment');", "  sel.replaceChildren();")
setup = setup.replace("e.name.replace(/^\\d+\\s*·\\s*/,''),e.id", 'e.name,e.id')
hint = between(setup, '  function showGroupHint(', '  showGroupHint(sel.value')
setup = setup.replace(hint, '')
setup = re.sub(r"  for\(const id of \['t2_reset','wAideal'\]\).*?\n", '', setup)
setup = setup.replace("  document.addEventListener('sim-updated',render);", '  D.subscribe(render);\n  render();')
(out/'comparison.js').write_text('''/* Immutable A snapshot, live B result, explicit empty/ready rendering. */
(function () {
  'use strict';
  const Lab = window.SIMLab;
  Lab.createComparisons = function ({ acquisition: D }) {
    const C = window.SIMCore, { $, gray: draw } = Lab.ui;
    const { base, groups: groupMeta, groupOf, experiments, labels } = Lab.presets;
    const sel = $('wAexperiment');
    let reference = null, active = null, busy = false, initialized = false;
''' + comp + hint + '''
    function init() {
      if (initialized) return;
      initialized = true;
''' + setup + '''
    }
    return { init, load, clear, experiments, get reference() { return reference; } };
  };
})();
''')

conv = (root/'sim-conv-otf.js').read_text().replace('window.SIMConvOtf=', 'window.SIMLab.convOtf=')
(out/'conv-otf.js').write_text(conv)
