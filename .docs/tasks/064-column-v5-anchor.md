Status: anchor

# 064 矩形选择 v5 锚卡（原生选区观感 + 行内补齐）

## Problem

批 060 的 v4 交付后被真机打回三次中的第三次：p1（kedit Alt 选取）是整块淡蓝色矩形，覆盖文字之外的大片空白，且与 p2（kedit 原生选取：深蓝底白字）风格完全不同；Author 描述"交互极其诡异，可以凭空画矩形"。根因：v4 用单个 `.cl-column-block` 按鼠标矩形宽高绘制整块 overlay（`left=rect.left; width=rect.width; top/bottom=snapBandToLines`），因此必然覆盖无文字区域，且半透明叠加使文字不变白。Author 同时澄清 notepad420 只是**实现方式参考**，不得照搬其前端样式。

## Decisions

grill 收敛，Author 全数确认（决策与被否方案见 ADR 0014 v5）：

1. **删除整块 overlay**：`.cl-column-block` 与 `.cl-column-layer` 一并移除；不再在任何地方绘制整块矩形。
2. **真实文字走 CSS Custom Highlight**（`::highlight(cl-column)`），逐视觉行 DOM Range，只覆盖真实文本。依据实测：Chromium `selection.addRange()` 多区不可用（`rangeCount=1`），而 `::highlight` 支持 `color` + `background-color`，可得深蓝底白字。
3. **色彩恒等单一来源**：`--selection-bg` / `--selection-fg`（浅/深主题各一套），`::selection`、`::highlight(cl-column)`、补齐小块全部引用同一组变量。
4. **短行补齐（Q2=B）**：仅「行尾 → 矩形右边界」的行高小块，作为选中块延续；不是整块矩形。
5. **起手判定（Q1 + Q3）**：Alt 按下时 `caretRangeFromPoint` 必须命中编辑器文本，**且**该 y 与某个有文字的视觉行 rect 纵向相交；否则完全不响应（不 preventDefault、不建 DOM、浏览器照常）。行尾右侧同行空白可起手；文末空白、段落空行不可。
6. **无文字一律不画**：空行、文末空白不产生高亮与小块。
7. **不额外设置原生 caret**（`columnSelectionLocked` 抑制回读）；拖拽实时、松手保持、单击他处退出。
8. **保留**：带状扫描 + rAF 节流、粘性列光标逐行输入（短行补空格）、双向列删除、列复制/粘贴（自贴补空格、外来先清后插）、自动滚动、Alt 粘性、DOM↔模型偏移不变量、退出后光标回落首行。

## Out of scope

- 照搬 Notepad4 / Word 的配色或块状视觉。
- 编辑器级多光标；触屏。
- 变换层（cleditColumnUtils）语义变更。

## Testing strategy

- `vite build`（`NODE_OPTIONS=--max-old-space-size=4096 node node_modules/vite/bin/vite.js build --mode production`）+ style 子链 + copyfiles。
- 变换层既有断言零回归（colutil/55/57/58/59/61 共 56 项）。
- 起手判定与色彩来源补纯函数断言（`hitTestHasTextRow` 语义在纯函数层可测的部分）。
- 静态核查：无整块 block、无硬编码选中色、三通道共用变量、热路径无 O(全文) 调用。
- 真机人工验收清单（不阻塞交付）。

## Vertical slices

| # | 任务 | 依赖 |
|---|---|---|
| 065 | 绘制重写：删整块 block/layer，`::highlight` 逐行 Range + 共用色变量 + 行内补齐小块 | — |
| 066 | 起手判定与交互对齐：无文字处零响应、实时更新、松手保持、退出路径、无额外 caret | 065 |
| 067 | 编辑语义回归 + 构建/静态验证（含热路径、监听配对、断言回归） | 065, 066 |