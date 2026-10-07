# SIM 工具脚本

在项目根目录运行以下命令：

| 脚本 | 命令 | 生成或维护的内容 |
|---|---|---|
| [build_sim_preview.mjs](build_sim_preview.mjs) | `npm run build:preview` | Markdown 对应的本地 HTML 阅读页与根目录首页 |
| [watch_sim_preview.mjs](watch_sim_preview.mjs) | `npm run watch:preview` | 启动时构建一次，随后监听 Markdown 变动并重建；Ctrl+C 停止 |
| [capture_sim_single_direction.cjs](capture_sim_single_direction.cjs) | `npm run capture:guide` | `output/sim-single-direction-guide/` 中的截图与 `measurements.json` |
| [render_sim_band_figures.py](render_sim_band_figures.py) | `python3 scripts/render_sim_band_figures.py` | `web/figures/` 中的频谱坐标与频带覆盖 SVG；仅需 Python 标准库 |

单独生成某篇文档：

```sh
node scripts/build_sim_preview.mjs --source "SIM单方向学习指南.md" --output "output/SIM单方向学习指南.html"
```

脚本从自身位置定位项目根目录。预览构建使用本地 KaTeX 和 `marked`，后者也可通过 `SIM_MARKED_PATH` 指定。截图脚本使用本机 Playwright 与 Chromium，可通过 `SIM_PLAYWRIGHT_DIR`、`SIM_BROWSER_EXECUTABLE` 指定安装位置。

源码维护在本目录，截图和测量数据写入 `output/`；批量预览的来源目录在 `build_sim_preview.mjs` 的 `rootSources`、`sourceDirs` 中维护。监听时修改构建配置后需重启脚本。
