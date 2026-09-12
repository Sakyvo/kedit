Status: done

## Parent

批5 UX（grill-with-docs 收敛，无独立 PRD）

## What to build

编辑器工具栏：代码块 / 单反引号顺序 / 删除所选常显禁用。

## Acceptance criteria

- [x] 无选区点代码块 → 生成上下围栏 + 中间空行，光标在空行
- [x] 有选区点代码块 → 选区被 ``` 上下另起一行包裹
- [x] 按钮顺序：插入图片后为代码块，单 ` 在代码块右侧一位
- [x] 删除按钮始终可见；无选区半透明且不可点；有选区可删
- [x] 桌面与移动端工具栏均符合上述

## Blocked by

None - can start immediately

## Implement notes

- `pagedownButtons.js` order: image → codeblock → inlinecode
- `doCodeBlock` / `doInlineCode` / `doDeleteSelection` in pagedown.js
- `codeFence.js` pure helpers; NavigationBar disable deleteSelection when no selection
