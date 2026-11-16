Status: done

## Parent

[预览长串折行与分割线三档](099-divider-tiers-preview-wrap.md)

## What to build

预览里再也看不到横向溢出的长串：一段没有软换行机会的文本（API 密钥、URL、长英文单词）在预览与导出 HTML 里按容器宽度折行，与编辑区行为一致。折行点落在字符之间，源文本一个字符都不变（渲染层分歧，ADR 0004）。

代码块继续保持既有的横向滚动，不被这条规则牵连。

## Acceptance criteria

- [x] 预览中一行 `sk-9772…0bee` 按栏宽折行，无横向滚动、无右侧裁切。
- [x] 普通段落里的无空格长串（无 `code` 包裹）同样折行；含 CJK 的混排段落仍正常折行，不出现割裂。
- [x] 围栏代码块、缩进代码块仍为 `white-space: pre` + 横向滚动，长行不折行。
- [x] 宽表格不把预览栏撑出横向滚动；`.table-wrapper` 保持 `overflow: auto`，单元格自身折行。
- [x] 导出 HTML 容器（`.stackedit__html`，即带主题/PDF 模板的外层）同样带断词规则；源文本未改（纯 CSS 改动）。
- [x] `npm run build` 通过；真机（headless Chrome，360px 视口）给出折行前后的对比证据。

## Evidence

- passed：`npm run test:node` —— `test/node/previewWrap.test.js` 断言编译后的 `base.scss` 里 `.cl-preview-section` 与 `.stackedit__html` 都带 `overflow-wrap: anywhere`，且 `pre > code` 仍是 `white-space: pre`（代码块契约未被牵连）。
- passed：`node test/browser/preview-wrap.mjs`（headless Chrome，360×720）——
  - 行内 `code` 长串：`codeOverflow=false`、`codeLineBoxes=5`、容器 `scrollWidth=clientWidth`；
  - 同一 fixture 去掉规则后 `containerOverflow=true`（原报障复现，红/绿对照在同一次浏览器会话内完成）；
  - 裸长串段落 `paragraphLineBoxes>1` 且不溢出；
  - 围栏代码块 `codeBlockWhiteSpace=pre`、`codeBlockOverflow=true`、只有一条文本行；
  - 宽表格：单元格折行、容器不溢出、`.table-wrapper` 的 `overflow-x` 仍为 `auto`；
  - CJK 段落正常折行不溢出；
  - 导出容器 `.stackedit__html` 的计算样式 `overflow-wrap=anywhere`。
- 证据截图：`.target/validation/preview-wrap/{inline-code-wrapped,inline-code-overflowing,code-block-unwrapped,cjk-wrapped}.png`（工作证据，批次收尾时删除）。
- 说明：`npm run build` 通过，`dist/style.css` 中可见 `overflow-wrap:anywhere`。
