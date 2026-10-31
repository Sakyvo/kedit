Status: open

## Parent

`.docs/tasks/054-notepad-column-selection-anchor.md`

## What to build

在 `src/services/editor/cledit/cleditColumnUtils.js` 里补齐全套纯变换（零依赖、可 Node 直测），供 DOM 层调用。语义照搬 Scintilla：

1. `applyColumnInsertion(content, segments, text)`：有列选区时，各行列段替换为 `text`（已有）。
2. `applyColumnPerRowInsertion(content, segments, lines)`：多行粘贴逐行各异（已有，语义改为仅列复制回贴时使用）。
3. `applyPerCaretInsertion(content, carets, text)`：**零宽列光标**（粘性模式）在各光标位置插入 `text`。
4. `applyPerCaretDeletion(content, carets, direction)`：`direction='backward'` 删各光标左侧一字符（行首则不动）、`'forward'` 删右侧一字符（行尾/换行前则不动）。
5. `padToColumn`：给定「行尾偏移 + 目标像素 x + 空格宽度」，算出需补的空格数（返回整数，非负）；纯函数、不碰 DOM。
6. `perRowSegmentsFromRect`：把「矩形左/右像素 + 各行行尾像素 + 各行内容区间」换算成行段，含**虚拟空间**（行尾短于左边界时该行段为虚拟段，`virtual: true`），供渲染补齐与编辑共用。

## 验收

- 独立 Node 断言脚本（手算基准）：零宽插入、双向删除、空格补齐数、虚拟段标记、乱序/越界/重叠归一化；红→绿。
- 既有 13 项断言不得回归。
- `npx vite build --mode production` 通过。

## Definition of done

变换层函数齐备且被断言覆盖；不引入任何 DOM 依赖。
