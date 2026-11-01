Status: anchor

# 060 矩形选择 v4 锚卡（自绘选中层，Word 2016 观感）

## Problem

批 054–059 交付的矩形选择连续三次真机验收失败：拖拽只画出一个游离的框、文字从未被选中、出现瞬间整页长时间卡死。验尸确认三个根因（ADR 0014「Considered Options」）：

1. **卡死**：`selectionMgr.getCoordinates`/`Utils.findContainer` 为 O(全文) DOM 遍历，拖拽路径每行调用 10+ 次且每 mousemove 全量重算；
2. **游离框**：补齐容器 `.cl-column-gaps` 挂载无显式零点，浏览器按流内静态位置摆放（整篇内容下方），子块坐标全体错位；
3. **选中不可见**：`caretRangeFromPoint` 给 DOM 偏移，行段/编辑用模型偏移，动态加载分片挂载下两空间错位，高亮 Range 全部指错位置。

Author 拍板（grill 收敛）：视觉对齐 **Word 2016 Alt 矩形选择**——页面上只允许实心选中块，框形元素彻底移除；高亮通道**全自绘**（弃 CSS Custom Highlight API）；验证方式维持 build + 人工验收（不做浏览器实测门槛）。

## Decisions

1. **自绘选中层**：单一 overlay 容器挂滚动容器、显式 `left:0;top:0`、`pointer-events:none`、取主题选中色；逐行半透明块叠在文字上 + 短行同色补齐 = 整齐矩形。`.cl-column-selection`（边框/整块 fallback）、`::highlight(cl-column)` 样式、CSS Highlight API 调用路径**全部删除**。
2. **带状扫描行几何**：`Range.getClientRects()` 只扫与拖拽矩形纵向相交的文本节点（先按 section 元素 boundingRect 剪枝）；行内 x 边界用节点内二分（Rect 测量）。O(可见行)。
3. **rAF 节流**：mousemove/autoscroll 只更新锚点并请求帧，每帧至多一次全量重算；`findContainer`/`getCoordinates` 不得出现在热路径（spec: Editor Hot-Path Geometry）。
4. **偏移空间**：选中几何全在 DOM 偏移空间；编辑前经 DOM↔模型偏移映射（editorSvc 已有映射）换算，再走既有整段变换（cleditColumnUtils 47 项断言不动）。
5. **语义保持**：粘性列光标逐行插入、双向列删除、列粘贴（自贴补空格/外来先清后插）、拖出视口自动滚动、Alt 粘性——批 055–059 定义的语义全部保留，只换几何与绘制引擎。
6. 自动滚动步进继续用 `autoScrollDelta`（已测）；滚动中每帧重算走同一 rAF 入口。

## Out of scope

- CSS Custom Highlight API（不再使用）；编辑器级多光标；触屏。
- 变换层（cleditColumnUtils.js）行为不变。

## Testing strategy

- 唯一 CI 门槛 `vite build`（`NODE_OPTIONS=--max-old-space-size=4096 node node_modules/vite/bin/vite.js build --mode production`；style 子链同前）。
- 变换层 47 项断言零回归。
- DOM 层无 GUI 接缝：静态验证（热路径无 findContainer/getCoordinates、overlay 显式零点、无 ::highlight/边框残留）+ 真机人工验收清单（拖拽实时选中块、大文档不卡、编辑语义抽查）。

## Vertical slices

| # | 任务 | 依赖 |
|---|---|---|
| 061 | 带状扫描行几何引擎（Range.getClientRects + section 剪枝 + rAF 节流），替换 computeRows/getCoordinates 依赖 | — |
| 062 | 统一自绘选中层：单容器显式零点、逐行块+短行补齐、删尽 Highlight API/fallback 框/::highlight 样式 | 061 |
| 063 | DOM↔模型偏移映射接线：编辑语义（粘性列光标/删除/粘贴/自动滚动/Alt 粘性）在新几何上恢复 + 静态回归核查 | 061, 062 |
