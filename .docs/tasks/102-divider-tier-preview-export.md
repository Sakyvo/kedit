Status: done

## Parent

[预览长串折行与分割线三档](099-divider-tiers-preview-wrap.md)

## What to build

预览与导出 HTML 里画出的分割线跟着档位走，并且与编辑区同色同粗：原色 1px、蓝 2px、红 2px。预览与导出容器内 `hr` 的整条线（边框、背景、高度、内边距、外边距）由 KEDIT 独占，预览主题改不动它（ADR 0017）。

## Acceptance criteria

- [x] 预览中 `---` 为 1px 原色线，`------` 为 2px 蓝线，`---------` 为 2px 红线；`#333` 不再出现在任何一档。
- [x] 深色主题下三档换成配色表的深色值（蓝 `#6fb5e6` / 红 `#e5735f`），白底与深底都读得清。
- [x] 逐个切换全部 7 个内置预览主题，三档的颜色、粗细、高度、内边距、外边距均不变形——包括 `allblue`、`caoyuangreen`、`ningyezi` 这类原本写 `height: 1px; padding: 0; border: none` 的。
- [x] 高特异性但不带 `!important` 的自定义主题 CSS 也改不动三档。
- [x] 导出侧同样成立：样式来自 `style.css`，`.stackedit__html` 作用域覆盖带主题/PDF 模板，主题 CSS 已不再有 `hr` 规则可夺回。
- [x] App 自身界面分割线（菜单、侧栏、关于弹窗的 `hr`）不受防火墙影响——选择器限定在预览与导出容器内。
- [x] `npm run build` 通过；给出三档 × 亮/暗 × 多主题的证据。

> 事实修正：`!important` 只能压住「不带 `!important`」的主题规则（这也覆盖全部 22 个内置主题）。用户若刻意写 `!important` 且特异性更高，纯 CSS 无法阻止——该边界已写入 ADR 0017 的 Boundary 段，不再假装能拦住。

## Evidence

- passed：`test/node/dividerStyles.test.js` —— `.cl-preview-section hr` / `.stackedit__html hr` 的 `border-top : 1px solid rgba(128,128,128,0.33)`、`margin: 2em 0`、`padding: 0`、`background: none`、`height: 0` 全部 `!important`；蓝/红档与 `.app--dark` 变体的 `border-top` / `border-top-color` 为指定色；并且全局裸 `hr` 规则**不带** `!important`（App 自身界面分隔线不受影响）。
- passed：`node test/browser/divider-tiers.mjs` —— 3 档 × 7 个内置预览主题 × 亮/暗：颜色、粗细、`solid`、`padding: 0`、`margin: 32px`、`height: 0px`、`background` 透明、实际绘制高度 1px/2px 全部符合；注入高特异性无 `!important` 的主题 CSS 后仍不变形。
- passed：`node test/browser/divider-app.mjs` —— 真实 `dist/` 里预览三档实测 `rgb(128,128,128)` 1px / `rgb(46,134,200)` 2px / `rgb(192,57,43)` 2px，暗色 `rgb(111,181,230)` / `rgb(229,115,95)`；`document.body` 上新建的裸 `<hr>` 仍是 1px `rgba(128,128,128,0.33)`（界面分隔线未被波及）。
- passed：`npm run build` 通过，`dist/style.css` 中可见 `.cl-preview-section hr{...!important}`、`.cl-preview-section hr.kedit-hr-strong{border-top:2px solid #2e86c8!important}`、`--red` 与两组 `.app--dark` 覆盖。
- 证据截图：`.target/validation/divider-app/app-light.png`、`app-dark.png`。
