Status: review

## Parent

`.docs/tasks/064-column-v5-anchor.md`

## Depends on

065

## What to build

把交互对齐「普通拖拽选择」并把无文字区域的响应降为零：

1. **起手准入**：`onAltMouseDown` 内做双重判定——
   a. `document.caretRangeFromPoint(x, y)` 命中且 `contentElt.contains(range.startContainer)`；
   b. 该 y 与**有文字的视觉行 rect** 纵向相交（用 061 的带状扫描，band = [y, y+1]，结果非空）。
   两条任一不满足 → **立即 return**：不 `preventDefault`、不 `stopPropagation`、不注册任何监听、不建任何 DOM。浏览器按普通点击/拖拽处理。
2. **零清理语义**：因未启动而"没有东西可清理"，不得出现「先建后删」的痕迹（不闪一下、不产生空容器）。
3. **实时**：拖拽中 rAF 节流重算高亮 + 小块；松手保持选中（高亮与小块的最终帧）；单击他处退出。
4. **不额外 caret**：不调用 `setSelectionStartEnd` 造光标（除退出时回落首行）；`columnSelectionLocked` 保持。
5. **退出路径**：清 highlight、清小块容器、解绑全部监听、取消 rAF；外部 `contentChanged` 静默退出。
6. **Alt 粘性**：仅 mousedown 判定，拖拽中松开 Alt 继续。

## 验收

- 静态：mousedown 早期 return 分支存在于 preventDefault 之前；未启动时不创建任何元素（无 `appendChild` 前置调用）。
- 纯函数层：起手判定中可抽出的「band 是否有文字行」断言（若有纯函数化部分）。
- `vite build` 通过；变换层断言零回归。
- 真机：文末空白处 Alt+拖拽 → 完全无反应（光标/选区仍是浏览器默认行为）；行尾右侧空白起手 → 能拖出矩形；拖拽中实时、松手保持、单击退出。

## Definition of done

无文字区域零响应零渲染；有文字处交互节奏与普通选区一致。

## 后台验证记录

- `canStartAt(clientX, clientY)`：`caretFromPoint` 必须命中 `contentElt` 内**有内容的文本节点**，且以 `[y, y+1]` 带做 `scanLines` 必须找到有文字的视觉行；任一不满足 → `return`（在 `preventDefault` 之前，741 vs 744 行）。
- 浏览器实测（dev server）：文末空白 y=400 处 Alt 拖拽 → `highlight = 0`、`gaps = 0`（零响应零渲染）；有文字行 y=100 处 Alt 拖拽 → 正常产生 ranges。
- 拖拽实时：mousemove 每帧重算 `rect → scanLines → computeRows → paint`（rAF 节流，单帧一次）。
- 松手保持：mouseup 后 ranges 与 gaps 保留（实测 `afterUp.ranges.length = 3`, `gaps = 1`）。
- 不额外 caret：仅 `columnSelectionLocked` 抑制回读 + 退出时回落首行。
- 退出路径：Esc 后 `highlight = 0`、`gaps = 0`；监听成对解绑；rAF 取消。
- 健壮性补充：`window blur` 兜底退出（防 mouseup 丢失僵死）；`dragging` 态再次按下先 `endDrag()` 收尾。
