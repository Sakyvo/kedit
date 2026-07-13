# Research: W1 移动拖拽 / W2 滚动条命中 / W6 setext — prd 假设逐条核验

- **Query**: 核验 prd.md「确认的事实」中 W1/W2/W6 的 10 条假设（CONFIRM/REFUTE + file:line 证据）
- **Scope**: internal（代码取证）+ markdown-it 14.1.0 node_modules 源码
- **Date**: 2026-07-13

## 总裁定表

| # | 主张 | 裁定 |
|---|---|---|
| 1 | ExplorerNode 根节点 `@contextmenu` 无门控，Android 原生长按事件穿透 | **CONFIRMED** |
| 2 | 菜单全屏遮罩(z:300)毒化 `elementFromPoint`，dragTarget 永不更新 | **CONFIRMED** |
| 3 | 350ms 等待期不 preventDefault → 原生滚动接管 → touchcancel 杀拖拽 | **CONFIRMED**（监听器注册本身无问题，缺的是等待期的 preventDefault） |
| 4 | 触摸链路静默 no-op 审计 | **完成**，见 W1-4；未发现第 3 条移动端独立故障源 |
| 5 | 轨道全高 8px + `@pointerdown` 翻页 0.9 屏 | **CONFIRMED** |
| 6 | 被误伤者=ButtonBar 眼睛按钮；与滚动条 z-index 重叠 | **PARTIAL**：按钮确认（阅读模式 icon-eye），但机制是**相邻列拦截**而非 z-index 重叠；真正 z-index 重叠的是阅读模式下 `preview__corner` 铅笔按钮 |
| 7 | 轨道 `pointer-events:none` + 滑块 `auto` 可行；失去轨道翻页；库内无 (pointer:fine) 先例 | **CONFIRMED** |
| 8 | 删 `'lheading'` 后 `text\n---` 确定性解析为 `<p>`+`<hr>` | **CONFIRMED**（hr 在 paragraph terminatorRules 内，已读 markdown-it 14.1.0 源码定论；table/list/frontmatter 均不可能截胡） |
| 9 | 编辑器 setext 规则 :106-119；删规则必须连删 :390-391 接线否则 TypeError | **CONFIRMED**（全库仅 4 处引用：108/114/390/391） |
| 10 | `paragraph_open` 与 `hr` 均为 section 起始 token | **CONFIRMED**（markdownConversionSvc.js:63、:72） |
| 附 | `manualSortEnabled` 仅内存态，移动端重载归 false | **CONFIRMED**（explorer.js:127-128；对照 sortBy 有 localSettings 持久化） |

---

## W1 移动端触摸拖拽

### 主张 1：无门控 `@contextmenu` — CONFIRMED

- `src/components/ExplorerNode.vue:2` 根 div：`@contextmenu="onContextMenu"` — 无任何条件。
- `onContextMenu`（:338-342）无条件 `evt.preventDefault(); evt.stopPropagation(); this.openContextMenu(...)` — 抑制的是**原生系统菜单**，随即打开**自定义菜单**，不检查 `isManualSortDrag` / `touchGhost`。
- 07-06 的抑制只落在 JS 定时器路径：`onTouchStart`（:439-459）当 `isManualSortDrag && !noDrag && !isRoot` 走 350ms 拖拽分支（:445-453，注释 "context menu suppressed"），else 才走 500ms 菜单定时器（:454-458）。
- CSS 只有 `user-select:none; -webkit-touch-callout:none`（:620-621）——touch-callout 是 iOS 专属；Android Chrome 长按（约 500ms）照发 `contextmenu` 事件，从 `.explorer-node__item` 冒泡到根 div 命中处理器。
- `@touchstart.passive`（:6）显式 passive，即使想在 touchstart 里 preventDefault 拦截长按也不可能。
- 时序：350ms 拖拽 ghost 出现 → ~500ms 原生 contextmenu → 自定义菜单弹出**叠在拖拽之上**。与「开关开启时长按仍弹菜单」症状完全一致。

