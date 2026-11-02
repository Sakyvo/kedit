Status: open

## Parent

`.docs/tasks/064-column-v5-anchor.md`

## What to build

把绘制从 v4 的整块自绘矩形，换成「原生选区观感 + 行内补齐」：

1. **删除整块**：移除 `.cl-column-block` 与 `.cl-column-layer` 的创建/样式/引用；页面上不再存在按鼠标矩形宽高绘制的整块元素。
2. **真实文字高亮**：`CSS.highlights.set('cl-column', new Highlight(...ranges))`，ranges 由 061 带状扫描得到的行段（DOM 偏移）构造，逐视觉行一个 Range；只覆盖真实文本节点。
3. **色彩单一来源**：base.scss 新增 `:root { --selection-bg; --selection-fg }` 与深色主题覆盖；新增
   `::selection { background: var(--selection-bg); color: var(--selection-fg); }` 与
   `::highlight(cl-column) { background-color: var(--selection-bg); color: var(--selection-fg); }`。
   任何地方不得再出现硬编码的选中色（含补齐小块）。
4. **行内补齐小块**：仅当行尾 < 矩形右边界时，为该行创建 `行高 × (右边界 - 行尾)` 的小块，`background: var(--selection-bg)`；小块容器挂滚动容器、显式 `left:0;top:0`、`pointer-events:none`；行尾不晚于右边界则不创建。
5. **无文字不画**：空行、文末空白不产生 Range 与小块；整帧无任何相交文字行时清除全部高亮与小块。
6. 深浅主题各一套变量值，保证 `::selection` 与列选区在该主题下同色。

## 验收

- 静态：`grep -rn "cl-column-block\|cl-column-layer" src/` 0 命中；`grep -rn "rgba(12, 147, 228" src/styles src/components src/services` 0 命中；`:root`/`.app--dark` 各一套 `--selection-bg/--selection-fg`；`::selection` 与 `::highlight(cl-column)` 均引用变量。
- `vite build` + style 子链通过；dist/style.css 含 `::highlight(cl-column)` 且引用变量、无硬编码色。
- 真机：拖拽中文字呈深蓝底白字，与普通选区（p2）完全一致；短行行尾到右边界有同色延续块；文末空白/空行无任何东西。

## Definition of done

页面唯一可见物 = 与原生选区同色的文字高亮 + 短行行内延续块，无整块矩形。
