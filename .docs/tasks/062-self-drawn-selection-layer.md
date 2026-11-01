Status: open

## Parent

`.docs/tasks/060-column-v4-anchor.md`

## Depends on

061

## What to build

统一自绘选中层（Word 2016 Alt 矩形选择观感），替换 v3 绘制路径：

1. **单容器**：一个 `cl-column-layer` div 挂 `scrollElt`，样式显式 `position:absolute; left:0; top:0; pointer-events:none;`（零点锚定，杜绝静态位置错位）；z-index 取阶梯 panel-local 1。
2. **逐行块**：每视觉行一个 `cl-column-block`（left/width 由行 x 边界、top/height 由行 rect；坐标系 = 滚动容器内容坐标 = `contentOrigin()` 一次换算）。真实行段块 + 短行补齐块（`lineEndX` → 右边界）同容器同色，视觉合为整齐矩形。
3. **颜色**：取主题选中色（浅/深主题各自变量），与浏览器原生 `::selection` 观感一致；样式入 base.scss，删除 `::highlight(cl-column)`、`.cl-column-selection`、`.cl-column-gaps/.cl-column-gap` 旧样式。
4. **代码删除**：`supportsHighlight` 分支、`buildRanges`、`ensureRect/removeRect`、`paintGaps` 的 v3 实现、`window.CSS.highlights` 全部调用——移除后全仓 `grep -rn "highlights\|Highlight(" src/` 0 命中（cleditColumnSelection 范围内）。
5. 拖拽方向对称；零宽/零高矩形不绘制任何元素；拖拽结束保持选中块；退出清除整个层（容器一并移除或置空）。

## 验收

- 静态：无 Highlight API 调用、无边框样式、容器显式零点、块只在相交行出现。
- `vite build` 通过。
- 真机：按住 Alt 拖拽，拖动过程中即见实心选中块覆盖文字（短行补齐成整齐矩形），无任何游离框/边框。

## Definition of done

页面上唯一可见物 = Word 2016 式实心选中块。
