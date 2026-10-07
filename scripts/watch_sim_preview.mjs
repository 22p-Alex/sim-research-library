import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { projectRoot, getJobs } from "./build_sim_preview.mjs";

const builderPath = path.join(projectRoot, "scripts/build_sim_preview.mjs");
let child = null, pending = false;

function signature() {
  return getJobs().map(({ source }) => {
    const stat = fs.statSync(source, { throwIfNoEntry: false });
    return `${source}:${stat?.mtimeMs}:${stat?.ctimeMs}:${stat?.size}`;
  }).join("\n");
}

function compile() {
  if (child) { pending = true; return; }
  child = spawn(process.execPath, [builderPath, "--all"], { cwd: projectRoot, stdio: "inherit" });
  child.on("error", (error) => console.error(error.message));
  child.on("close", (code) => {
    child = null;
    if (code !== 0) console.error(`预览构建失败（${code}）；修正源文件后会再次构建。`);
    if (pending) { pending = false; compile(); }
  });
}

// Polling also works when the filesystem does not deliver native watch events.
let previous = signature();
const timer = setInterval(() => {
  try {
    const current = signature();
    if (current !== previous) { previous = current; compile(); }
  } catch (error) { console.error(`读取文档目录失败：${error.message}`); }
}, 1000);
compile();
console.log("正在监听资料库入口、知识专题及论文 Markdown（含文件新增/删除）。按 Ctrl+C 停止。");

function shutdown() {
  clearInterval(timer);
  child?.kill();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
