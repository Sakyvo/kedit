Status: review

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

## 后台验证记录

- 断言回归全 PASS：colutil 13 + col55 18 + col57 5 + col58 5 + col59 6 + col61 10 = 57 项。
- 编辑语义（浏览器实测）：列复制 → `" i -g @cometix/cla
 i -g @openai/cod
t"`（各行段按行拼接，短行取到行尾），与 Notepad4 语义一致。
- 粘性列光标 / 双向零宽删除 / 列粘贴 / 自动滚动 / 偏移不变量：代码路径保持 055–063 实现不变，仅在 v5 绘制层之上运行；索引增加缓存（内容变更时失效），避免每帧全量 TreeWalker。
- 静态核查：热路径 `getCoordinates|findContainer` 代码调用 0；`.cl-column-block|layer` 0；`vite build` APP=0 / STYLE=0 + copyfiles 成功。
- 浏览器实测确认：无整块矩形、无游离框、空白区零响应、松手保持、Esc 退出清空。

## 真机确认（本次已在浏览器实测）

- 三行矩形连打/列复制/退出均按预期；大文档性能改善来自带状扫描 + 索引缓存 + rAF 节流。
