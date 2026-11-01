# 矩形选择照搬 Notepad4 语义（自绘选中层）

Alt+拖拽的矩形选择按 **Notepad4 / Scintilla 的矩形选区语义**实现；选中高亮为**全自绘选中层**——逐行半透明矩形叠加在文字上，短行同色补齐成整齐矩形块，观感对齐 **Word 2016 的 Alt 矩形选择**。页面上不允许出现"选框边框"或游离的框形元素。

- **拖拽期实时选区**：Alt 按下即进入，鼠标移动逐行重算并重绘（Scintilla `SetRectangularRange`）。
- **行几何 = 带状扫描**：只用 `Range.getClientRects()` 扫与拖拽矩形纵向相交的文本节点（先按 section 元素 boundingRect 剪枝），O(可见行)；全部重算经 rAF 节流（每帧至多一次）。
- **边界 = 鼠标像素 x**；短行超出部分算选中（虚拟空间），缺失段同色补齐。
- **粘性多行插入 / 双向列删除 / 列粘贴（自贴补空格、外来先清后插）/ 拖出视口自动滚动 / Alt 粘性**：语义见锚卡 054 与任务卡 055–059，变换层（cleditColumnUtils）承载。
- **偏移空间**：选中几何在 DOM 偏移空间计算，编辑前经 **DOM↔模型偏移映射**（动态加载下两空间不等）换算后走整段字符串变换；cledit 单光标架构不变。

## Considered Options

- **v1 自绘边框矩形（无输入语义）**：被否决——"画了一个框"，文字没被选中。
- **v2 Word 式 + CSS Custom Highlight API、v3 API+补齐容器+fallback**：被否决。三次真机事故的根因：
  1. 热路径调用 `selectionMgr.getCoordinates`/`Utils.findContainer`（O(全文) DOM 遍历）且每 mousemove 全量重算 → 大文档整页卡死；
  2. 补齐容器 `.cl-column-gaps` 挂载未给显式零点，浏览器按流内静态位置摆放（整篇内容下方），子块坐标全体错位 → 页面上出现游离的框；
  3. `caretRangeFromPoint` 给的是 DOM 偏移，行段/编辑用模型全文偏移，动态加载分片挂载下两空间错位 → 高亮 Range 指错位置，选中从未可见。
- **编辑器级真多光标**：仍被否决；多行编辑以列模式内整段变换表达。

## Consequences

- 选中层挂滚动容器、显式 `left:0;top:0`、`pointer-events:none`、颜色取主题选中色；不依赖 CSS Custom Highlight API。
- `Utils.findContainer` 禁止出现在 mousemove/scroll 热路径（已沉淀至 frontend-conventions）。
- 短行补空格是真实内容变更（会进文档与同步），照搬 Notepad 的必然代价。
- IME 组成中、非常规按键不进列语义，直接退出交还常规编辑。
