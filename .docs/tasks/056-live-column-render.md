Status: review

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

## 后台验证记录

- 根因修复：`onMouseMove` 直接 `render()`（逐行重算 + 立即重绘），mouseup 只做激活，不再是唯一绘制点。
- 边界改为鼠标像素 x：`computeRows` 逐视觉行算 `lineStart/lineEnd/lineEndX`，右侧不再走"行尾截断"，超出行尾交给虚拟空间。
- 虚拟空间补齐：`perRowSegmentsFromRect` 产出 `gapFromX/gapToX`，短行用 `.cl-column-gap` 同色块补齐（`::highlight` 同 rgba），拖拽期即生效。
- 挂载位置修正：补齐块挂 `editor.$scrollElt`（`.editor`），因 cledit 高亮器会删除 contentElt 下所有非 section 子节点（cleditHighlighter.js:322-326）。
- 降级：无 Highlight API 时整块 `.cl-column-selection`（同色无边框，不再是空框观感）。
- build：`NODE_OPTIONS=--max-old-space-size=4096 node node_modules/vite/bin/vite.js build --mode production` EXIT=0（built in 55.15s）。
- 静态证据：`render()` 在 mousemove 与 endDrag 两处调用；`cl-column-selection-host` 已无残留（0 命中）；gap 只在 `gapFromX != null` 时创建；gap 容器挂在 scrollElt。
- 真机验收（skipped-manual）：按住 Alt 拖拽过程中即见逐行选中；短行不留缺口；深浅主题可见。
