/* Rebuild local script lists and the scene catalog. Does not start a server. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'web/animation-assets.json'), 'utf8'));

function write(file, content) {
  const full = path.join(root, file);
  if (check) {
    assert.equal(fs.readFileSync(full, 'utf8'), content, `${file} 未同步；运行 npm run scenes:sync。`);
  } else {
    fs.writeFileSync(full, content);
  }
}

for (const [page, assets] of Object.entries(manifest.pages)) {
  assert.equal(new Set(assets).size, assets.length, page + ' 有重复模块');
  for (const asset of assets) {
    assert.ok(fs.existsSync(path.join(root, asset)), asset + ' 不存在');
  }
  const source = fs.readFileSync(path.join(root, page), 'utf8');
  const pattern = /<script src="web\/[\s\S]*?(?=<\/body>)/;
  assert.ok(pattern.test(source), page + ' 缺少本地脚本区块');
  const scripts = assets.map(file => `<script src="${file}?v=${manifest.version}"></script>`).join('\n') + '\n';
  write(page, source.replace(pattern, () => scripts));
}

const M = require('../web/motion/sim-motion-model.js');
const C = require('../web/motion/sim-motion-parameter-chapter.js');
const Peak = require('../web/parameter-demo/scenes/get-peak/state.js');
const Registry = require('../web/shared/animation/scene-registry.js');
const Preview=require('../web/parameter-demo/sim-parameter-preview.js');
const registry = Registry.create(C.plan(M).scenes, { kind: 'motion', getPeak: Peak, chapter: C, motion: M });
const ids = new Set(registry.entries.map(entry => entry.id));
const templates = manifest.sceneTemplates || [];

for (const template of templates) {
  for (const id of template.scenes) assert.ok(ids.has(id), '共享模板引用未知场景：' + id);
  assert.equal(new Set(template.files).size, template.files.length, '共享模板重复声明文件');
  for (const file of template.files) {
    assert.ok(fs.existsSync(path.join(root, file)), file + ' 不存在');
    assert.ok(manifest.pages['sim_motion_demo.html'].includes(file), '主线未加载共享模板：' + file);
  }
}

function link(file, label) {
  return `[${label}](${path.relative('web/motion', file).split(path.sep).join('/')})`;
}

const rows = registry.entries.map(entry => {
  const folder = path.dirname(entry.unit);
  const ownedFiles = fs.readdirSync(path.join(root, folder))
    .filter(file => /^(state|view|formula-view|layout)\.js$/.test(file))
    .map(file => path.posix.join(folder, file));
  const links = [link(entry.unit, '分镜'), ...ownedFiles.map(file => link(file, path.basename(file, '.js')))];
  const sharedFiles = new Set(templates.filter(template => template.scenes.includes(entry.id)).flatMap(template => template.files));
  for (const file of sharedFiles) {
    if (!ownedFiles.includes(file)) links.push(link(file, '共用 ' + path.basename(file, '.js')));
  }
  return `| ${entry.index + 1} | \`${entry.id}\` | ${entry.label} | ${entry.initial ? '静态起点' : entry.duration / 1000 + ' 秒'} | ${entry.beats.length} | ${links.join(' · ')} |`;
});

const catalog = `# 完整动画的分镜目录

此文件由 \`npm run scenes:sync\` 生成。内容修改从每幕的分镜文件开始；目录顺序由场景组合决定，排练界面读取同一份注册表。查看[治理约定](GOVERNANCE.md)。

| 幕 | 稳定 ID | 教学单元 | 时长 | 可定位分镜 | 编辑入口 |
|---|---|---|---|---|---|
${rows.join('\n')}

当前完整页 ${registry.entries.length} 幕；独立参数页 ${Preview.scenes.length} 幕。仅在独立测试保留的 verify-demix 不进入主线。简单过渡以一个完整分镜为单位；频率编码、临时分离、评分、FFT、细化、getPeak、归位、加权、累加与 Wiener 提供内部拍定位。

标注“共用”的链接来自 animation-assets.json 的 sceneTemplates；修改前查看该模板的全部使用者。模板共享画面对象，各幕单独拥有内容定义。参数前半段共用持续存在的频谱几何模板 sim-parameter-two-stage-view.js；各幕状态和公式定义已独立。getPeak、归位、加权、累加与 Wiener 已采用拍内时序，其余旧场景仍保留原有内部时序，详见治理约定。

验证状态：数值、公式状态和可逆转场纳入自动检查；实际视觉与字体基线由用户验收，尚未登记通过。
`;
write('web/motion/SCENES.md', catalog);
console.log(check ? '场景目录和本地模块清单一致。' : `已同步两个入口及 ${registry.entries.length} 幕场景目录。`);
