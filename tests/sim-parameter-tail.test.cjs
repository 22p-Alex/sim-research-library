/* Mathematical provenance, retained actors and bidirectional state; no browser. */
const test=require('node:test'),assert=require('node:assert/strict');
const Tail=require('../web/parameter-demo/scenes/get-peak/tail-story.js');
const Peak=require('../web/parameter-demo/scenes/get-peak/state.js');
const Teaching=require('../web/motion/scenes/adopted-weights/teaching.js');
const Registry=require('../web/shared/animation/scene-registry.js');
const boot=require('./helpers/motion-dom.cjs');
const near=(a,b,e=1e-9)=>assert.ok(Number.isFinite(+a)&&Math.abs(a-b)<e*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const visible=n=>{let alpha=1;for(;n;n=n.parent){if(n.hidden||n.style?.display==='none')return 0;alpha*=Number(n.style?.opacity??n.attrs?.opacity??1);}return alpha;};

test('ideal phase cancellation leaves energy weights without modifying actual parameter inputs',()=>{
  let re=0,im=0,energy=0;
  for(const d of Tail.demo){
    const z=Tail.multiply({re:d.u.re,im:-d.u.im},d.v);
    near(z.re,d.z.re);near(z.im,d.z.im);near(z.re,Tail.demoAlpha.re*d.energy);near(z.im,Tail.demoAlpha.im*d.energy);
    re+=z.re;im+=z.im;energy+=d.energy;
  }
  assert.equal(energy,12);near(re/energy,.4);near(im/energy,.4*Math.sqrt(3));
  assert.equal(Object.values(Tail.shots).reduce((n,s)=>n+s.length,0)+Object.values(Teaching.shots).reduce((n,s)=>n+s.length,0),27);
  near(Object.values(Tail.durations).reduce((s,n)=>s+n,0)-Tail.prefix+78,210);
});
