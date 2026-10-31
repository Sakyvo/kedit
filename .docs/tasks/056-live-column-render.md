Status: open

## Parent

`.docs/tasks/054-notepad-column-selection-anchor.md`

## What to build

修掉「只画框、文字没被选中」的根因（`src/services/editor/cledit/cleditColumnSelection.js`）：

1. **拖拽期实时重算**：`mousemove` 内直接 `computeSegments(rect)` 并把结果画成高亮（CSS Custom Highlight `cl-column`），不再等 mouseup；自绘边框 div 仅作为**不支持的降级**保留，正常路径不再出现。
2. **边界改为鼠标像素 x**：左右边界取 `min/max(mouseX)`，逐行独立换算；删除 `rowEndWithTop` 的"行尾截断"语义（改为虚拟空间）。
3. **虚拟空间补齐**：短行行尾到矩形右边界之间用同色实心矩形补齐（逐行 gap div，`pointer-events: none`），使整块观感与 Notepad4 一致；补齐段与 `::highlight(cl-column)` 同色同透明度。
4. 拖拽方向（左上/右下/反向）对称；无效矩形（宽或高为 0）不显示任何东西。

## 验收

- 后台：`vite build` 通过；静态确认 `mousemove` 路径调用高亮重绘、无 mouseup 才绘制的旧路径残留；补齐 div 只在短行出现。
- 真机：按住 Alt 拖拽，拖动过程中就能看到文字被逐行选中成整齐矩形块（短行不留缺口），松开后保持。

## Definition of done

拖拽期可见真实选中块；无空框观感；短行虚拟空间补齐。