### 主张 2：全屏遮罩毒化 elementFromPoint — CONFIRMED

- `src/components/ContextMenu.vue:42-51`：`.context-menu { position:absolute; z-index:300; width:100%; height:100%; }` — 打开即全屏背板（pointer-events 默认 auto，参与命中测试）。z:300 阶梯见 `.trellis/spec/frontend/component-guidelines.md:76-89`。
- 触摸拖拽目标更新链 `updateTouchTarget`（ExplorerNode.vue:522-546）：
  - :523 `const elt = document.elementFromPoint(x, y);`
  - :524-526 `elt.closest('.explorer-node__item')` → `.closest('.explorer-node')` → `dataset.id`
  - :527-529 `if (!nodeId) { return; }` — 遮罩在上时 elementFromPoint 返回 `.context-menu`，closest 找不到节点 → **静默返回，且不清除旧值**（多数场景旧值本就是 null）。
- 拖拽 ghost 自身 `pointer-events:none`（:666），不是毒源；毒源唯一 = 菜单遮罩。
- 松手 `onTouchEnd`（:484-496）先取 store 快照再 `stopTouchDrag()`，然后 `executeManualDrop(sourceNode, targetNode, position)`；`executeManualDrop`（:238-241）第一行 `if (targetNode.isNil || sourceNode.item.id === targetNode.item.id) return;` — **nil 目标静默返回**。顺序不变 + 菜单留在屏上 = 用户报告的两个症状同根。
- 触摸事件隐式捕获在 touchstart 目标元素上，遮罩弹出后 touchmove/touchend 仍派发给原节点——拖拽状态机继续走，只是永远瞄不到目标。

### 主张 3：等待期无 preventDefault → 滚动接管 → touchcancel — CONFIRMED（表述需精确）

- 监听器注册（:6）：`@touchstart.passive`（Vue 3 → addEventListener {passive:true}），`@touchend/@touchmove/@touchcancel` 无修饰符 → addEventListener 无 options。Chrome 的 passive-by-default 只作用于 window/document/body 层，**元素级 touchmove 默认非 passive** → 拖拽中 :467 `evt.preventDefault()` 有效。全库无 passive 垫片（仅 App.vue:108 一处无关的 {passive:true}）。
- 缺口在**等待期分支**：`onTouchMove`（:460-483）当 `longPressTimer && touchStart`（:473-481）只做 8px 抖动判定（:477 `dx²+dy² > 64` → clearLongPress），**从不 preventDefault** → 手指移动一旦超过浏览器滑动阈值（Android ~8dp，与 JS 的 8px 同量级），原生滚动接管 → 浏览器补发 `touchcancel` → `onTouchCancel`（:497-503）→ `clearLongPress()` → 拖拽根本不启动。
- 两个根因互补覆盖全场景：手指**基本不动**满 350ms → ghost 出现 → ~500ms 菜单毒化（主张 1+2）；手指**提前移动** → JS 抖动取消或滚动接管 touchcancel（主张 3）。Android 上成功窗口只有 ghost 出现后 ~150ms 内立即开拖并保持 preventDefault——几乎不可能自然命中。

### 主张 4：链路静默 no-op 审计 — 结论：无第 3 个独立故障源

| 位置 | 行为 |
|---|---|
| ExplorerNode.vue:239 | targetNode nil / 拖到自己 → 静默 return（主通道） |
| :271-273 | 目标为临时目录 → 静默 return |
| :306-308 | 跨父移动 storeItem 冲突弹窗取消 → 静默 return |
| :315-317 | 目标父无 gitPath（parentKey 空）→ 静默 return（不写 order） |
| :527-529 | elementFromPoint 无节点 → 不更新（不清除）dragTarget |
| :535-537 | 目标 noDrop → 不更新 |
| :484-489 | onTouchEnd 先取快照后 stopTouchDrag —— 顺序正确，无竞态 |
| :505, :575-577 | suppressClick 在拖拽启动时置位、结束 100ms 后释放；onItemClick（:427-431）守卫正确 |
| store/explorer.js:356-382 | setDragTarget 校验目标不是源的后代，违规时清空 —— 行为正确 |

