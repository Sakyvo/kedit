Status: open

## Parent

[预览长串折行与分割线三档](099-divider-tiers-preview-wrap.md)

## What to build

预览里再也看不到横向溢出的长串：一段没有软换行机会的文本（API 密钥、URL、长英文单词）在预览与导出 HTML 里按容器宽度折行，与编辑区行为一致。折行点落在字符之间，源文本一个字符都不变（渲染层分歧，ADR 0004）。

代码块继续保持既有的横向滚动，不被这条规则牵连。

## Acceptance criteria

- [ ] 预览中一行 `sk-9772d4ca9970e5b5d4f110c8f42b7a3040598cccdf7d10030e1926647aad0bee` 按栏宽折行，无横向滚动、无右侧裁切。
- [ ] 普通段落里的无空格长串（无 `code` 包裹）同样折行；含 CJK 的混排段落断行位置与改前一致，不出现单词中间被切的情况。
- [ ] 围栏代码块、缩进代码块仍为 `white-space: pre` + 横向滚动，长行不折行。
- [ ] 表格仍走 `.table-wrapper` 的横向滚动，不因断词规则变形。
- [ ] 导出 HTML（含主题模板与 PDF 模板各一份）打开后长串同样折行；自包含复制粘贴到第三方 Markdown 渲染器时源文本未变。
- [ ] `npm run build` 通过；真机（桌面 + 窄屏移动）各截一张折行前后对比图作为证据。

## Blocked by

None - can start immediately
