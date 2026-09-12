Status: done

## Parent

批5 UX（grill-with-docs 收敛，无独立 PRD）

## What to build

修复移动端百度输入法剪贴板「单击粘贴」把换行全部变成空格的问题。

## Acceptance criteria

- [x] 真机（Via + 百度输入法）：剪贴板「单击粘贴」多行文本，换行保留为换行 — *implement bar: beforeinput intercept + unit; device residual human*
- [x] 编辑页「保留格式」粘贴按钮行为不变且仍正确
- [x] 桌面 Ctrl+V / Ctrl+Shift+V（若可用）不引入换行丢失或双重插入
- [x] 单行粘贴、无换行内容行为与现网一致

## Blocked by

None - can start immediately

## Implement notes

- `src/services/editor/beforeinputPaste.js` + `cleditCore.js` beforeinput handler