- 桌面 HTML5 DnD 路径（`onItemDragOver` :227-237 / `onDrop` :187-210）与触摸路径共享 `executeManualDrop`，桌面正常佐证 drop 逻辑本身无恙；故障全部集中在移动端目标采集阶段。

### 附：manualSortEnabled 仅内存态 — CONFIRMED

- `src/store/explorer.js:127-128`：`// In-memory only, defaults to locked on each session to prevent accidental drags` + `manualSortEnabled: false`。
- 唯一写入点 `Explorer.vue:198-200` toggleManualSort → 仅 commit，无持久化。
- 对照：`sortBy/sortDirection` **有**持久化（explorer.js:266-281，`data/patchLocalSettings` 的 `explorerSortBy/explorerSortDirection`，init 时恢复 :269-270）。
- 移动端浏览器后台标签页频繁被回收重载 → 开关静默归 false → 长按退化为 500ms 菜单路径。UX 上用户会把「开关自动关掉」也感知为「拖拽坏了」。

---

## W2 滚动条伪碰撞箱

### 主张 5：全高轨道 + pointerdown 翻页 — CONFIRMED

- `src/components/common/CustomScrollbar.vue`：
  - 模板 :2 根节点 `@pointerdown="onTrackPointerDown" @wheel.prevent="onWheel"`；:3 滑块 `@pointerdown.stop` + setPointerCapture 拖动（:55-73）。
  - CSS :115-124：`.custom-scrollbar { position:absolute; top:0; right:0; bottom:0; width:8px; z-index:1; touch-action:none; }` — **右缘全高** 8px 条带。
  - :75-80 `onTrackPointerDown`：`this.target.scrollTop += direction * this.target.clientHeight * 0.9;` — 0.9 屏跳页。
- `touch-action:none`（:123）令条带上任何触摸不产生原生滚动、直接派发 pointerdown → 手指点在条带任意高度（离滑块再远也一样）= 跳 0.9 屏（「抽搐」），且点击被吞、按钮不触发。
- 挂载位置：Editor.vue:2-10（`.editor-container` 内与 `.editor` 滚动器平级）、Preview.vue:11；两处原生滚动条已隐藏（Editor.vue:202-207 / Preview.vue:238-243）。

### 主张 6：被拦截按钮与几何关系 — PARTIAL（按钮对，机制表述需修正）

- 「眼睛」= 阅读模式切换：`src/components/ButtonBar.vue:10-12` `button-bar__button--editor-toggler` + `<icon-eye>`（全库唯一 icon-eye）。位于**上组**（:3-13：导航栏切换/侧边预览/眼睛）；**下组**（:14-24）是对焦/滚动同步/状态栏。
- 几何：`Layout.vue:12-25` 面板横排 编辑器 | 按钮条(26px, `store/layout.js:31`) | 预览；`.layout__panel { position:relative; overflow:hidden }`（Layout.vue:183-189）。编辑器的滚动条条带在编辑器面板**内部**右缘（`.editor-container` 为定位祖先），紧贴按钮条左边界。
- **修正**：对眼睛按钮而言不是 z-index 重叠（两者是互不重叠的兄弟面板），而是**相邻拦截**——26px 窄按钮列紧贴 8px 全高轨道，胖手指触点落在边界左侧 ≤8px 即命中轨道。眼睛(上组第3个)与下组三键全部紧贴条带；用户「底部右缘」的描述与下组位置吻合，症状机制对上组/下组一致（轨道全高）。
- **真 z-index 重叠**只出现在阅读模式：`Preview.vue:12-16` `preview__corner` 铅笔按钮（CSS :256-259 `top:0; right:0`，无 z-index）被预览滚动条（z:1）盖住右侧 8px——z-index:1 > auto，同一 stacking context（阶梯契约 `.trellis/spec/frontend/component-guidelines.md:82`）。

