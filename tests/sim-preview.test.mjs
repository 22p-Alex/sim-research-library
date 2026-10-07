import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getJobs, projectRoot, renderPage } from "../scripts/build_sim_preview.mjs";

const jobs = getJobs();
const outputs = new Map(jobs.map((job) => [job.source, job.output]));

test("所有生成页的本地资源、文件、章节锚点均有效", () => {
  const issues = [];
  let checked = 0;
  for (const job of jobs) {
    const html = fs.readFileSync(job.output, "utf8");
    assert.ok(!html.includes("SIMMATHPLACEHOLDER"), job.output);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(ids.length, new Set(ids).size, `重复锚点：${job.output}`);
    for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const url = new URL(match[1].replaceAll("&amp;", "&"), pathToFileURL(job.output));
      if (url.protocol !== "file:") continue;
      checked++;
      const file = fileURLToPath(url);
      if (!fs.existsSync(file)) { issues.push(`${job.output} → ${match[1]}`); continue; }
      if (url.hash && file.endsWith(".html")) {
        const destination = fs.readFileSync(file, "utf8");
        if (!destination.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`)) issues.push(`无效锚点：${job.output} → ${match[1]}`);
      }
    }
  }
  assert.deepEqual(issues, []);
  console.log(`已检查 ${jobs.length} 页中的 ${checked} 个本地链接/资源。`);
});

test("实际章节可重建，跨目录链接和图片正确，代码中的 $ 不被当作公式", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sim-preview-test-"));
  try {
    const fixture = path.join(dir, "source.md");
    fs.writeFileSync(fixture, '# Preview\n\n`$literal$`\n\n```tex\n$$not_math$$\n```\n\n$x^2$\n\n$$\\frac{1}{2}$$\n');
    const result = await renderPage(fixture, path.join(dir, "nested", "result.html"), outputs);
    assert.equal(result.formulas, 2);
    assert.match(result.html, /<code>\$literal\$<\/code>/);
    assert.match(result.html, /\$\$not_math\$\$/);
    assert.match(result.html, /class="katex"/);
    const source = path.join(projectRoot, "知识库/01-SIM基础与频谱直觉.md");
    const customOutput = path.join(dir, "deep", "custom.html");
    const rendered = await renderPage(source, customOutput, outputs);
    const expectedChapter = path.relative(path.dirname(customOutput), path.join(projectRoot, "知识库/02-统一成像模型与SIM分类预览.html"));
    const resources = [...rendered.html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => decodeURI(m[1]));
    assert.ok(resources.includes(expectedChapter));
    fs.writeFileSync(fixture, '# Invalid\n\n$\\hat\\mathbf k$\n');
    await assert.rejects(renderPage(fixture, customOutput, outputs), /公式无法渲染/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
