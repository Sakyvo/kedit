Status: done

## Parent

[预览长串折行与分割线三档](099-divider-tiers-preview-wrap.md)

## What to build

编辑区里敲 `---` / `------` / `---------` 得到三档不同颜色的标记串（原色 / 蓝 / 红），任何编辑主题下都不变形。档位由源行的标记字符数决定，与预览共用同一张档位表。分割线命令改为插入原色档。

源文本仍是标准 CommonMark `hr`，只是渲染着色不同（ADR 0004）；档位的颜色与粗细由 KEDIT 独占（ADR 0017）。

## Acceptance criteria

- [x] `---`、`----`、`-----` 标记串保持淡灰（`$editor-color-*-high`），无变化。
- [x] `------` 至 `--------` 标记串为蓝 `#2e86c8`（深色 `#6fb5e6`）。
- [x] `---------` 及以上为红 `#c0392b`（深色 `#e5735f`）。
- [x] `- - - - - -` 与 `------` 同档；`******` / `______` 与 `------` 同档（标记字符数口径，空格不计）。
- [x] 逐个切换全部 15 个内置编辑主题（亮/暗各一遍），三档颜色均不变形；再注入一段特异性更高的主题 CSS（不带 `!important`）仍不变形。
- [x] 分割线命令插入的源文本为 `---`（不再是 10 个标记）。
- [x] 档位阈值只有一处定义（`dividerSvc` 的 `DIVIDER_TIERS`），编辑区语法、预览渲染与命令插入都引用它。
- [x] `npm run build` 通过；给出三档 × 亮/暗的实测证据。

> 事实修正：KEDIT 目前**没有**「分割线」工具栏按钮（`src/data/pagedownButtons.js` 的 15 个按钮里没有 hr），唯一入口是 `uiManager.doClick('hr')` 这条命令本身。因此本卡改为验证该命令，而不是某个按钮。

## Evidence

- passed：`test/node/dividerTiers.test.js` —— 三档边界（3/5/6/8/9/13 个标记）、空格不清零（`- - - - - -` → blue）、三种标记字符同权、非分割线行为 `none`、档位表只有一处定义、编辑区语法的 `inside` 规则与档位表一致、命令片段为 `---`。
- passed：`test/node/dividerStyles.test.js` —— `markdownHighlighting.scss` 编译后 `.markdown-highlighting .hr` / `.hr-strong` / `.hr-strong--red` 及其 `.app--dark` 变体都是 `!important` 的指定色值。
- passed：`node test/browser/divider-tiers.mjs` —— 3 档 × 15 个编辑主题 × 亮/暗，共 90 组计算样式全部等于设计色；`---------` 的标记串同时带 `hr-strong` 与 `hr-strong--red`（红色档是蓝色档的细化，不会退化成蓝）。
- passed：`node test/browser/divider-app.mjs` —— 真实 `dist/` 产物里，编辑区三档实测为 `rgba(0,0,0,0.28)` / `rgb(46,134,200)` / `rgb(192,57,43)`，暗色为 `rgba(255,255,255,0.28)` / `rgb(111,181,230)` / `rgb(229,115,95)`；注入高特异性主题 CSS 后三档不变形。
- passed：命令入口实测 `__editorSvc.pagedownEditor.uiManager.doClick('hr')` 后编辑区内容为 `---`。
- 证据截图：`.target/validation/divider-app/app-light.png`、`app-dark.png`。
