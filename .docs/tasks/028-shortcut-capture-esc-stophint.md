Status: done

# 028 捕获期间 stopPropagation + ESC 可绑 + 出生效提示

## Parent

`.docs/tasks/025-settings-visual-fixes.md`

## What to build

- pill 处理捕获入口的 keydown 一律 `stopPropagation()`：修复 ESC 淂发 模态
  `@keydown.esc.stop` 把窗关了。
- ESC 本身可绑为快捷键：无修饰时 combo = `'esc'`；有修饰键+Esc（如 Ctrl+Esc）
  视作取消捕获（不绑定、不关窗）。
- Backspace/Delete 清空保持现状；blur 后捕获态退出。
- 顶栏按钮节底部加一行小字提示：「快捷键修改在点击『确认』后生效」。
- `shortcutCapture.comboFromEvent`：支持 `'esc'`，无修饰键的纯普通键（f1–f12、
  delete、space 等）可绑；保留 mod/alt/shift 前缀逻辑。
- 展示侧格式化 `esc` → `Esc`、`delete` → `Del`、`space` → `Space`。

## Acceptance criteria

- [x] 捕获中按 Esc：模态不关；绑保存的 combo = `esc`，pill 显示 `Esc`（实测）。
- [x] 捕获中按 Backspace：清空；focus out（实测 pill 变 NONE）。
- [x] 捕获中任意按键不再毒发模外事件（stopPropagation；Esc 事件不再触及 Modal）。
- [x] 提示行可见（「快捷键修改在点击『确认』后生效。」实测）。
- [x] Node 断言 `comboFromEvent`/`displayCombo` 新型键路径 14 条全绿；`npm run build` 通过。

## Blocked by

- `026-vslot-field-fix-defaults-hint.md`
