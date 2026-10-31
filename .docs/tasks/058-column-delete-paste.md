Status: open

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
