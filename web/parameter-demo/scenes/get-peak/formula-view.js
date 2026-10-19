/* The scene supplies formula tokens and emphasis; the renderer owns only DOM. */
(function (root) {
  'use strict';
  const Story = root.SIMGetPeak;
  const ramp=root.SIMBeatClock.ramp,lerp=(a,b,t)=>a+(b-a)*t;
  function buildAlpha(group,compile) {
    const doc=group.ownerDocument||root.document,tokens={},details={};
    group.setAttribute('class','pe-study-formula pe-two-formula pe-peak-formula pe-alpha-formula');
    const row=doc.createElement('div'),detail=doc.createElement('div');
    row.setAttribute('class','pe-alpha-formula-row');detail.setAttribute('class','pe-alpha-formula-detail');
    group.appendChild(row);group.appendChild(detail);
    for(const [name,tex] of Object.entries(Story.alphaTokens)) {
      const isDetail=['magnitude','phase','relation'].includes(name);
      const node=compile(isDetail?detail:row,'get-peak-alpha-'+name,tex);
      (isDetail?details:tokens)[name]=node;
    }
    return {alphaProduct:{tokens,details}};
  }
  function drawAlpha(parts,s,reduced) {
    const f=reduced?Story.alphaFormulaState(s.cues,s.substep,true):s.formula.motion;
    const l=Story.layout.alphaFormula,offset=l.expandX*f.expand,scaledM=l.scaledMX+offset,scaledZ=l.scaledZX+offset;
    const pose=(name,x,y,opacity,emphasis=false)=>{
      const node=parts.tokens[name];
      node.style.transform=`translate(${x}em,${y}em) translate(-50%,-50%)`;
      node.style.opacity=String(opacity);node.setAttribute('aria-hidden',opacity===0);
      node.setAttribute('data-emphasized',emphasis);
    };
    const scaleCopy=ramp(f.scale,0,.16),rotationCopy=ramp(f.rotation,0,.16);
    const expanded=1-ramp(f.merge,0,.4),combined=ramp(f.merge,.6,1);
    pose('source',l.sourceX+offset,0,1);
    pose('scaleLabel',l.scaleX+offset,l.labelY,1,s.substep==='alphaStretch');
    pose('scaleArrow',l.scaleX+offset,0,1);
    pose('scaledM',lerp(l.scaleX+.35,l.scaledMX,f.scale)+offset,l.labelY*(1-f.scale),scaleCopy);
    pose('scaledZ',lerp(l.sourceX,l.scaledZX,f.scale)+offset,l.copyArc*Math.sin(Math.PI*f.scale),scaleCopy);
    const phaseEnter=ramp(f.expand,.45,1);
    pose('phaseLabel',l.phaseX,l.labelY,phaseEnter,s.substep==='alphaRotate');
    pose('phaseArrow',l.phaseX,0,phaseEnter);
    // Copies keep the completed mz in place. The new phase factor travels
    // above the row; the sample copies travel below it, on separate paths.
    const carry=ramp(f.rotation,0,.6),insert=ramp(f.rotation,.55,.85),land=ramp(f.rotation,.85,1);
    pose('productM',lerp(scaledM,l.productMX,carry),l.copyArc*Math.sin(Math.PI*carry),rotationCopy*expanded);
    pose('productPhase',lerp(l.phaseX+.35,l.productPhaseX,insert),l.labelY*(1-land),ramp(f.rotation,.55,.7)*expanded);
    pose('productZ',lerp(scaledZ,l.productZX,carry),l.copyArc*Math.sin(Math.PI*carry),rotationCopy);
    // Retire both factors before introducing alpha; keep their sample z fixed.
    pose('coefficient',lerp(l.productPhaseX,l.coefficientX,combined),-.35*(1-combined),combined,s.substep==='commonAcross');
    for(const [name,node] of Object.entries(parts.details)) {
      const opacity=f.details[name];node.style.opacity=String(opacity);
      node.style.transform=`translateY(${.2*(1-opacity)}em)`;
      node.setAttribute('aria-hidden',opacity===0);node.setAttribute('data-emphasized',opacity>0);
    }
  }
  function build({ group, compile, progress }) {
    const s = Story.presentation(progress), parts = {};
    if(s.mode==='finalInverse'||(s.tail&&s.tail.seconds>=2)){
      // The complete, retained equation is on the stage. Keep the existing
      // formula host mounted for handoffs without displaying a second copy.
      group.setAttribute('data-get-peak-formula-location','stage');
      group.style.display='none';return {inverseOnStage:true};
    }
    if(s.formula.motion)return buildAlpha(group,compile);
    group.setAttribute('class', 'pe-study-formula pe-two-formula pe-peak-formula');
    for (const part of s.formula.parts) {
      // Punctuation separates equations; it is not part of a highlighted factor.
      const split=part.tex.match(/^(,\\(?:quad|qquad)\s*)([\s\S]*)$/);
      if(split){
        const separator=compile(group,'get-peak-separator',String.raw`,\;`);
        separator.setAttribute('class','pe-peak-formula-separator');
      }
      parts[part.key] = compile(group, 'get-peak-' + part.key, split?split[2]:part.tex);
    }
    return parts;
  }
  function draw(group, parts, progress,reduced=false) {
    const s = Story.presentation(progress);
    group.style.opacity = String(s.formula.opacity);
    group.setAttribute('data-get-peak-formula-beat', s.formula.mode);
    if(parts.inverseOnStage){group.style.display='none';return;}
    if(parts.alphaProduct){drawAlpha(parts.alphaProduct,s,reduced);return;}
    for (const [name, node] of Object.entries(parts)) node.setAttribute('data-emphasized', s.formula.emphasis.includes(name));
  }
  Story.formulaView = { build, draw };
})(typeof globalThis !== 'undefined' ? globalThis : this);
