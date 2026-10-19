/* Final commonRegion/getPeak, in the local fairSIM source's actual order.
 * All field pixels, cursors and prefix sums read estimate.finalPeak. The old
 * internal scene id survives only for host timeline compatibility. */
(function (root) {
  'use strict';
  const Story = root.SIMGetPeak, M = root.SIMParameterStory, A = root.SIMAtlas;
  const layout = Story.layout;
  function createView({ parent, lesson, el, label, line, path, vector, set, text, opacity, raster, defs, uid }) {
    const { peak, frequencyPoint, frequencyPoints, comparisonMaximum, displayScales } = Story.dataFor(lesson), { n } = peak, colors = ['#7ad5cd', '#b7a5eb', '#efb879'];
    const stage = el('g', { 'data-get-peak': '', 'data-least-squares-fit': '', 'data-source': 'fairSIM-getPeak', 'data-total': peak.count }, parent);
    const number = (x, digits = 4) => Math.abs(x) < 1e-12 ? '0' : Math.abs(x) < 1e-4 ? x.toExponential(2) : x.toFixed(digits);
    const complex = z => `${number(z.re)} ${z.im < -1e-12 ? '−' : '+'} ${number(Math.abs(z.im))}i`;
    const value = (z, i) => ({ re: z.re[i], im: z.im[i] });
    const mag = z => Math.hypot(z.re, z.im);
    const principal = a => Math.atan2(Math.sin(a), Math.cos(a));
    const position = i => [i % n, Math.floor(i / n)];
    const domainSide = 2 * Math.ceil(lesson.estimate.context.config.cutoff) + 7;
    const urls = new Map();
    // Display only: hue encodes the actual complex phase, log brightness the
    // modulus. The full nonzero OTF support fits in the frequency window.
    function fieldURL(z, frequency = false, scale, phaseColor=true) {
      const mode=phaseColor?'phase':'gray',cached=urls.get(z)||{};
      if(cached[mode])return cached[mode];
      const max=scale||z.re.reduce((m,re,i)=>Math.max(m,Math.hypot(re,z.im[i])),1e-30);
      const side=frequency?domainSide:n;
      const url=raster(side,side,(x,y)=>{
        const i=frequency?A.idx(x-Math.floor(side/2),y-Math.floor(side/2),n):y*n+x;
        return [...Story.displayColor(z.re[i],z.im[i],max,phaseColor).rgb,255];
      });
      cached[mode]=url;urls.set(z,cached);return url;
    }
    const vMaximum = peak.spatial[1].re.reduce((m, re, i) => Math.max(m, Math.hypot(re, peak.spatial[1].im[i])), 1e-30);
    const energyMaximum = peak.energy.reduce((maximum, v) => Math.max(maximum, v), 1e-30);
    const images = {
      prepared: peak.prepared.map((z,b) => fieldURL(z, true,displayScales.prepared[b])),
      preparedGray:peak.prepared.map((z,b)=>fieldURL(z,true,displayScales.prepared[b],false)),
      spatial: peak.spatial.map(z => fieldURL(z, false)),
      shifted: fieldURL(peak.shifted, false, vMaximum), product: fieldURL(peak.product, false),
      energy: raster(n, n, (x, y) => { const v=Math.log1p(1e3*peak.energy[y*n+x]/energyMaximum)/Math.log1p(1e3); return [122,213,205].map(c=>Math.round(c*v)).concat(255); }),
    };
    const note=(...args)=>{const node=label(...args);set(node,'display','none');set(node,'data-scene-note','');return node;};
    function panel(parent, x, y, width, height, color = '#36525d') {
      return el('rect', { x, y, width, height, rx: 6, class: 'pe-two-panel', stroke: color }, parent);
    }
    function field(parent, x, y, size, title, subtitle, href, color, name) {
      const g = el('g', { transform: `translate(${x} ${y})`, 'data-get-peak-field': name }, parent);
      const heading=label(g, 0, -size / 2 - 28, title, 'pe-peak-field-title', color);
      panel(g, -size / 2 - 9, -size / 2 - 9, size + 18, size + 18, color);
      const image = el('image', { x: -size / 2, y: -size / 2, width: size, height: size, href,
        style: 'image-rendering:pixelated', 'data-get-peak-image': name, 'data-n': n }, g);
      const caption = (name==='shift-output'?label:note)(g, 0, size / 2 + 33, subtitle, 'pe-two-small');
      const cursor = el('rect', { width: size / n, height: size / n, fill: '#fff', 'fill-opacity': .16,
        stroke: '#fff', 'stroke-width': 1.4, 'data-get-peak-cursor': name }, g);
      const row = el('line', { x1: -size / 2, x2: size / 2, stroke: '#fff', 'stroke-opacity': .3,
        'stroke-width': 1, 'data-get-peak-row': name }, g);
      const moveCursor = (index, visible) => {
        const [x, y] = position(index), step = size / n;
        set(cursor, 'x', -size / 2 + x * step); set(cursor, 'y', -size / 2 + y * step);
        set(cursor, 'data-index', index); set(cursor, 'data-r', [x, y].join(','));
        set(row, 'y1', -size / 2 + (y + .5) * step); set(row, 'y2', -size / 2 + (y + .5) * step);
        opacity(cursor, visible); opacity(row, visible);
      };
      moveCursor(0, 0);
      return { g, image, heading, caption, moveCursor, size, liftCursor() { for (const node of [row,cursor]) { node.remove(); g.appendChild(node); } } };
    }
    function plane(parent, x, y, radius, name, axisLabels={}) {
      const g = el('g', { transform: `translate(${x} ${y})`, 'data-get-peak-plane': name }, parent);
      el('circle', { r: radius, fill: 'none', stroke: '#36525d' }, g);
      line(g, -radius - 15, 0, radius + 15, 0); line(g, 0, -radius - 15, 0, radius + 15);
      label(g, radius + 28, 5, 'Re', 'pe-two-small');
      const imaginary=axisLabels.imaginary||{x:12,y:-radius-16,anchor:'middle'};
      const imaginaryLabel=label(g,imaginary.x,imaginary.y,'Im','pe-two-small');
      set(imaginaryLabel,'text-anchor',imaginary.anchor);
      return g;
    }
    function prefix(node, count, size) {
      const step = size / n, rows = Math.floor(count / n), remainder = count % n;
      set(node, 'd', `M ${-size / 2} ${-size / 2} h ${size} v ${rows * step} h ${-size} Z`
        + (remainder ? ` M ${-size / 2} ${-size / 2 + rows * step} h ${remainder * step} v ${step} h ${-remainder * step} Z` : ''));
      set(node, 'data-count', count); set(node, 'data-total', peak.count);
    }
    const keys=['finalPrepare','finalInverse','finalShift','finalProduct','finalSum'];
    const groups=keys.map(key=>el('g', {'data-get-peak-beat':key}, stage));
    const [prepare, inverse, shift, product, sum] = groups;
    const action = note(stage, 720, layout.actionY, '', 'pe-two-text', colors[2]);
    set(action, 'data-get-peak-action', '');
    const legend = label(stage, 720, layout.legendY, '亮度：模长 · 色相：相角', 'pe-two-small');
    set(legend, 'data-get-peak-display-key', '');
    const prepared = [0, 1].map(b => field(prepare, layout.pair.x[b], layout.pair.y, layout.pair.size,
      `B${b ? '₁' : '₀'} · 工作频带`, `自身 OTF 可靠且成对筛选 · 保留 ${peak.supportCounts[b]} 个频点`, images.preparedGray[b], colors[b], 'prepared-' + b));
    const preparedColor=prepared.map((f,b)=>{
      const picture=el('image',{x:-f.size/2,y:-f.size/2,width:f.size,height:f.size,href:images.prepared[b],style:'image-rendering:pixelated','data-get-peak-color-field':b},f.g);
      f.liftCursor();return picture;
    });
    const prepareOperation=el('g',{'data-get-peak-preparation-operation':''},prepare);
    label(prepareOperation,720,265,'可靠公共区','pe-two-text');
    label(prepareOperation,720,298,'各自校正 OTF','pe-two-small');
    const concept=el('g',{'data-get-peak-correspondence':''},prepare);
    const correspondenceLine=path(concept,colors[2],{'stroke-width':1.5,'stroke-dasharray':'4 4'});
    const pointActors=[0,1].map(b=>{
      const marker=el('g',{'data-get-peak-frequency-point':b},concept);
      el('circle',{r:7,fill:'none',stroke:colors[2],'stroke-width':2},marker);
      const address=label(marker,0,-16,b?'q+k̂':'q','pe-two-small',colors[b]);
      const location=label(concept,layout.pair.x[b],layout.preparation.addressY,b?'检测地址 q+k̂':'参考地址 q','pe-two-small',colors[b]);
      set(location,'data-get-peak-address-label',b);
      const h=label(concept,layout.pair.x[b],layout.preparation.otfY,'','pe-two-small',colors[b]);
      set(h,'data-get-peak-otf-label',b);
      const value=label(concept,layout.pair.x[b],layout.preparation.valueY,'','pe-two-small',colors[b]);
      return {marker,address,location,h,value};
    });
    function mathLabel(parent,cx,y,width,tex,color,attrs={}) {
      const box=el('foreignObject',{x:cx-width/2,y,width,height:48,...attrs},parent);
      const div=root.document.createElementNS('http://www.w3.org/1999/xhtml','div');
      div.setAttribute('class','pe-peak-math');div.style.color=color;box.appendChild(div);
      root.katex.render(tex,div,{displayMode:true,output:'mathml',throwOnError:true,strict:'error'});
      return box;
    }
    const samples=[0,1].map(b=>mathLabel(concept,layout.pair.x[b],layout.preparation.sampleY,layout.preparation.sampleWidth,
      b?String.raw`\alpha\,{\color{#efb879}S(\mathbf q)}`:String.raw`{\color{#efb879}S(\mathbf q)}`,colors[b],{'data-get-peak-sample-symbol':b}));
    const alphaIllustration=el('g',{'data-get-peak-alpha-illustration':''},shift);
    const commonMeaning=el('g',{'data-get-peak-common-alpha':''},alphaIllustration),explain=layout.explanation;
    const alphaParts=[
      mathLabel(commonMeaning,explain.x-79,explain.formulaY,74,String.raw`\alpha=`,colors[2]),
      mathLabel(commonMeaning,explain.x-21,explain.formulaY,42,'m',colors[2],{'data-get-peak-alpha-factor':'scale'}),
      mathLabel(commonMeaning,explain.x+58,explain.formulaY,116,String.raw`e^{i\phi_\Delta}`,colors[2],{'data-get-peak-alpha-factor':'rotate'})
    ];
    const commonMeaningLabel=label(alphaIllustration,explain.x,explain.detailY,'共同的伸缩与转角','pe-two-small',colors[2]);
    const geometry=el('g',{'data-get-peak-alpha-geometry':'illustration'},alphaIllustration);
    label(geometry,explain.x,explain.captionY,'复乘几何示意 · 非本组估计值','pe-two-small');
    const geometryPlane=plane(geometry,explain.x,explain.planeY,explain.radius,'alpha-illustration',explain.axisLabels);
    const geometrySource=path(geometryPlane,colors[0],{'stroke-dasharray':'4 3','data-get-peak-geometry-source':''});
    const geometryScaled=path(geometryPlane,colors[2],{'stroke-dasharray':'3 3','data-get-peak-geometry-scaled':''});
    const geometryTarget=path(geometryPlane,colors[1],{'data-get-peak-geometry-target':''});
    const geometryArc=path(geometryPlane,colors[1],{'stroke-width':2,'data-get-peak-geometry-arc':''});
    const geometryAngle=label(geometryPlane,0,0,'φΔ','pe-two-small',colors[1]);
    const geometryLabel=label(geometry,explain.x,explain.labelY,'','pe-two-small');
    const key=layout.colorKey,colorKey=el('g',{'data-get-peak-color-key':''},prepare);
    mathLabel(colorKey,key.x,explain.formulaY,300,String.raw`z=|z|e^{i\psi}`,colors[2]);
    const colorCaption=label(colorKey,key.x,explain.captionY,'显示标尺演示 · 不改动数据','pe-two-small');
    const keyPlane=plane(colorKey,key.x,key.planeY,key.radius,'display-key');
    const hueRing=el('g',{'data-get-peak-hue-ring':''},keyPlane);
    for(let i=0;i<72;i++){
      const a=i*2*Math.PI/72,b=(i+1)*2*Math.PI/72,r=key.radius+8;
      const rgb=Story.displayColor(Math.cos(a),Math.sin(a),1).rgb;
      path(hueRing,`rgb(${rgb.join(',')})`,{'stroke-width':5,d:`M ${r*Math.cos(a)} ${-r*Math.sin(a)} A ${r} ${r} 0 0 0 ${r*Math.cos(b)} ${-r*Math.sin(b)}`});
    }
    const colorVector=path(keyPlane,colors[2],{'data-get-peak-color-vector':''});
    const keyMessage=label(colorKey,key.x,359,'','pe-two-small');
    for(let i=0;i<52;i++){
      const rgb=Story.displayColor((i+.5)/52,0,1,false).rgb;
      el('rect',{x:key.barX+i*key.barWidth/52,y:key.barY,width:key.barWidth/52+.2,height:key.barHeight,fill:`rgb(${rgb.join(',')})`},colorKey);
    }
    const brightnessCursor=el('path',{stroke:colors[2],'stroke-width':2,fill:'none','data-get-peak-brightness-cursor':''},colorKey);
    const colorReadout=label(colorKey,key.x,421,'','pe-two-small');
    const colorTile=el('rect',{x:key.tileX,y:key.tileY,width:key.tileSize,height:key.tileSize,rx:3,stroke:'#c6d5d7','stroke-width':1,'data-get-peak-color-tile':''},colorKey);
    const colorFoot=label(colorKey,key.x,495,'','pe-two-small');
    const otherPoints=frequencyPoints.map(point=>[0,1].map(b=>{
      const address=[point.q[0]+b*peak.kx,point.q[1]+b*peak.ky];
      return el('circle',{cx:layout.pair.x[b]+address[0]*layout.pair.size/27,cy:layout.pair.y+address[1]*layout.pair.size/27,
        r:3,fill:colors[2],'data-get-peak-common-q':point.q.join(','),'data-band':b},concept);
    }));
    const inverseCards = [0, 1].map(b => {
      const f = field(inverse, layout.pair.x[b], layout.pair.y, layout.pair.size, b ? 'B₁ → v' : 'B₀ → u', '频域工作副本 → 空域复数场', images.prepared[b], colors[b], 'inverse-' + b);
      const spatial = el('image', { x:-layout.pair.size/2,y:-layout.pair.size/2,width:layout.pair.size,height:layout.pair.size,href:images.spatial[b],
        style: 'image-rendering:pixelated', 'data-get-peak-spatial': b }, f.g);
      const transform = label(f.g, 0, 0, '逆 FFT', 'pe-peak-transform', colors[b]);
      return { ...f, spatial, transform };
    });
    const inverseView=Story.createInverseView({parent:inverse,cards:inverseCards,mathLabel,el,label,path,plane,vector,set,text,opacity,colors});
    const shiftFields = [
      field(shift, layout.shift.x[0], layout.shift.y, layout.shift.size, 'u', '参考复数场', images.spatial[0], colors[0], 'shift-reference'),
      field(shift, layout.shift.x[1], layout.shift.y, layout.shift.size, 'v', '旁带复数场', images.spatial[1], colors[1], 'shift-input'),
      field(shift, layout.shift.x[2], layout.shift.y, layout.shift.size, 'vₖ', '按行应用单位模指数', images.spatial[1], colors[1], 'shift-output'),
    ];
    const shiftClip = el('clipPath', { id: uid + '-peak-shift' }, defs);
    const shiftPrefix = el('path', { 'data-get-peak-shift-prefix': '' }, shiftClip);
    el('image', { x: -93, y: -93, width: 186, height: 186, href: images.shifted,
      'clip-path': `url(#${uid}-peak-shift)`, style: 'image-rendering:pixelated', 'data-get-peak-shifted-image': '' }, shiftFields[2].g);
    shiftFields[2].liftCursor();
    const operation=layout.pointwise,pointwise=el('g',{'data-get-peak-pointwise':''},shift);
    mathLabel(pointwise,...operation.operator,230,String.raw`\times e^{-i\delta(\mathbf r)}\ \longrightarrow`,colors[2]);
    const scanCoordinate=label(pointwise,operation.x[0],operation.coordinateY,'','pe-two-small');
    const scanCounter=label(pointwise,operation.x[1],operation.counterY,'','pe-two-small');
    const demoClip=el('clipPath',{id:uid+'-peak-point-write'},defs);
    const demoPixel=el('rect',{'data-get-peak-point-write-clip':''},demoClip);
    const demoImage=el('image',{x:-layout.shift.size/2,y:-layout.shift.size/2,width:layout.shift.size,height:layout.shift.size,
      href:images.shifted,'clip-path':`url(#${uid}-peak-point-write)`,style:'image-rendering:pixelated','data-get-peak-point-write':''},shiftFields[2].g);
    shiftFields[2].liftCursor();
    const pointDetail=el('g',{'data-get-peak-point-detail':''},shift);
    const single=layout.single;
    const rampPlane = plane(pointDetail, ...single.plane, 'known-ramp');
    const rampStart = path(rampPlane, colors[1], { 'stroke-width': 1.5, 'stroke-dasharray': '3 3' });
    const rampArrow = path(rampPlane, colors[2], { 'data-get-peak-ramp-vector': '' });
    const rampAngle = label(pointDetail, single.plane[0], single.angleY, '', 'pe-two-small');
    const rampPosition = label(pointDetail, single.plane[0], single.positionY, '', 'pe-two-small');
    const rampSwatches=[0,1].map(b=>{
      const x=single.plane[0]-63+b*109;
      label(pointDetail,x-17,single.swatchY+17,b?'vₖ':'v','pe-two-small',colors[1]);
      return el('rect',{x,y:single.swatchY,width:layout.shift.swatchSize,height:layout.shift.swatchSize,rx:3,'data-get-peak-ramp-color':b},pointDetail);
    });
    label(pointDetail,single.plane[0],single.hintY,'紫：原箭头 · 橙：反向旋转 · 长度保持','pe-two-small');
    const rampArc=path(rampPlane,colors[2],{'stroke-width':2,'data-get-peak-ramp-arc':''});
    const compareLabel=label(shift,...layout.shift.model,'vₖ ≈ αu','pe-two-text',colors[2]);
    set(compareLabel,'data-get-peak-compare','');
    // These fields and vectors continue through comparison into conjugation.
    const comparison=el('g',{'data-get-peak-comparison-detail':''},shift);
    const comparisonPlane=plane(comparison,0,0,layout.shift.plane[2],'common-ratio');
    const sourceU=path(comparisonPlane,colors[0],{'stroke-width':1.3,'stroke-dasharray':'4 3'});
    const conjugateU=path(comparisonPlane,colors[0],{'data-get-peak-compare-u':'','data-get-peak-conjugate-vector':''});
    const targetV=path(comparisonPlane,colors[1],{'data-get-peak-compare-v':''});
    const comparisonPosition=label(comparison,0,-133,'','pe-two-small');
    const vectorNames=label(comparison,0,141,'u · vₖ','pe-two-small');
    const directionNote=label(shift,720,490,'','pe-two-small');

    const productPosition = label(product, 280, 443, '', 'pe-two-small');
    const productOperation = label(product, 690, 412, 'u*(r) × vₖ(r) → z(r)', 'pe-two-text', colors[2]);
    const zReadout = label(product, 690, 443, '', 'pe-two-small', colors[2]);
    const eReadout = label(product, 1125, 443, '', 'pe-two-small', colors[0]);
    // The full product field is used; the clip below highlights an exact
    // row-major prefix, including the current partial row.
    const productField = field(sum, layout.sum.x[0], layout.sum.y, layout.sum.size, 'z(r) · 逐点乘积', '分子的输入：u* × vₖ', images.product, colors[2], 'sum-source');
    const energyField = field(sum, layout.sum.x[1], layout.sum.y, layout.sum.size, 'e(r) = |u(r)|²', '分母的输入：参考场能量', images.energy, colors[0], 'sum-energy-source');
    const sumClip = el('clipPath', { id: uid + '-peak-sum' }, defs);
    const sumPrefix = el('path', { 'data-get-peak-sum-prefix': '' }, sumClip);
    el('rect', { x: -88, y: -88, width: 176, height: 176, fill: '#fff', 'fill-opacity': .15,
      'clip-path': `url(#${uid}-peak-sum)` }, productField.g);
    const cPlane = plane(sum, ...layout.sum.plane, 'cross-sum');
    const cArrow = path(cPlane, colors[2], { 'data-get-peak-cross-vector': '' });
    label(sum, 930, 152, 'C', 'pe-peak-field-title', colors[2]);
    const cNumber = label(sum, 930, 407, '', 'pe-two-text', colors[2]);
    label(sum, 1240, 152, 'E₀', 'pe-peak-field-title', colors[0]);
    panel(sum, 1195, 189, 90, 161, colors[0]);
    const energyFill = el('rect', { x: 1205, width: 70, y: 340, height: 0, fill: colors[0], 'fill-opacity': .6, 'data-get-peak-energy-fill': '' }, sum);
    const energyNumber = label(sum, 1240, 407, '', 'pe-two-text', colors[0]);
    const sumCount = label(sum, 720, 443, '', 'pe-two-text', colors[2]);
    const sampleNumber = note(sum, 720, 465, '', 'pe-two-small');
    const toC = path(sum, colors[2], { d: 'M 327 220 Q 365 175 405 175 H 806 Q 842 175 864 220', 'stroke-width': 1.5 });
    const toE = path(sum, colors[0], { d: 'M 667 315 Q 710 376 770 376 H 1100 Q 1170 376 1182 315', 'stroke-width': 1.5 });
    label(sum, 770, 201, 'z → 分子', 'pe-two-small', colors[2]);
    label(sum, 1070, 356, '|u|² → 分母', 'pe-two-small', colors[0]);
    const contribution = el('circle', { r: 4, fill: colors[2], 'data-get-peak-contribution': '' }, sum);
    const cMaximum = peak.sums.reduce((max, z) => Math.max(max, mag(z)), 1e-30);
    const result = el('g', { 'data-get-peak-result': '' }, stage);
    const divide = el('g', { 'data-get-peak-division': '' }, result);
    const cBox = el('g', {}, divide), eBox = el('g', {}, divide);
    panel(cBox, 115, 190, 420, 90, colors[2]); panel(eBox, 115, 313, 420, 90, colors[0]);
    label(cBox, 325, 219, 'C', 'pe-two-small', colors[2]);
    const finalC = label(cBox, 325, 253, '', 'pe-two-value', colors[2]);
    label(eBox, 325, 341, 'E₀', 'pe-two-small', colors[0]);
    const finalE = label(eBox, 325, 377, '', 'pe-two-value', colors[0]);
    line(divide, 555, 236, 643, 280, colors[2]); line(divide, 555, 358, 643, 300, colors[0]);
    el('circle', { cx: 678, cy: 290, r: 29, fill: '#102128', stroke: colors[2] }, divide);
    label(divide, 678, 298, '÷', 'pe-two-value', colors[2]);
    const divideOut = path(divide, colors[2], { d: 'M 711 290 H 843', 'data-get-peak-divide-output': '' });
    const ratio = plane(result, ...layout.result.plane, 'coefficient');
    label(ratio, 97, -9, '1', 'pe-two-small');
    const ratioArrow = path(ratio, colors[2], { 'data-study-ratio': '', 'data-get-peak-alpha-vector': '' });
    const phaseArc = path(ratio, colors[1], { 'stroke-width': 2, 'data-get-peak-phase-arc': '' });
    const length = path(ratio, colors[2], { 'stroke-width': 7, 'stroke-opacity': .2, 'data-get-peak-length': '' });
    const ratioText = label(result, 1070, 406, '', 'pe-two-text', colors[2]);
    const read = el('g', { 'data-get-peak-readout': '' }, result);
    note(read, 335, 204, '一个复系数，读取两个参数', 'pe-two-text');
    const phaseText = label(read, 335, 269, '', 'pe-two-value', colors[1]);
    const lengthText = label(read, 335, 324, '', 'pe-two-value', colors[2]);
    note(read, 335, 371, 'φ̂ⱼ = φ′ⱼ + φ̂Δ · 采用已知三相相对步进', 'pe-two-small');
    const cards = el('g', { 'data-fit-parameter-cards': '' }, result);
    const cardNodes = ['k', 'm', 'phase'].map((key, i) => {
      const x = layout.result.cardX[i], color = [colors[0], colors[2], colors[1]][i];
      const g = el('g', { 'data-fit-parameter': key }, cards);
      panel(g, x - layout.result.cardWidth / 2, layout.result.cardY, layout.result.cardWidth, layout.result.cardHeight, color);
      label(g, x, 451, ['k̂', 'm̂', 'φ̂Δ'][i], 'pe-two-text', color);
      const v = label(g, x, 480, '', 'pe-two-value', color);
      return { g, v };
    });
    const legs = ['k', 'm', 'phase'].map((key, i) => path(result, [colors[0], colors[2], colors[1]][i], {
      'data-parameter-source': key === 'k' ? 'locked-wavevector' : 'complex-coefficient', 'stroke-width': 1, 'stroke-dasharray': '3 4',
      d: i === 0 ? 'M 250 383 V 425' : `M 1070 383 Q ${250 + i * 470} 402 ${250 + i * 470} 425`,
    }));
    const tailView=root.SIMParameterTail.createView({parent:stage,lesson,images,el,label,path,line,vector,set,text,opacity,plane,prefix,defs,uid});
    function draw(progress) {
      const active = progress !== null, s = Story.state(lesson, active ? progress : 0);
      opacity(stage, active ? 1 : 0);
      for (const [key, v] of Object.entries({ mode: s.mode, count: s.count, total: s.total,
        'sum-re': s.sum.re, 'sum-im': s.sum.im, energy: s.sum.energy, divide: s.divide,
        solved: s.solved, read: s.read, kx: peak.kx, ky: peak.ky, sample: s.sample })) set(stage, 'data-' + key, v);
      groups.forEach((g,i) => opacity(g, i===2 ? s.panels.slice(2,6).reduce((a,b)=>a+b,0) : s.panels[Story.timeline.beats.findIndex(b=>b.key===keys[i])]));
      text(action, s.action); opacity(action, s.textAlpha);
      opacity(legend,s.mode==='finalPrepare'?s.cues.colorExit:['finalCompare','finalShiftScan'].includes(s.mode)?1:0);
      const c=s.cues;
      prepared.forEach(f=>opacity(f.g,c.workSpectra));preparedColor.forEach(node=>opacity(node,c.colorPaint));
      opacity(prepareOperation,c.workSpectra*(1-c.colorEnter));
      opacity(concept,1-c.workSpectra);
      const q=frequencyPoint.q, markerPositions=[];
      pointActors.forEach((actor,b)=>{
        const address=[q[0]+b*peak.kx,q[1]+b*peak.ky],native=c.nativeLayout;
        const start=[layout.entry.cx+q[0]*layout.entry.unit,layout.entry.cy+q[1]*layout.entry.unit];
        const end=[layout.pair.x[b]+address[0]*layout.pair.size/layout.entry.range,layout.pair.y+address[1]*layout.pair.size/layout.entry.range];
        const position=start.map((v,i)=>v+(end[i]-v)*native);markerPositions.push(position);
        set(actor.marker,'transform',`translate(${position[0]} ${position[1]})`);
        set(actor.marker,'data-address',address.join(','));set(actor.marker,'data-q',q.join(','));
        opacity(actor.marker,s.frequencyPointAlpha);opacity(actor.location,c.addressPoint);
        const h=b?frequencyPoint.h1:frequencyPoint.h0,z=b?frequencyPoint.rawY:frequencyPoint.rawX,corrected=b?frequencyPoint.y:frequencyPoint.x;
        text(actor.h,`H${b?'₁(q+k̂)':'₀(q)'} = ${number(h,5)}`);opacity(actor.h,c.ownOtf);
        text(actor.value,(c.correction===1?'校正后：':'记录：')+complex(c.correction===1?corrected:z));
        set(actor.value,'data-re',c.correction===1?corrected.re:z.re);set(actor.value,'data-im',c.correction===1?corrected.im:z.im);
        opacity(actor.value,c.ownOtf);
        opacity(samples[b],c.correction);
      });
      set(correspondenceLine,'d',`M ${markerPositions[0].join(' ')} L ${markerPositions[1].join(' ')}`);
      opacity(correspondenceLine,s.frequencyPointAlpha*(1-c.commonAlpha));
      opacity(alphaIllustration,s.illustrationAlpha);
      opacity(commonMeaning,1);opacity(commonMeaningLabel,1);
      const g=s.geometry;
      opacity(geometry,c.alphaDemo);set(geometry,'data-scale',g.scale);set(geometry,'data-angle',g.angle);
      vector(geometrySource,g.source,explain.radius-8);vector(geometryScaled,g.scaled,explain.radius-8);vector(geometryTarget,g.target,explain.radius-8);
      opacity(geometryScaled,c.alphaRotate);
      const arcRadius=39,theta=g.psi+g.angle;
      set(geometryArc,'d',g.angle<1e-9?'M 0 0':`M ${arcRadius*Math.cos(g.psi)} ${-arcRadius*Math.sin(g.psi)} A ${arcRadius} ${arcRadius} 0 0 0 ${arcRadius*Math.cos(theta)} ${-arcRadius*Math.sin(theta)}`);
      opacity(geometryAngle,c.alphaRotate);set(geometryAngle,'x',56*Math.cos(g.psi+g.angle/2));set(geometryAngle,'y',-56*Math.sin(g.psi+g.angle/2));
      set(alphaParts[1],'data-emphasized',s.substep==='alphaStretch');set(alphaParts[2],'data-emphasized',s.substep==='alphaRotate');
      text(geometryLabel,c.alphaRotate>0?'青：原箭头 z · 紫：αz':'同一线性标尺 · 方向不变，长度 ×m');
      text(commonMeaningLabel,c.alphaShared>0?'换一个 z，仍用同一个 m 与 φΔ':c.alphaRotate>0?'② 转过 φΔ，保持缩放后的长度':c.alphaDemo>0?'① 乘 m，先改变长度':'共同的伸缩与转角');
      const color=s.displayKey;
      opacity(colorKey,color.alpha);opacity(hueRing,c.colorPhase>0?1:0);
      set(colorKey,'data-actual',color.actual);set(colorKey,'data-rho',color.rho);set(colorKey,'data-brightness',color.brightness);set(colorKey,'data-hue',color.hue);
      vector(colorVector,{re:color.re,im:color.im},key.radius-7);
      const barX=key.barX+color.rho*key.barWidth;
      set(brightnessCursor,'d',`M ${barX} ${key.barY-5} v ${key.barHeight+10}`);
      text(keyMessage,c.colorPhase>0?'角度 → 色相环；长度保持不变':'长度 → 对数亮度');
      text(colorReadout,`ρ = ${number(color.rho,3)} → L = ${number(color.brightness,3)}`);
      text(colorCaption,c.colorPaint>0?'回到本组实际选点 B₀(q)':'显示标尺演示 · 不改动数据');
      text(colorFoot,c.colorPaint>0?'同一规则，应用于每个复数':'亮度与色相分别记录长度和角度');
      set(colorTile,'fill',`rgb(${color.rgb.join(',')})`);set(colorTile,'data-rgb',color.rgb.join(','));
      const pixelX=layout.pair.x[0]+q[0]*layout.pair.size/layout.entry.range,pixelY=layout.pair.y+q[1]*layout.pair.size/layout.entry.range;
      const tileSize=key.tileSize+(layout.pair.size/layout.entry.range-key.tileSize)*c.colorPaint;
      set(colorTile,'width',tileSize);set(colorTile,'height',tileSize);
      set(colorTile,'x',key.tileX+(pixelX-tileSize/2-key.tileX)*c.colorPaint);
      set(colorTile,'y',key.tileY+(pixelY-tileSize/2-key.tileY)*c.colorPaint);
      otherPoints.flat().forEach(n=>opacity(n,c.commonPoints));
      inverseView.draw(s);
      const op=s.pointwise,shiftCount=op.count;
      prefix(shiftPrefix,shiftCount,layout.shift.size);
      const scanBeat=Story.timeline.beats.find(b=>b.key==='finalShiftScan');
      const scanEnter=M.ramp(s.progress,scanBeat.start,scanBeat.start+(scanBeat.end-scanBeat.start)*.12);
      opacity(pointDetail,1-scanEnter);
      const dock=c.productDock,actualCompare=s.comparisonAlpha;
      shiftFields.forEach((f,i)=>{
        let x=layout.shift.x[i],y=layout.shift.y,size=layout.shift.displaySize;
        if(i===1){
          x+=(single.input[0]-x)*c.pointLayout;size+=(single.input[2]-size)*c.pointLayout;
          x+=(operation.x[0]-x)*op.arrange;size+=(layout.shift.displaySize-size)*op.arrange;
        } else {const b=i===0?0:1;x+=(layout.product.x[b]-x)*dock;y+=(layout.product.y-y)*dock;size+=(layout.product.size-size)*dock;}
        set(f.g,'transform',`translate(${x} ${y}) scale(${size/layout.shift.size})`);
      });
      opacity(shiftFields[0].g,op.referenceAlpha);
      opacity(shiftFields[1].g,1-c.compareExit);
      opacity(compareLabel,actualCompare*(1-dock));
      opacity(shiftFields[2].g,s.shiftOutput);opacity(shiftFields[2].image,0);
      set(shiftFields[2].caption,'display','none');
      opacity(pointwise,op.alpha);
      set(pointwise,'data-index',op.index);set(pointwise,'data-r',op.r.join(','));
      set(pointwise,'data-known-angle',op.theta);set(pointwise,'data-applied-angle',op.angle);
      text(scanCoordinate,`同一坐标 r = (${op.r.join(', ')})`);
      text(scanCounter,`已处理 ${shiftCount} / ${peak.count} 个位置`);
      const pixelSize=layout.shift.size/n;
      set(demoPixel,'x',-layout.shift.size/2+op.r[0]*pixelSize);set(demoPixel,'y',-layout.shift.size/2+op.r[1]*pixelSize);
      set(demoPixel,'width',pixelSize);set(demoPixel,'height',pixelSize);
      opacity(demoImage,op.write);set(demoImage,'data-index',op.index);
      const cursor = Story.dataFor(lesson).sampleIndex, [rx, ry] = position(cursor);
      const angle = principal(-2 * Math.PI * (peak.kx * rx + peak.ky * ry) / n);
      const v = value(peak.spatial[1], cursor), rotate = angle * s.shift, cosine = Math.cos(rotate), sn = Math.sin(rotate);
      const current = { re: v.re * cosine - v.im * sn, im: v.re * sn + v.im * cosine };
      [v,current].forEach((z,b)=>{
        const color=Story.displayColor(z.re,z.im,displayScales.spatial[1]);
        set(rampSwatches[b],'fill',`rgb(${color.rgb.join(',')})`);set(rampSwatches[b],'data-brightness',color.brightness);set(rampSwatches[b],'data-hue',color.hue);
      });
      const vScale = (single.plane[2]-8) / comparisonMaximum;
      vector(rampStart, v, vScale); vector(rampArrow, current, vScale);
      set(rampArrow, 'data-known-angle', angle); set(rampArrow, 'data-applied-angle', rotate);
      text(rampAngle, `反向转过 ${number(rotate,3)} rad`);
      const psi=Math.atan2(v.im,v.re),rampArcRadius=62;
      set(rampArc,'d',Math.abs(rotate)<1e-10?'M 0 0':`M ${rampArcRadius*Math.cos(psi)} ${-rampArcRadius*Math.sin(psi)} A ${rampArcRadius} ${rampArcRadius} 0 0 ${rotate>=0?0:1} ${rampArcRadius*Math.cos(psi+rotate)} ${-rampArcRadius*Math.sin(psi+rotate)}`); text(rampPosition, `r = (${rx}, ${ry})`);
      text(shiftFields[2].heading,'vₖ');
      const comparisonOn=s.compare>0;
      shiftFields[0].moveCursor(s.sample,comparisonOn?1:0);
      const operationCursor=op.alpha>0?1:0;
      shiftFields[1].moveCursor(op.alpha>0?op.index:cursor,op.alpha>0?operationCursor:scanEnter<1?1:0);
      shiftFields[2].moveCursor(comparisonOn?s.sample:op.index,comparisonOn?1:operationCursor);
      const u = value(peak.spatial[0], s.sample), conjugated = { re: u.re, im: u.im*(1-2*s.conjugate) },target=value(peak.shifted,s.sample);
      const uScale=(layout.shift.plane[2]-8)/comparisonMaximum;
      vector(sourceU,u,uScale);vector(conjugateU,conjugated,uScale);vector(targetV,target,uScale);
      opacity(sourceU,s.conjugate);opacity(comparison,actualCompare);
      set(comparison,'transform',`translate(${layout.shift.plane[0]+(layout.product.plane[0]-layout.shift.plane[0])*dock} ${layout.shift.plane[1]+(layout.product.plane[1]-layout.shift.plane[1])*dock})`);
      set(comparison,'data-sample',s.sample);set(comparison,'data-scale',uScale);
      text(comparisonPosition,`r* = (${s.r.join(', ')})`);
      text(vectorNames,s.conjugate>0?'u* · vₖ':'u · vₖ');
      const localCross={re:u.re*target.re+u.im*target.im,im:u.re*target.im-u.im*target.re};
      const sameDirection=localCross.re>0&&Math.abs(localCross.im)<1e-8*Math.max(1e-30,mag(u)*mag(target));
      text(directionNote,sameDirection?'本例方向一致，共同作用表现为长度比例。':'对应位置的两根箭头，具有共同的伸缩与转角。');
      opacity(directionNote,actualCompare*(1-dock));
      set(product, 'data-index', s.sample); set(product, 'data-r', s.r.join(','));
      const z = value(peak.product, s.sample), energy = peak.energy[s.sample];
      set(product, 'data-z-re', z.re); set(product, 'data-z-im', z.im); set(product, 'data-e', energy);
      text(zReadout, `z(r) = ${complex(z)}`); opacity(zReadout, s.multiply);
      text(eReadout, `e(r) = ${number(energy, 6)}`); opacity(eReadout, s.multiply);
      text(productPosition, `同一 r = (${s.r.join(', ')})`);
      opacity(productOperation, s.multiply);
      prefix(sumPrefix, s.count, layout.sum.size);
      for (const f of [productField, energyField]) f.moveCursor(s.sample, s.count > 0 && s.count < s.total ? 1 : 0);
      vector(cArrow, s.sum, 64 / cMaximum);
      text(cNumber, `C = ${complex(s.sum)}`); text(energyNumber, `E₀ = ${number(s.sum.energy, 6)}`);
      const fraction = s.sum.energy / peak.referenceEnergy;
      set(energyFill, 'height', 141 * fraction); set(energyFill, 'y', 340 - 141 * fraction);
      set(energyFill, 'data-energy', s.sum.energy);
      text(sumCount, `已累计 ${s.count} / ${s.total} 个空域位置`);
      text(sampleNumber, s.count ? `当前 r = (${s.r.join(', ')}) · 两路取同一个位置，分别累加` : '从 r = (0, 0) 开始 · 两路分别累加');
      const travel = s.contributionTravel;
      set(contribution, 'cx', 405 + 401 * travel); set(contribution, 'cy', 175);
      opacity(contribution, s.count > 0 && s.count < s.total ? 1 : 0);
      opacity(toC, 1); opacity(toE, 1);
      opacity(result, s.resultAlpha);
      opacity(divide, s.divisionAlpha);
      text(finalC, s.count === s.total ? complex(s.sum) : ''); text(finalE, s.count === s.total ? number(s.sum.energy, 6) : '');
      opacity(divideOut, s.divide);
      opacity(ratio, s.solved ? 1 : 0); opacity(ratioText, s.solved ? 1 : 0);
      // Never place final numeric coefficient/phase/modulation in a visible
      // actor before the corresponding source operation has completed.
      const alpha = s.alpha || { re: 0, im: 0 };
      vector(ratioArrow, alpha, 97); vector(length, alpha, 97);
      text(ratioText, s.solved ? `α̂ = ${complex(alpha)}` : '');
      const phase = s.phase === null ? 0 : s.phase, arc = s.phaseRead * phase;
      set(phaseArc, 'd', Math.abs(arc) < 1e-10 ? 'M 0 0' : `M 36 0 A 36 36 0 ${Math.abs(arc) > Math.PI ? 1 : 0} ${arc >= 0 ? 0 : 1} ${36 * Math.cos(arc)} ${-36 * Math.sin(arc)}`);
      set(phaseArc, 'data-phase', s.phase === null ? '' : s.phase); opacity(phaseArc, s.phaseRead);
      opacity(length, s.lengthRead); opacity(read, s.readAlpha);
      text(phaseText, s.phase === null ? '' : Math.abs(s.phase)<1e-10?'本例共同相位 φ̂Δ ≈ 0 rad':`φ̂Δ = ${number(s.phase, 4)} rad`); opacity(phaseText, s.phaseRead);
      text(lengthText, s.m === null ? '' : `m̂ = ${number(s.m, 4)}`); opacity(lengthText, s.lengthRead);
      opacity(cards, s.cards); legs.forEach(node => opacity(node, s.cards));
      cardNodes.forEach(({ g, v }, i) => {
        const shown = s.cards > 0, raw = i === 0 ? s.k.join(',') : i === 1 ? s.m : s.phase;
        set(g, 'data-value', shown ? raw : '');
        text(v, shown ? i === 0 ? `(${s.k.map(x => number(x, 2)).join(', ')}) DFT 格` : number(raw, 4) + (i === 2 ? ' rad' : '') : '');
      });
      if(s.tail){
        const keep=1-s.tail.enter;
        groups.forEach(g=>opacity(g,Number(g.style.opacity||g.getAttribute('opacity')||0)*keep));
        opacity(result,Number(result.style.opacity||result.getAttribute('opacity')||0)*keep);
        opacity(legend,0);
      }
      tailView.draw(s);
      return s;
    }
    draw(null); return { root: stage, draw };
  }
  Object.assign(Story, { createView });
})(typeof globalThis !== 'undefined' ? globalThis : this);
