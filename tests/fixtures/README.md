# 历史参数教学视图

`parameter-legacy-view.js` 与 `parameter-legacy-study.js` 保存两阶段重排前的一维教学视图，原位于 `web/parameter-demo/`。前者用于既有模型的独立回归，后者保留旧分镜源码；两个生产页面均不加载这些文件。

当前页面使用 `web/parameter-demo/sim-parameter-two-stage.js` 与 `sim-parameter-two-stage-view.js`，验证见 `tests/sim-parameter-two-stage.test.cjs`。
