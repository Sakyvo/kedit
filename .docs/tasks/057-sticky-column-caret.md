Status: review

## Parent

`.docs/tasks/054-notepad-column-selection-anchor.md`

## Depends on

055, 056

## What to build

照搬 Scintilla `ThinRectangularRange`：首键之后列模式**不退出**，而是进入零宽列光标态。

1. 首键（可打印字符、无修饰、非 IME 组成中）：各行列段替换为该字符 → 随后把列选区收成**零宽列光标**（每行一个光标，位于插入文本之后）。
2. 零宽列光标态下继续打字：`applyPerCaretInsertion` 在每行光标处插入 → 继续逐行同步增长。
3. 连续按键使用 `undoMgr.setCurrentMode('typing')`，使整串输入合并为**单个 undo 单元**。
4. 退出条件：Esc、单击、方向键 / Home / End / PageUp / PageDown / Enter、外部内容变更（`contentChanged`）、编辑器 destroy。
5. 退出后光标落在首行同列位置，恢复常规单光标编辑；高亮与补齐矩形全清。
6. 短行在首键时按 `padToColumn` **补空格**到目标列再插入（照搬 `RealizeVirtualSpace`）。

## 验收

- 后台：`vite build` 通过；断言覆盖零宽插入链路；静态确认列模式不会在首键后退出（`exit()` 不被键盘主路径调用）。
- 真机：选中 3 行矩形 → 连打 `abc` → 三行同列都出现 `abc`；单次 Ctrl+Z 一次撤销整串；Esc 后恢复普通光标；短行自动补空格且列位对齐。

## Definition of done

粘性逐行输入可用、undo 合并正确、退出条件完整。

## 后台验证记录

- 变换层新增 `applyRowInsertions`（逐行带前置补齐空格插入，倒序施加）；断言 5 项（含乱序、空 ops、空文本、补齐）红→绿。
- 零宽列光标：`computeRows` 在 `rect.width < 1` 时 `endOff = startOff`（ThinRectangularRange），高亮自然消失。
- 首键：各行列段替换为该字符 → `rect` 宽度归零、列 x 取「首行插入后半字符处」的像素；后续按键走 `rowInsertOps`（短行按 `padToColumn` 补空格到该列）+ `applyRowInsertions`，列 x 随输入右移。
- undo：统一 `undoMgr.setCurrentMode('typing')`，连续按键合并为单个 undo 单元。
- 自编辑保护：`selfEditing` 计数器 + 微任务后兜底清零，避免自己的 `setContent` 触发「外部内容变更 → 退出」误判。
- 退出条件：Esc / 单击 / 方向键·Home·End·PgUp·PgDn·Enter（落到 onKeyDown 末尾 exit）/ 外部 contentChanged / destroy。
- 空格宽：canvas `measureText(' ')` 取当前编辑器字体，不碰 DOM；异常兜底 `fontSize * 0.5`。
- build：`NODE_OPTIONS=--max-old-space-size=4096 … vite build` EXIT=0；既有 13+13 断言无回归。
- 真机验收（skipped-manual）：3 行矩形连打 `abc` → 三行同列出现 `abc`；单次 Ctrl+Z 撤销整串；Esc 恢复普通光标；短行自动补空格对齐。
