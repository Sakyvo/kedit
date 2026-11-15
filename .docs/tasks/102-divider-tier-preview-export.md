Status: open

## Parent

[预览长串折行与分割线三档](099-divider-tiers-preview-wrap.md)

## What to build

预览与导出 HTML 里画出的分割线跟着档位走，并且与编辑区同色同粗：原色 1px、蓝 2px、红 2px。预览与导出容器内 `hr` 的整条线（边框、背景、高度、内边距、外边距）由 KEDIT 独占，预览主题与用户自定义主题一律改不动它（ADR 0017）。

## Acceptance criteria

- [ ] 预览中 `---` 为 1px 原色线，`------` 为 2px 蓝线，`---------` 为 2px 红线；`#333` 不再出现在任何一档。
- [ ] 深色主题下三档换成配色表的深色值（蓝 `#6fb5e6` / 红 `#e5735f`），在白底与深底上都读得清。
- [ ] 逐个切换全部 8 个内置预览主题，三档的颜色、粗细、高度、内边距、外边距均不变形——特别是 `allblue`、`caoyuangreen`、`ningyezi` 这三个在主题里写了 `height: 1px; padding: 0; border: none` 的。
- [ ] 手写一段最强特异性的自定义主题 CSS（含 `!important`）后三档仍不变形。
- [ ] 导出的带主题 HTML 与 PDF 模板 HTML 打开后三档与预览一致；导出样式来自 `style.css` 而非内联覆盖，主题 CSS 不得重新夺回 `hr`。
- [ ] App 自身的界面分割线（菜单、侧栏、关于弹窗里的 `hr`）不受防火墙影响，保持原样——防火墙的选择器限定在预览与导出容器内。
- [ ] `npm run build` 通过；给出三档 × 亮/暗 × 至少两个主题的截图证据，以及一份导出 HTML 的实机打开截图。

## Blocked by

- `101-divider-tier-editor.md`
