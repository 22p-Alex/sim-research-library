import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

export const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const katex = require("./vendor/katex/katex.min.js");
export const paperDirs = [
  "SIM综述", "HiFI-SIM", "BayesDL-SIM", "DeAbe", "SSR-SIM", "Wiener-SIM/fairSIM-论文",
  "参数自适应/RL-SIM", "3D-MP-SIM/3D-SIM/Open-3DSIM", "3D-MP-SIM/3D-MP-SIM-论文",
];
export const rootSources = ["README.md", "SIM知识库.md", "SIM项目总览.md", "SIM文献目录.md", "SIM模拟台核对与操作说明.md"];
export const sourceDirs = ["知识库", ...paperDirs];
const slash = (value) => value.split(path.sep).join("/");
const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function previewPath(source) {
  if (source === path.join(projectRoot, "README.md")) return path.join(projectRoot, "index.html");
  if (path.basename(source) === "High-fidelity structured illumination microscopy by point-spread-function engineering-译文.md") {
    return path.join(path.dirname(source), "HiFi-SIM译文预览.html");
  }
  return source.replace(/\.md$/i, "预览.html");
}

export function getJobs() {
  const sources = rootSources.map((p) => path.join(projectRoot, p));
  for (const dir of sourceDirs) {
    const fullDir = path.join(projectRoot, dir);
    for (const file of fs.readdirSync(fullDir).sort()) {
      if (file.endsWith(".md")) sources.push(path.join(fullDir, file));
    }
  }
  return sources.map((source) => ({ source, output: previewPath(source) }));
}

async function loadMarked() {
  if (process.env.SIM_MARKED_PATH) {
    return import(pathToFileURL(path.resolve(process.env.SIM_MARKED_PATH)).href);
  }
  try { return await import("marked"); } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    const bundled = path.join(os.homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/marked/lib/marked.esm.js");
    if (!fs.existsSync(bundled)) throw new Error("未找到 marked；请安装 marked 或用 SIM_MARKED_PATH 指定模块文件。", { cause: error });
    return import(pathToFileURL(bundled).href);
  }
}

