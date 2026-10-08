# SIM 工具脚本

在项目根目录运行以下命令：

| 脚本 | 命令 | 生成或维护的内容 |
|---|---|---|
| [capture_sim_single_direction.cjs](capture_sim_single_direction.cjs) | `npm run capture:guide` | `output/sim-single-direction-guide/` 中的截图与 `measurements.json` |
| [render_sim_band_figures.py](render_sim_band_figures.py) | `python3 scripts/render_sim_band_figures.py` | `web/figures/` 中的频谱坐标与频带覆盖 SVG；仅需 Python 标准库 |

脚本从自身位置定位项目根目录。截图脚本使用本机 Playwright 与 Chromium，可通过 `SIM_PLAYWRIGHT_DIR`、`SIM_BROWSER_EXECUTABLE` 指定安装位置。

源码维护在本目录，截图和测量数据写入 `output/`。

> 2026-10-08：预览生成子系统（`build_sim_preview.mjs`、`watch_sim_preview.mjs` 与 38 个 `*预览.html`、`index.html`）已整体移除，Markdown 是唯一文档载体；需要旧脚本时从提交 `9ce46ed` 取回。
