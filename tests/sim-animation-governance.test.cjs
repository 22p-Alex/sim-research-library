/* Governance contracts and real entry scripts under a DOM fixture; no browser. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Clock=require('../web/shared/animation/beat-clock.js');
const Registry=require('../web/shared/animation/scene-registry.js');
const Peak=require('../web/parameter-demo/scenes/get-peak/state.js');
const L=require('../web/parameter-demo/sim-parameter-two-stage.js');
const M=require('../web/motion/sim-motion-model.js');
const Story=require('../web/parameter-demo/sim-parameter-model.js');
const Chapter=require('../web/motion/sim-motion-parameter-chapter.js');
const Preview=require('../web/parameter-demo/sim-parameter-preview.js');
const boot=require('./helpers/motion-dom.cjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('retiming any getPeak beat preserves its local action, formula, narration and reveal order',()=>{
  const lesson=Story.createLesson();
  const keys=['mode','title','copy','note','layout','count','sample','solved','read','alpha','m','phase'];
  for(const selected of Peak.timeline.beats){
    const retimed=Clock.define(Peak.timeline.beats.map(b=>({...b,duration:b.key===selected.key?b.duration*1.7:b.duration})));
    assert.ok(retimed.duration>Peak.timeline.duration);
    for(const b of Peak.timeline.beats)for(const local of [.01,.25,.5,.75,.999]){
      const before=Peak.state(lesson,Peak.timeline.progressFor(b.key,local));
      const after=Peak.state(lesson,retimed.progressFor(b.key,local),retimed);
      for(const key of keys)assert.deepEqual(after[key],before[key],b.key+':'+key);
      for(const key of ['inverse','shift','shiftScan','conjugate','multiply','divide','phaseRead','lengthRead','cards','textAlpha'])near(after[key],before[key]);
      assert.deepEqual(after.formula.parts,before.formula.parts);
      assert.deepEqual(after.formula.emphasis,before.formula.emphasis);
    }
  }
  assert.throws(()=>Clock.define([{key:'a',duration:1,cues:{bad:[.5,.4]}}]));
  assert.throws(()=>Clock.define([{key:'a',duration:1},{key:'a',duration:2}]));
  assert.throws(()=>Peak.timeline.at(NaN));
});

test('all 33/13 scene units have valid handoffs, complete beats and reversible locators',()=>{
  for(const [kind,scenes] of [['motion',Chapter.plan(M).scenes],['parameter',Preview.scenes]]){
    const registry=Registry.create(scenes,{kind,getPeak:Peak,chapter:Chapter,motion:M});
    assert.equal(registry.entries.length,kind==='motion'?33:13);
    for(const entry of registry.entries){
      assert.ok(fs.existsSync(path.resolve(__dirname,'..',entry.unit)),entry.unit);
      assert.equal(entry.entry,scenes[entry.index-1]?.id||null);
      assert.equal(entry.exit,scenes[entry.index+1]?.id||null);
      near(entry.beats[0].start,0);near(entry.beats.at(-1).end,1);
      for(const [i,b] of entry.beats.entries()){
        assert.ok(b.end>b.start,entry.id+':'+b.key);
        if(i)near(b.start,entry.beats[i-1].end);
        for(const progress of [.1,.5,.9]){
          const target=registry.resolve({scene:entry.id,beat:b.key,progress});
          const restored=registry.parse(registry.serialize(target));
          near(restored.position,target.position);
          const located=registry.locate(entry.id,target.sceneProgress);
          assert.equal(located.beat.key,b.key);near(located.progress,progress);
        }
      }
    }
    assert.throws(()=>registry.parse('scene=missing&beat=main&p=.5'));
    assert.throws(()=>registry.parse('scene=sample&beat=main&p=NaN'));
    assert.throws(()=>registry.resolve({scene:scenes[0].id,progress:2}));
  }
});

for(const page of ['sim_motion_demo.html','sim_parameter_demo.html'])test(`${page}: rehearsal seeks, replays, copies and rejects malformed locations on the existing player`,async()=>{
  const main=page==='sim_motion_demo.html';
  const h=boot({page,renderer:main?'web/motion/sim-motion.js':'web/parameter-demo/sim-parameter-app.js'});
  assert.deepEqual(h.errors,[]);
  const find=name=>h.nodes.find(n=>n.attrs['data-rehearsal']===name),toggle=h.byId.get('rehearsal-toggle');
  assert.equal(h.byId.get('scene-rehearsal').hidden,true);
  toggle.dispatch('click');assert.equal(h.byId.get('scene-rehearsal').hidden,false);
  const scene=main?'parameters.least-squares-fit':'least-squares-fit';
  find('scene').value=scene;find('scene').dispatch('change');
  find('beat').value='finalSum';find('beat').dispatch('change');
  find('progress').value='.5';find('progress').dispatch('input');
  const stage=h.nodes.find(n=>n.attrs['data-get-peak']!==undefined);
  assert.equal(stage.attrs['data-mode'],'finalSum');
  assert.ok(+stage.attrs['data-count']>0 && +stage.attrs['data-count']<+stage.attrs['data-total']);
  const first=stage.attrs['data-count'];
  find('copy').dispatch('click');await Promise.resolve();
  const locator=find('locator').value;assert.match(locator,/beat=finalSum&p=0.500000/);
  find('beat').value='finalRead';find('beat').dispatch('change');
  find('locator').value=locator;find('jump').dispatch('click');assert.equal(stage.attrs['data-count'],first);
  find('locator').value='bad';find('jump').dispatch('click');assert.equal(stage.attrs['data-count'],first);
  assert.match(find('status').textContent,/定位码/);
  find('play').dispatch('click');h.finish();
  assert.equal(stage.attrs['data-count'],stage.attrs['data-total']);
  toggle.dispatch('click');assert.equal(h.byId.get('scene-rehearsal').hidden,true);
  assert.deepEqual(h.errors,[]);
});