export async function renderPage(source, output, outputs) {
  const { Marked } = await loadMarked();
  const markdown = fs.readFileSync(source, "utf8");
  const outputDir = path.dirname(output);
  const relative = (target) => slash(path.relative(outputDir, target));
  const hrefFor = (file) => relative(outputs.get(path.join(projectRoot, file)) || path.join(projectRoot, file));
  const code = [], math = [];
  const saveCode = (text) => `SIMCODEPLACEHOLDER${code.push(text) - 1}END`;
  // Code examples are literal text, including the Markdown math delimiters they demonstrate.
  let protectedMarkdown = markdown.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*$/gm, saveCode)
    .replace(/(`+)[\s\S]*?\1/g, saveCode);
  const saveMath = (displayMode) => (_match, tex) => {
    let html;
    try {
      html = katex.renderToString(tex.trim(), { displayMode, throwOnError: true, trust: false, strict: "ignore" });
    } catch (error) {
      throw new Error(`${relative(source)} 中公式无法渲染：${tex.trim()}\n${error.message}`);
    }
    math.push(`<span class="${displayMode ? "math-display" : "math-inline"}">${html}</span>`);
    return `SIMMATHPLACEHOLDER${math.length - 1}END`;
  };
  protectedMarkdown = protectedMarkdown.replace(/\$\$([\s\S]*?)\$\$/g, saveMath(true))
    .replace(/(?<!\\)\$([^$\n]+?)\$/g, saveMath(false))
    .replace(/SIMCODEPLACEHOLDER(\d+)END/g, (_match, i) => code[Number(i)]);

  function localHref(href, isImage) {
    if (!href || /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(href)) return href;
    const [, pathname, suffix = ""] = href.match(/^([^?#]*)(.*)$/);
    if (!pathname) return href;
    const target = path.resolve(path.dirname(source), decodeURIComponent(pathname));
    const mapped = isImage ? target : outputs.get(target) || target;
    return relative(mapped) + suffix;
  }
  const parser = new Marked({
    walkTokens(token) {
      if (token.type === "link" || token.type === "image") token.href = localHref(token.href, token.type === "image");
    },
  });
  let body = parser.parse(protectedMarkdown);
  const ids = new Set([...body.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  body = body.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_all, level, text) => {
    const base = text.replace(/<[^>]*>/g, "").toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, "").trim().replace(/\s+/g, "-") || "section";
    let id = base, i = 1;
    while (ids.has(id)) id = `${base}-${i++}`;
    ids.add(id);
    return `<h${level} id="${id}">${text}</h${level}>`;
  });
  body = body.replace(/SIMMATHPLACEHOLDER(\d+)END/g, (_match, i) => math[Number(i)]);
  const title = markdown.match(/^# (.+)$/m)?.[1] || path.basename(source, ".md");
  const topics = getJobs().filter((job) => /^\d{2}-/.test(path.basename(job.source)));
  const link = (label, file) => `<a href="${escapeHtml(hrefFor(file))}"${path.join(projectRoot, file) === source ? ' aria-current="page"' : ""}>${escapeHtml(label)}</a>`;
  const topicLinks = topics.map((job) => link(path.basename(job.source, ".md").replace("-", " · "), slash(path.relative(projectRoot, job.source)))).join("\n");
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="SIM Markdown preview">
<title>${escapeHtml(title)} · SIM 资料库</title>
<link rel="stylesheet" href="${escapeHtml(relative(path.join(projectRoot, "vendor/katex/katex.min.css")))}">
<style>
:root { color-scheme: light; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif; color: #243142; background: #fff; }
* { box-sizing: border-box; }
body { margin: 0; line-height: 1.8; }
a { color: #17646c; text-underline-offset: .2em; overflow-wrap: anywhere; }
a:hover { color: #0a4047; }
a:focus-visible { outline: 2px solid #17646c; outline-offset: 3px; }
.skip { position: absolute; left: 18px; top: -100px; background: white; padding: 10px; z-index: 10; }
.skip:focus { top: 8px; }
.layout { max-width: 1440px; margin: auto; display: grid; grid-template-columns: 260px minmax(0,1fr); }
aside { position: sticky; top: 0; height: 100vh; overflow: auto; background: #f5f7f8; border-right: 1px solid #e3e8eb; padding: 30px 20px; font-size: 14px; }
.brand { margin: 0 0 18px; color: #17646c; font-weight: 700; letter-spacing: .04em; }
nav a { display: block; text-decoration: none; padding: 6px 10px; border-radius: 5px; }
nav a[aria-current] { background: #e0eeee; color: #0d5057; font-weight: 650; }
nav .group { margin: 22px 10px 6px; font-size: 12px; color: #617080; }
main { min-width: 0; padding: 42px 48px 80px; }
article { max-width: 1000px; margin: auto; }
h1,h2,h3,h4 { color: #162a37; line-height: 1.45; scroll-margin-top: 24px; }
h1 { font-size: 2rem; margin: 0 0 24px; }
h2 { font-size: 1.4rem; margin-top: 2em; padding-bottom: .3em; border-bottom: 1px solid #e3e8eb; }
h3 { font-size: 1.1rem; margin-top: 1.8em; }
p,li { overflow-wrap: anywhere; }
a[id] { scroll-margin-top: 24px; }
blockquote { margin: 1.2em 0; padding: .5em 1em; background: #f5f8f8; border-left: 3px solid #7ba9ac; color: #526371; }
blockquote p { margin: .3em 0; }
table { width: 100%; border-collapse: collapse; margin: 1.3em 0; font-size: .9rem; }
th,td { padding: .65em .75em; border: 1px solid #dce4e8; text-align: left; vertical-align: top; }
th { background: #f0f5f5; font-weight: 600; }
tr:nth-child(even) td { background: #fafcfc; }
code { background: #edf1f3; border-radius: 4px; padding: .12em .3em; font-size: .88em; overflow-wrap: anywhere; }
pre { overflow: auto; padding: 16px; background: #f3f6f7; border-radius: 6px; line-height: 1.65; }
pre code { padding: 0; background: none; white-space: pre; }
img,svg { max-width: 100%; height: auto; }
.math-display { display: block; max-width: 100%; overflow-x: auto; margin: 1em 0; }
.katex-display { margin: .4em 0; }
.katex { font-size: 1.08em; }
footer { margin-top: 42px; padding-top: 16px; border-top: 1px solid #e3e8eb; color: #667785; font-size: 13px; }
@media(max-width: 850px) { .layout { display: block; } aside { position: static; height: auto; padding: 18px; border-right: 0; border-bottom: 1px solid #e3e8eb; } nav { display: flex; flex-wrap: wrap; gap: 2px; } nav .topics,nav .group { display: none; } .brand { margin: 0 10px 10px; } main { padding: 28px 18px 50px; } table { display: block; overflow: auto; } th,td { min-width: 110px; } h1 { font-size: 1.7rem; } }
@media print { aside,.skip,footer { display: none; } .layout { display: block; } main { padding: 0; } h2,h3 { break-after: avoid; } img { max-height: 90vh; object-fit: contain; } }
</style>
</head>
<body>
<a class="skip" href="#content">跳到正文</a>
<div class="layout">
<aside><p class="brand">SIM · 毕业课题资料库</p><nav aria-label="资料库导航">
${link("资料库首页", "README.md")}
${link("知识库目录", "SIM知识库.md")}
${link("文献与代码", "SIM文献目录.md")}
${link("项目总览", "SIM项目总览.md")}
<p class="group">学习专题</p><div class="topics">${topicLinks}</div>
<p class="group">工具与维护</p>
${link("SIM 交互演示", "sim_interactive_demo.html")}
${link("模拟台模型核对", "SIM模拟台核对与操作说明.md")}
${link("维护说明", "知识库/维护说明.md")}
</nav></aside>
<main id="content"><article>
${body}
<footer>正文来源：<a href="${escapeHtml(relative(source))}">${escapeHtml(slash(path.relative(projectRoot, source)))}</a> · 修改源文件后运行预览构建命令。公式与字体均使用本地资源。</footer>
</article></main>
</div>
</body></html>\n`;
  return { html, formulas: math.length };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("node build_sim_preview.mjs [--all | --source 文件.md [--output 文件.html]]");
    return;
  }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") continue;
    if (!["--source", "--output"].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`无效参数：${args[i]}`);
    i++;
  }
  if (args.includes("--all") && (args.includes("--source") || args.includes("--output"))) throw new Error("--all 不能与 --source/--output 同时使用。");
  const value = (flag) => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
  const source = path.resolve(projectRoot, value("--source") || "SIM知识库.md");
  if (!source.endsWith(".md")) throw new Error("源文件必须是 Markdown（.md）。");
  const output = value("--output") ? path.resolve(projectRoot, value("--output")) : previewPath(source);
  const jobs = args.includes("--all") ? getJobs() : [{ source, output }];
  for (const job of jobs) if (job.source === job.output) throw new Error("输出不能覆盖 Markdown 源文件。");
  const outputs = new Map(getJobs().map((job) => [job.source, job.output]));
  for (const job of jobs) outputs.set(job.source, job.output);
  // Render every page before writing, so a broken formula does not leave a partial rebuild.
  const rendered = [];
  for (const job of jobs) rendered.push({ ...job, ...await renderPage(job.source, job.output, outputs) });
  for (const page of rendered) {
    fs.mkdirSync(path.dirname(page.output), { recursive: true });
    fs.writeFileSync(page.output, page.html);
  }
  console.log(`已生成 ${rendered.length} 个阅读页，${rendered.reduce((n, page) => n + page.formulas, 0)} 处公式；全部使用本地 KaTeX。`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