### 主张 7：修法面 — CONFIRMED

- `.custom-scrollbar { pointer-events:none }` + `.custom-scrollbar__thumb { pointer-events:auto }` 可行：CSS 命中测试允许子元素重新开启；滑块拖动依赖自身 pointerdown+setPointerCapture（:55-73, :3），不受父级影响。
- 失去的能力：
  1. 轨道空白点击翻页（:75-80）整体失效；
  2. 轨道上的滚轮转发（:2 `@wheel.prevent` → :81-83）——影响极小：事件将落到其下的滚动器，原生滚轮本就有效；
  3. 附带收益：条带不再吃触摸，8px 区域恢复原生拖动滚动（pointer-events:none 元素不参与命中，touch-action 随之无意义）。
- 桌面保留翻页的条件模式：**全库无先例** —— 无任何 `(pointer:fine)`/`(pointer:coarse)`/`(hover:hover)`；@media 全库仅 4 处（base.scss:382,393 min-width、app.scss:481 print、ChatGptModal.vue:509 max-width）。若保留需引入库内第一个 pointer 媒体查询（或 JS matchMedia 分支）。

---

## W6 setext 伪标题

### 主张 8：预览删 'lheading' 的确定性后果 — CONFIRMED（定论）

**配置链**：
- `src/services/markdownConversionSvc.js:138` `new MarkdownIt('zero')`；:139-141 三个 ruler `enable([], true)` 清空后由扩展显式启用。
- `src/extensions/markdownExtension.js:24-36` `blockBaseRules`：`'hr'`(:28)、`'heading'`(:31)、**`'lheading'`(:32)**、`'paragraph'`(:35)；:88 `markdown.block.ruler.enable(blockRules)`。`'lheading'` 全 src 仅此一处，且不受任何 option 开关控制（table/fence 才有 :82-87 的开关）。

**markdown-it 14.1.0 源码定论**（node_modules 实读）：
- `lib/parser_block.mjs:22-36` 规则注册表：`['hr', r_hr, ['paragraph','reference','blockquote','list']]`（:29）——**hr 的 alt 含 'paragraph'，即 hr 是段落终结规则**；`['lheading', r_lheading]`（:34）无 alt。
- `lib/ruler.mjs:57-77` `__compile__` 跳过 `enabled:false` 的规则 → `getRules('paragraph')` 只含**已启用**的 alt-'paragraph' 规则。kedit 启用了 hr → 它在终结链里。
- `lib/rules_block/paragraph.mjs:4,20-26`：段落逐行以 silent 模式跑终结规则，任一返回 true 即断段。
- `lib/rules_block/hr.mjs:22-31`：`---`（≥3 个 marker，可混空格）silent 返回 true。
- 因此 `text\n---`（lheading 关闭时）：line0 起段 → line1 被 hr 终结 → 段落收 token，主循环在 line1 跑 hr（hr.mjs:33-39）→ **`<p>text</p>` + `<hr>`，确定性，不存在「被段落吞为续行」**。
- 截胡排除（同为启用规则、注册序在 paragraph 之前）：
  - **table**（parser_block:25，alt 含 paragraph，注册最前）：`lib/rules_block/table.mjs:121` `if (lineText.indexOf('|') === -1) return false` — 表头行必须含 `|`，"text" 无 → 排除；且 `---` 行作为 startLine 时 :57 `startLine+2 > endLine` 也排除。
  - **list**：`---` 第一个 `-` 后跟 `-` 非空格，非列表项。
  - **frontmatter**（markdownExtension.js:89 插在 hr 前）：`src/extensions/frontmatterRule.js:19` `if (startLine !== 0 ...) return false` — 仅文档首行，不吃正文 `---`。注：`ruler.before('hr', ...)` 锚定注册序而非启用态，删 'lheading' 不影响它。
