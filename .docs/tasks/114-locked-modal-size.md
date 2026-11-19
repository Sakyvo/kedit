Status: review

## Parent

`113-locked-modal-size.md`

## What to build

弹窗面板从"内容决定高度"改成"锁定视口上限"，并把按钮栏钉到面板底部。

- `.modal__inner-2` 高度恒等于上限：≤600 CSS px 为视口高（四边仍贴齐、无圆角），>600px 为视口高 − 60px（保留 16/10/32 外边距与圆角）。
- 内容短时面板不变矮：内部留白，按钮栏仍贴在面板底部（不再悬在内容下方）。
- 长内容仍由面板自身滚动；粘顶标题/tabs 的盖板偏移与内距保持成对（铁律不改）。
- 内件的固定高度一律不动（yaml 编辑器、图片清理列表、ChatGPT 输出框）。
- 高度变化不加过渡动画。

## Acceptance criteria

- [x] `npm run build` 通过
- [x] 1280 / 601px：配置弹窗三个 tab（可视化 / yaml编辑 / 默认预览）面板高度完全相同，且等于视口高 − 60px
- [x] 390 / 590px：同样三个 tab 高度完全相同，且等于视口高；面板四边仍贴齐、无圆角
- [x] 上述四个视口下，短内容弹窗（确认框 / 链接输入）与长内容弹窗（配置）面板高度相同
- [x] 每个用例按钮栏 `rect.bottom` 贴面板底边（短内容时也是）
- [x] 长内容（可视化 tab / 模板列表）滚到底：内容不被按钮栏遮挡，最后一行可见
- [x] 桌面 1280/601 的内距、圆角、宽度上限、字号、盖板偏移仍与 105 一致（不回归）
- [x] 内件尺寸不变：yaml 编辑器仍是 160px 起、图片清理列表仍 320px 上限
- [x] 面板高度无 transition（计算样式 `transition-duration` 为 0s）

自动化证据：`node test/browser/modal-locked-size.mjs`（真实 `dist/`，390/590/601/1280px）+ 更新后的 `mobile-modal.mjs`。

- [ ] 真机确认：手机上打开配置弹窗切三个 tab，面板不再变高变矮（需人工过一遍）

## Blocked by

None - can start immediately