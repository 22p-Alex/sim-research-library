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
  'sim_pipeline_atlas.html':['web/atlas/sim-atlas-core.js','web/atlas/sim-atlas.js','web/atlas/sim-atlas.css']
};
const SHARED=['web/shared/sim-core.js','web/shared/sim-experiment.js'];
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

test('every asset the two pages load exists on disk',()=>{
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
});

test('laboratory bootstrap loads after all module definitions',()=>{
  const scripts=assetsOf('sim_interactive_demo.html').filter(file=>file.endsWith('.js'));
  assert.equal(scripts.at(-1),'web/lab/app.js');
  assert.ok(scripts.indexOf('web/shared/sim-core.js')<scripts.indexOf('web/lab/scene.js'));
  assert.ok(scripts.indexOf('web/lab/ui.js')<scripts.indexOf('web/lab/comparison.js'));
});

test('shared computation and experiment presets do not read page state',()=>{
  for(const file of [...SHARED,'web/lab/presets.js'])
    assert.doesNotMatch(read(file),/\bdocument\.|SIMLab\.app\b|SIMDemo\b|SIMComparisons\b/,file);
});

test('dependencies point page-ward only, never from shared or across pages',()=>{
  for(const f of [...SHARED,...Object.values(PAGES).flat()])
    for(const r of requiresOf(f)) {
      const owner=exclusiveOf(r);
      assert.ok(!owner||owner===exclusiveOf(f),`${f} require 了 ${r}（属于 ${owner||'共享层'}）`);
    }
});

test('no front-end module is orphaned in web/ or left in the project root',()=>{
  const claimed=new Set([...SHARED,...Object.values(PAGES).flat()]);
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

test('the two pages link to each other both ways',()=>{
  for(const page of Object.keys(PAGES)) {
    const html=read(page);
    for(const other of Object.keys(PAGES))
      if(other!==page)
        assert.ok(html.includes(`href="${other}"`),`${page} 缺少指向 ${other} 的导航链接`);
  }
});

test('static pages load no remote resources and no page-exclusive module',()=>{
  for(const page of STATIC_PAGES)
    for(const asset of assetsOf(page)) {
      assert.ok(!/^https?:\/\//.test(asset),`${page} 依赖远程资源 ${asset}（本项目离线优先，样式与脚本必须本地）`);
      const owner=exclusiveOf(asset);
      assert.ok(!owner,`${page} 加载了属于 ${owner} 的独占模块 ${asset}`);
    }
});

/* UNLINKED_STATIC_PAGES：用户确认不再从交互页导航过去的静态页。
   它们的文件仍保留、可直接访问，也仍会从交互页反向可达，只是入口已移除。 */
const UNLINKED_STATIC_PAGES=['sim_real_optical_path.html'];

test('static pages and interactive pages link to each other both ways',()=>{
  for(const s of STATIC_PAGES) {
    const html=read(s);
    for(const page of Object.keys(PAGES)) {
      assert.ok(html.includes(`href="${page}"`),`${s} 缺少指向 ${page} 的导航链接`);
      if(UNLINKED_STATIC_PAGES.includes(s)) continue;
      assert.ok(read(page).includes(`href="${s}"`),`${page} 缺少指向 ${s} 的导航链接`);
    }
  }
});
