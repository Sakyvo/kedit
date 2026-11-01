Status: open

## Parent

`.docs/tasks/060-column-v4-anchor.md`

## Depends on

061, 062

## What to build

把批 055–059 的编辑语义接到新几何引擎上，并接通偏移映射：

1. **DOM↔模型偏移映射**：定位 editorSvc 既有的映射函数（`editorSvc.js:940` 一带 `getContent().slice(offsets[lo], ...)` 的所属函数；必要时经 `editor.options` 或 `clEditor` 暴露给 cledit 模块）。所有编辑（粘性列光标插入、双向列删除、列粘贴、补空格）先把行段/光标 DOM 偏移映射为模型偏移，再调 cleditColumnUtils 变换 + `setContent`；反向（编辑后新光标列定位）用模型→DOM。
2. **粘性列光标**：首键替换各行列段→零宽列光标；连续打字逐行插入（短行 `padToColumn` 补空格）；`setCurrentMode('typing')` 单 undo；`selfEditing` 防误退。列 x 推进改为用 061 行几何（不再 `getCoordinates`）。
3. **双向列删除 / 列复制剪切 / 列粘贴（自贴 vs 外来）**：语义照旧（`lastColumnCopyText` 比对、`applyPerCaretDeletion`、`applyRowInsertions`/`applyColumnPerRowInsertion`），偏移全部经映射。
4. **自动滚动**：rAF 帧内 `autoScrollDelta` 步进 + 重算重绘与 061 同入口；到内容边界停帧；`endDrag`/`exit`/`destroy` 清理。Alt 粘性保持（仅 mousedown 判定）。
5. **静态回归核查清单**：热路径无 `findContainer`/`getCoordinates`；事件监听成对解绑；`exit` 清空所有状态与 DOM。

## 验收

- 变换层 47 项断言零回归；`vite build` 通过。
- 静态：编辑路径所有偏移经映射函数（grep 映射调用点）；核查清单全过。
- 真机人工验收清单（拖拽→连打 abc 三行同现、单 Ctrl+Z 整串回滚、零宽 Backspace/Delete、列复制回贴对齐补空格、外来粘贴先清后插、拖出视口扩选、Esc/单击退出）。

## Definition of done

Notepad4 全套编辑语义在新引擎上恢复，动态加载大文档下选中与编辑都发生在正确位置。
