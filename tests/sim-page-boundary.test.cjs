/* Page/module ownership boundary.
 * Each interactive page may only load its own exclusive modules plus the shared
 * layer; the shared layer must never depend on a page; and no front-end module
 * may be left orphaned in web/ after a page is deleted.
 * Run: node --test tests/sim-page-boundary.test.cjs
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

// Exclusive ownership, as declared in the README page-responsibility table.
const PAGES={
  'sim_interactive_demo.html':[
    'web/lab/ui.js','web/lab/scene.js','web/lab/acquisition.js','web/lab/presets.js',
    'web/lab/comparison.js','web/lab/conv-otf.js','web/lab/app.js',
    'web/lab/base.css','web/lab/acquisition.css'
  ],
  'sim_pipeline_atlas.html':['web/atlas/sim-atlas.js','web/atlas/sim-atlas.css'],
  'sim_motion_demo.html':['web/motion/sim-motion-model.js','web/motion/sim-motion-parameter-view.js','web/motion/sim-motion-stages.js','web/motion/sim-motion-fourier.js','web/motion/sim-motion.js','web/motion/sim-motion.css'],
  'sim_parameter_demo.html':['web/parameter-demo/sim-parameter-app.js','web/parameter-demo/sim-parameter-preview.js','web/parameter-demo/sim-parameter.css']
};
const SHARED=['web/shared/sim-core.js','web/shared/sim-experiment.js'];
// The DOM-free atlas computation is reused by its subordinate motion demo.
// Keep its existing path/API so established consumers do not need migration.
const REUSABLE=['web/atlas/sim-atlas-core.js','web/atlas/sim-atlas-demix-coefficients.js','web/shared/sim-parameter-estimation.js','web/shared/sim-band-formulas.js'];
// Reusable presentation components sit above computation. The preview uses
// them in both the preview and the integrated Motion timeline.
const CHAPTER=['web/parameter-demo/sim-parameter-fit-view.js','web/parameter-demo/sim-parameter-line-view.js','web/parameter-demo/sim-parameter-model.js','web/parameter-demo/sim-parameter-two-stage.js','web/parameter-demo/sim-parameter-refinement-view.js','web/parameter-demo/sim-parameter-two-stage-view.js','web/parameter-demo/sim-parameter-two-stage.css','web/parameter-demo/sim-parameter-study.css','web/motion/sim-motion-parameter-chapter.js'];
const MAIN_PAGES=['sim_interactive_demo.html','sim_pipeline_atlas.html'];
// Static visual pages: pure SVG diagrams with no computation, therefore they do
// NOT load the shared layer. They must stay fully local (offline-first project)
// and must be reachable from the interactive pages' navigation.
const STATIC_PAGES=['sim_real_optical_path.html'];
const exclusiveOf=file=>Object.keys(PAGES).find(page=>PAGES[page].includes(file));

// Local assets a page loads, as root-relative paths with ?v= cache busters stripped.
function assetsOf(page) {
  const out=[];
  for(const m of read(page).matchAll(/<script[^>]*\ssrc="([^"]+)"|<link[^>]*\shref="([^"]+\.css(?:\?[^"]*)?)"/g))
    out.push((m[1]||m[2]).split('?')[0]);
  return out;
}
function requiresOf(file) {
  return [...read(file).matchAll(/require\(['"]([^'"]+)['"]\)/g)]
    .map(m=>path.relative(root,path.resolve(root,path.dirname(file),m[1])));
}

test('every asset the interactive pages load exists on disk',()=>{
  for(const page of Object.keys(PAGES))
    for(const asset of assetsOf(page))
      assert.ok(fs.existsSync(path.join(root,asset)),`${page} 引用了不存在的 ${asset}`);
});

test('no page loads another page\'s exclusive module',()=>{
  for(const page of Object.keys(PAGES))
    for(const asset of assetsOf(page)) {
      const owner=exclusiveOf(asset);
      assert.ok(!owner||owner===page,`${page} 加载了属于 ${owner} 的独占模块 ${asset}`);
    }
});

test('each page loads its own exclusive modules and the shared layer',()=>{
  for(const [page,owned] of Object.entries(PAGES)) {
    const loaded=assetsOf(page);
    for(const f of owned)assert.ok(loaded.includes(f),`${page} 没有加载自己的 ${f}`);
    for(const f of SHARED)assert.ok(loaded.includes(f),`${page} 没有加载共享层 ${f}`);
  }
  for(const page of ['sim_parameter_demo.html','sim_motion_demo.html'])
    for(const file of CHAPTER)assert.ok(assetsOf(page).includes(file),`${page} 缺少参数章节 ${file}`);
});

test('laboratory bootstrap loads after all module definitions',()=>{
  const scripts=assetsOf('sim_interactive_demo.html').filter(file=>file.endsWith('.js'));
  assert.equal(scripts.at(-1),'web/lab/app.js');
  assert.ok(scripts.indexOf('web/shared/sim-core.js')<scripts.indexOf('web/lab/scene.js'));
  assert.ok(scripts.indexOf('web/lab/ui.js')<scripts.indexOf('web/lab/comparison.js'));
});

test('fixed atlas removes experiment controls without leaving missing renderer targets',()=>{
  const html=read('sim_pipeline_atlas.html'), source=read('web/atlas/sim-atlas.js');
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  for(const id of ['experiment','experiment-details','status','c-sample','c-dir','c-msrc','c-noise','c-m','c-eps','c-apo','c-bend','c-scope','c-phase','c-angle','c-merr','c-otf','reset','c-fusion-q','o-fusion-q','fusion-readout','fusion-contributions','fusion-direction-readout','frequency-validation'])
    assert.ok(!ids.has(id),`obsolete experiment target ${id}`);
  assert.doesNotMatch(html, /href="#experiment"|外部估计 m|参数失配实验|data-preset=/);
  for(const [,id] of source.matchAll(/\$\(['"]([^'"]+)['"]\)/g))
    assert.ok(ids.has(id),`renderer references removed HTML target ${id}`);
  for(let step=1;step<=9;step++)assert.ok(ids.has(`b${step}`));
  for(const id of ['c-inspect','c-view','c-profile-y'])assert.ok(ids.has(id));
});

test('shared computation and experiment presets do not read page state',()=>{
  for(const file of [...SHARED,...REUSABLE,'web/lab/presets.js'])
    assert.doesNotMatch(read(file),/\bdocument\.|SIMLab\.app\b|SIMDemo\b|SIMComparisons\b/,file);
});

test('dependencies point page-ward only, never from shared or across pages',()=>{
  for(const f of [...SHARED,...REUSABLE,...CHAPTER,...Object.values(PAGES).flat()])
    for(const r of requiresOf(f)) {
      const owner=exclusiveOf(r);
      assert.ok(!owner||owner===exclusiveOf(f),`${f} require 了 ${r}（属于 ${owner||'共享层'}）`);
      if(SHARED.includes(f)||REUSABLE.includes(f))assert.ok(!CHAPTER.includes(r),`${f} 不能反向依赖章节组件 ${r}`);
    }
});

test('no front-end module is orphaned in web/ or left in the project root',()=>{
  const claimed=new Set([...SHARED,...REUSABLE,...CHAPTER,...Object.values(PAGES).flat()]);
  function collect(dir) {
    return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(entry=>{
      const file=path.posix.join(dir,entry.name);
      return entry.isDirectory()?collect(file):/\.(js|css)$/.test(entry.name)?[file]:[];
    });
  }
  const modules=fs.readdirSync(root).filter(f=>/^sim[-_].*\.(js|css)$/.test(f))
    .concat(collect('web'));
  const orphans=modules.filter(f=>!claimed.has(f));
  assert.deepEqual(orphans,[],
    `存在未归类或未被任何页面认领的模块：${orphans.join('、')}。前端模块应放入 web/；删除页面时必须一并清理其独占模块。`);
});

test('the two main learning pages link to each other both ways',()=>{
  for(const page of MAIN_PAGES) {
    const html=read(page);
    for(const other of MAIN_PAGES)
      if(other!==page)
        assert.ok(html.includes(`href="${other}"`),`${page} 缺少指向 ${other} 的导航链接`);
  }
});

test('motion demo is linked from its atlas, returns to it, and reuses only the computation',()=>{
  assert.ok(read('sim_pipeline_atlas.html').includes('href="sim_motion_demo.html"'));
  assert.ok(read('sim_motion_demo.html').includes('href="sim_pipeline_atlas.html"'));
  for(const page of ['sim_pipeline_atlas.html','sim_motion_demo.html']) {
    const assets=assetsOf(page);
    assert.ok(assets.includes(REUSABLE[0]));
    assert.ok(assets.indexOf(SHARED[1])<assets.indexOf(REUSABLE[0]));
    assert.ok(assets.indexOf(REUSABLE[0])<assets.indexOf(page==='sim_motion_demo.html'?'web/motion/sim-motion-model.js':'web/atlas/sim-atlas.js'));
  }
  assert.doesNotMatch(read('sim_motion_demo.html'),/src="web\/atlas\/sim-atlas\.js/);
  const motionAssets=assetsOf('sim_motion_demo.html');
  assert.ok(motionAssets.indexOf('web/motion/sim-motion-model.js')<motionAssets.indexOf('web/motion/sim-motion-stages.js'));
  assert.ok(motionAssets.indexOf('web/motion/sim-motion-stages.js')<motionAssets.indexOf('web/motion/sim-motion.js'));
});

test('static pages load no remote resources and no page-exclusive module',()=>{
  for(const page of STATIC_PAGES)
    for(const asset of assetsOf(page)) {
      assert.ok(!/^https?:\/\//.test(asset),`${page} 依赖远程资源 ${asset}（本项目离线优先，样式与脚本必须本地）`);
      const owner=exclusiveOf(asset);
      assert.ok(!owner,`${page} 加载了属于 ${owner} 的独占模块 ${asset}`);
      assert.ok(!SHARED.includes(asset)&&!REUSABLE.includes(asset),`${page} 不应加载交互计算模块 ${asset}`);
    }
});

/* UNLINKED_STATIC_PAGES：用户确认不再从交互页导航过去的静态页。
   它们的文件仍保留、可直接访问，也仍会从交互页反向可达，只是入口已移除。 */
const UNLINKED_STATIC_PAGES=['sim_real_optical_path.html'];

test('static pages and interactive pages link to each other both ways',()=>{
  for(const s of STATIC_PAGES) {
    const html=read(s);
    for(const page of MAIN_PAGES) {
      assert.ok(html.includes(`href="${page}"`),`${s} 缺少指向 ${page} 的导航链接`);
      if(UNLINKED_STATIC_PAGES.includes(s)) continue;
      assert.ok(read(page).includes(`href="${s}"`),`${page} 缺少指向 ${s} 的导航链接`);
    }
  }
});
