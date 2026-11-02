Status: open

## Parent

`.docs/tasks/064-column-v5-anchor.md`

## Depends on

065, 066

## What to build

在 v5 绘制与起手判定之上，回归并验证批 055–063 的编辑语义：

1. **粘性列光标**：首键替换各行列段 → 零宽列光标（`rect.width = 0`），连续打字逐行插入；短行按 `padToColumn` 补空格；`setCurrentMode('typing')` 单 undo；`selfEditing` 防误退。列 x 推进用 `xOfModelOffset`。
2. **删除**：有选区时 Backspace/Delete 删各行列段（单 undo 退出）；零宽态双向逐光标删一字符（列保持）。
3. **复制/粘贴**：`lastColumnCopyText` 与剪贴板比对；自贴逐行补空格、行数匹配逐行各异；外来文本先清矩形内真实字符再左上角整段插入；零宽态 Ctrl+C/X 不污染剪贴板。
4. **自动滚动**：`autoScrollDelta` + rAF，边界停帧，`endDrag`/`exit`/`destroy` 全路径清理。
5. **偏移不变量**：DOM 偏移索引 total ≠ 模型长度（分片构建瞬态）时 rows 置空并静默退出，绝不错位编辑。

## 验收

- 断言回归：colutil / 55 / 57 / 58 / 59 / 61 共 56 项全 PASS。
- `vite build` + style 子链 EXIT=0；bundle 含 `cl-column`、`getClientRects`、`caretRangeFromPoint`，无 `cl-column-block`/`cl-column-layer` 类名残留。
- 静态核查：热路径无 `getCoordinates`/`findContainer`；监听成对解绑；`exit` 清全部状态。
- 真机人工验收清单：三行矩形连打 `abc` 三行同现 + 单 Ctrl+Z 回滚；零宽双向删；列复制回贴对齐补空格；外来粘贴先清后插；拖出视口扩选；Esc/单击退出；大文档不卡。

## Definition of done

v5 绘制下编辑语义完整，且无任何性能或偏移回归。
