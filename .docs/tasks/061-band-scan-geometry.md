Status: open

## Parent

`.docs/tasks/060-column-v4-anchor.md`

## What to build

在 `cleditColumnSelection.js`（或抽出的 `cleditColumnGeometry.js`）实现新行几何引擎，替换现有 `computeRows`/`xOfOffset`/`rowEndWithTop`/`offsetFromPoint` 组合：

1. **section 剪枝**：遍历 `contentElt` 的 section 元素（`.cl-section-*` / 直接子元素），只处理 boundingRect 与拖拽矩形纵向带 [top, bottom] 相交的 section；得到候选节点集。
2. **带状扫描**：对候选 section 内的文本节点，用 `Range(node)` + `getClientRects()` 取其视觉行片段；与纵向带相交的每个 rect 即一行的几何（top/height/节点内起止）。
3. **行内 x→偏移二分**：给定行 rect 与目标 x，在节点子串上二分（每次用 Range(node, mid, mid+1).getBoundingClientRect() 测 x），得到 DOM 偏移；左右边界各一次。
4. **行数据**：每行产出 `{ domStart, domEnd, rowEndDom, lineEndX, top, height, textNode }`（DOM 偏移空间；lineEndX = 行尾像素，供补齐/补空格）。
5. **rAF 节流**：`requestRender()` 只置脏并排队，帧回调里一次重算+绘制；mousemove/autoscroll/scroll 全走该入口。**热路径零 `findContainer`/`getCoordinates` 调用**。
6. 换行（wrapped line）语义：一个逻辑行可拆多个视觉行，扫描天然按视觉行处理（与 Notepad 一致）。

## 验收

- 静态：`grep -n "getCoordinates\|findContainer" cleditColumnSelection.js` 在拖拽/滚动路径 0 命中（初始化等冷路径除外）。
- 几何单元可 Node 直测的部分（纯函数：二分比较器、带相交判断）补断言。
- `vite build` 通过；变换层 47 项断言零回归。
- 真机：2MB 级文档拖拽全程流畅（人工验收）。

## Definition of done

行几何输出与旧接口同形状（rows），供选中层与编辑语义消费；性能量级 O(可见行)。
