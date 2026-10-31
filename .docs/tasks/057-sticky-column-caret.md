Status: open

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
