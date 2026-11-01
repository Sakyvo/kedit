Status: review

## Parent

`.docs/tasks/054-notepad-column-selection-anchor.md`

## Depends on

055, 057

## What to build

照搬 Scintilla 的列删除与列粘贴语义。

**列删除**
1. 有列选区时 `Backspace`/`Delete` → 删除各行列段（单次可撤销），选区退出。
2. 零宽列光标态 `Backspace` → 删除**各光标左侧一字符**（行首不动）；`Delete` → 删除**右侧一字符**（行尾/换行前不动）。仍是单次可撤销，且列光标保持。

**列粘贴**
3. **自己的列复制**（Ctrl+C / Ctrl+X 产生的列文本）：粘贴时逐行贴入，短行按 `padToColumn` 补空格对齐；行数与列段数一致时逐行各异，否则整段逐行同插。
4. **外来文本**（非列复制来源）：先清空矩形内各行的真实字符，再在左上角整段插入（Scintilla `ClearSelection` + `PasteShape::stream` 语义），随后退出列模式。
5. 判定「是否列复制来源」用模块内标记 + 剪贴板文本一致性校验（普通复制会覆盖剪贴板，需能失效降级为外来文本）。

## 验收

- 后台：`vite build` 通过；断言覆盖双向零宽删除、逐行粘贴、补空格数。
- 真机：列选中删各行列段一次撤销；零宽态 Backspace/Delete 逐行各删一字符；列复制后回贴列位对齐且短行补空格；从外部复制的普通文本粘贴时矩形先被清空再整段插入。

## Definition of done

删除与粘贴四条语义全部符合 Notepad4。

## 后台验证记录

- 列删除：有选区时各行列段一次性删除并退出（`applyColumnDeletion` + `deletionCaretOffset`，单 undo）；零宽列光标时 `applyPerCaretDeletion` 双向逐光标删一字符（行首/行尾/换行前不动），列光标保持，backward 后列 x 左移一字符。
- 列粘贴判定：模块级 `lastColumnCopyText` 记录自己列复制出去的文本，粘贴时与剪贴板文本**逐字比对**；普通复制会覆盖剪贴板 → 比对失败自动降级为外来文本（对应 Scintilla cfColumnSelect 失效语义）。
- 列粘贴：逐行按 `padToColumn` 补空格后贴入（行数=行段数逐行各异，否则整段逐行同插）；零宽光标走 `applyRowInsertions`，选区走 `applyColumnPerRowInsertion`。
- 外来文本：`applyColumnPerRowInsertion(content, segments, [text])` = 先清空各行列段再左上角整段插入；零宽光标 `applyRowInsertions([{at: topLeft, text}])`。
- 零宽光标下 Ctrl+C/X 不覆盖剪贴板（无可选内容），避免污染 `lastColumnCopyText`。
- 断言：col58 组合语义 7 项（补齐+逐行替换、短行补 1 空格、外来文本先清后插、双向零宽删除）全绿。
- 静态检查：esbuild parse OK；工具函数「used-but-not-imported: none」；修复了 `applyPerCaretDeletion` 漏导入（parse 不报、Rollup 当全局变量的坑）。
- build：EXIT=0，bundle 内含 `cl-column` 与 `fromCharCode(10)` 标记。
- 真机验收（skipped-manual）：列选中删一次撤销；零宽态双向删；列复制回贴对齐且短行补空格；外部普通文本粘贴先清空再整段插入。