- 边缘语义（删除后）：`text\n--`（2 连字符，hr 需 ≥3）→ 并入段落续行；`text\n-` → 空列表项不能打断段落 → 亦续行。与「无 setext 的 CommonMark」语义一致。

### 主张 9：编辑器语法规则与接线 — CONFIRMED

- 当前 setext 规则（批2改造后现行行号）`src/services/markdownGrammarSvc.js:106-119`：
  - :108-113 `grammars.main['h1 alt cn-head']`，pattern `/^(?!(?:#{1,6}(?:[ \t]|$)|>|(?:[-*+]|\d+\.)[ \t]|```|~~~|\|)).+\n[=]{2,}[ \t]*$/gm`（负向前瞻排除 ATX/引用/列表/围栏/表格首行）；
  - :114-119 `grammars.main['h2 alt cn-head']`，同前瞻 + `[-]{2,}`。
- **必须连删的接线**：:390 `grammars.main['h1 alt cn-head'].inside.rest = rest;`、:391 同 h2 —— 若只删 :106-119 定义，makeGrammars() 执行到 :390 对 undefined 取 `.inside` 直接 **TypeError**（编辑器高亮全挂）。
- 全库引用核查：`'h1 alt cn-head' / 'h2 alt cn-head'` 精确 4 处 = 108/114/390/391，无其他 JS/模板引用（CSS 走通用 .cn-head/.h1 类，无删除风险）。
- 兜底渲染：`grammars.main.hr` 已存在（:163-165 `/^ {0,3}([*\-_] *){3,}$/gm`）→ 删规则后 `---` 行自动落 hr 高亮；正文行落 `grammar.rest.p`（:433-436）。顺带消除现存不一致：编辑器下划线要求 `{2,}` 而 markdown-it lheading 接受 1 个 `-`。

### 主张 10：分节不受影响 — CONFIRMED

- `src/services/markdownConversionSvc.js:62-74` `startSectionBlockTypeMap` 同时含 `'paragraph_open'`(:63) 与 `'hr'`(:72)（今日 setext 产出的 `'heading_open'` 在 :65）。
- `parseSections`（:195-214）按 level-0 且命中该表的 token 切 section → 删 lheading 后 `text` 行开段落 section、`---` 行开 hr section，两枚均为合法起始，切分不破。
- 编辑器分节与预览渲染共用同一 converter（markdownConversionSvc.init :108-119 → createConverter :136-154 → extensionSvc.initConverter），**markdownExtension.js:32 一处删除同时生效于两侧**，无双改漂移风险。

---

## 相关 Spec

- `.trellis/spec/frontend/component-guidelines.md:76-89` — 浮层 z-index 阶梯（CustomScrollbar 1 / modal 100 / notification 200 / context-menu 300 / ImageLightbox 1000；`.editor`/`.layout` 祖先不建 stacking context）。W2 修改与 W1 遮罩分析都要对齐此契约。

## Caveats / Not Found

- 主张 1 中「Android 长按派发原生 contextmenu（~500ms）、手指越过滑动阈值即取消长按」是标准浏览器行为，无法从仓库代码直接证明，但代码侧证据（350ms<500ms、touchstart passive、handler 无门控）与用户症状（菜单弹出+顺序不变）完全自洽；建议修复时真机回归确认。
- 主张 6 的「眼睛在底部右缘」与代码不符（icon-eye 在上组 ButtonBar.vue:3-13）；底部右缘紧贴轨道的是下组三键。不影响结论——轨道全高，上下均被拦。prd :21 的「z-index 重叠」表述建议改为「相邻拦截」（真重叠仅 preview__corner 铅笔按钮场景）。
- W6 未运行时验证（未起 dev server 实测渲染），但解析路径已读到 markdown-it 14.1.0 源码级别，无分支不确定性。
