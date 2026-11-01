Status: review

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

## 后台验证记录

- 偏移方案：统一 DOM 偏移空间 + 全量挂载不变量 —— buildOffsetIndex 一次 TreeWalker 建 node→base 映射，total !== content.length（分片构建瞬态）时 rows/segments 置空、endDrag 静默退出，绝不产生错位编辑。稳态 DOM 文本 ≡ 模型文本（dynamicLoading 为分片构建而非持久虚拟挂载，已核实）。
- 行内偏移：caretRangeFromPoint 阶梯探测（x、x-2、x-8）+ 命中 caret top 必须落行内（防跨行吸附）；行尾探测 rightV-0.5。
- 编辑语义全部恢复在新几何上：粘性列光标（首键替换→零宽列、连续打字 rowInsertOps+padToColumn 补空格、列 x 经 xOfModelOffset 二分推进）、双向零宽删除（backward 列左移）、列复制/剪切（lastColumnCopyText 比对）、列粘贴（自贴补空格逐行/外来先清后插）、自动滚动（autoScrollDelta + rAF、边界停帧、全路径清理）、Alt 粘性（仅 mousedown 判定）、selfEditing 防误退、columnSelectionLocked 保持。
- 静态回归核查：监听成对解绑（mousemove/mouseup/keydown/copy/cut/mousedown/paste/scroll + 两个 rAF）；exit 清全部状态与 DOM；编辑路径无 findContainer/getCoordinates。
- 回归：6 组断言（colutil/55/57/58/59/61）全 PASS；build APP=0 STYLE=0。
- 真机人工验收清单：拖拽→连打 abc 三行同现、单 Ctrl+Z 整串回滚、零宽 Backspace/Delete、列复制回贴对齐补空格、外来粘贴先清后插、拖出视口扩选、Esc/单击退出、大文档不卡。
