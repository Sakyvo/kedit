# Research: 批次4缺陷根因排查（W1 触摸拖拽 / W2 滚动条命中 / W6 setext 禁用）

- **Query**: W1 移动端触摸拖拽全链路失效 + 菜单未抑制；W2 CustomScrollbar 伪碰撞箱；W6 setext 全面禁用可行性
- **Scope**: internal（代码取证）+ 平台行为知识（Chromium/Vue，已尽量用本地 node_modules 源码验证）
- **Date**: 2026-07-12
- **结论可信度**: 所有 file:line 均为当前工作区实读；平台行为（Android 长按 contextmenu、滚动接管）标注于 Caveats

---

## W1 移动端触摸拖拽无效 + 长按菜单仍弹出

### 1. 代码现状清单（file:line）

| 位置 | 内容 |
|---|---|
| `src/components/ExplorerNode.vue:2` | 外层 `.explorer-node` div 绑定 `@contextmenu="onContextMenu"`（**无任何拖拽状态门控**） |
| `src/components/ExplorerNode.vue:6` | item 行绑定 `@touchstart.passive="onTouchStart" @touchend="onTouchEnd" @touchmove="onTouchMove" @touchcancel="onTouchCancel"`；`:draggable="isDraggable"` |
| `:61-64` | `isManualSortDrag` = `sortBy==='manual' && manualSortEnabled`（直接读 `store.state.explorer`，响应式，无陈旧 prop 问题） |
| `:65-69` | `isDraggable` 只喂给 HTML5 `draggable` 属性（鼠标 DnD 用），**不参与触摸分支**，排除"移动端 isDraggable=false 导致"假说 |
| `:439-459` | `onTouchStart`：`isManualSortDrag && !noDrag && !isRoot` → 350ms 定时器 → `startTouchDrag`；否则 500ms 定时器 → `openContextMenu`（旧菜单路径） |
| `:460-483` | `onTouchMove`：有 ghost 时 `evt.preventDefault()` + 移动 ghost + `updateTouchTarget`；等待长按期间容忍 8px 抖动（`dx²+dy²>64` 才取消），**等待期从不 preventDefault** |
| `:484-496` | `onTouchEnd`：有 ghost → 读取 dragSource/dragTarget/position → `stopTouchDrag` → `executeManualDrop` |
| `:497-503` | `onTouchCancel`：有 ghost → 直接 `stopTouchDrag()`（拖拽静默死亡） |
| `:504-517` | `startTouchDrag`：commit `setDragSourceId`、建 ghost、启动边缘滚动定时器 |
| `:522-546` | `updateTouchTarget`：`document.elementFromPoint(x,y)` → `closest('.explorer-node__item')` → 取 `data-id`；**取不到 node 直接 return，dragTarget 保持为空** |
| `:238-241` | `executeManualDrop`：`targetNode.isNil` → **静默 return**（触摸路径唯一写 dragTarget 的入口就是 updateTouchTarget） |
| `:657-671` | ghost CSS：`pointer-events: none`（:666）——ghost **不会**干扰 elementFromPoint，且 `translate(-50%,-100%)` 悬在手指上方 |
| `:338-342` | `onContextMenu(evt)`：无条件 `preventDefault` + `openContextMenu`（阻止的是浏览器原生菜单，然后**打开应用自定义菜单**） |
| `src/components/ContextMenu.vue:42-51` | `.context-menu` 是**全屏遮罩**：`position:absolute; width:100%; height:100%; z-index:300`，`v-if="items.length"`（:2） |
| `src/store/explorer.js:127-128` | `manualSortEnabled: false`，**仅内存态，每次会话重置为关**；`:136` mutation；开关 UI 在 `Explorer.vue:23,:199` |
| `src/components/Explorer.vue:249-257` | `.explorer__tree { overflow: auto }`，**无 touch-action 限制**（全局仅 `.button` 有 `touch-action: manipulation`，`src/styles/app.scss:181-182`） |

### 2. (a) 事件绑定 passive 语义（已用本项目安装的 Vue 运行时验证）

`node_modules/@vue/runtime-dom/dist/runtime-dom.cjs.js:628-654`（`patchEvent`/`parseName`）：

- `@touchstart.passive` → 事件名后缀 `Passive` 被解析为 `addEventListener(el,'touchstart',fn,{passive:true})`。
- `@touchmove`（无修饰符）→ `options === undefined` → `addEventListener(el,'touchmove',fn,undefined)`。
- Chromium 的 "passive by default" 干预**只作用于 window / document / document.body** 上的 touchstart/touchmove；元素级监听器默认仍是 `passive:false`。

**结论**：`onTouchMove` 里的 `preventDefault()` 本身是有效的（事件仍 cancelable 时）；passive 不是拖拽失效的直接根因。但 `touchstart.passive` 意味着**代码永远无法在 touchstart 阶段 preventDefault**——而那是从触摸侧掐掉 Android 原生长按流水线（含 contextmenu 事件）的唯一钩子。

### 3. 失败链假说（按可能性排序）

#### H1（主因，一个根因同时解释两个症状）：原生 contextmenu 事件未被拖拽分支抑制 → 全屏菜单遮罩毒化 elementFromPoint

07-06 的"抑制"只是让拖拽分支不再安排 500ms 的 JS 菜单定时器（`:445-453` 提前 return）。但 Android Chromium（Via 即 Chromium 内核）在长按 ~500ms 时会**从浏览器侧派发原生 `contextmenu` DOM 事件**（`user-select:none`/`-webkit-touch-callout:none` 不阻止该事件；后者还是 iOS 专属属性）。该事件冒泡到 `ExplorerNode.vue:2` 的 `@contextmenu` → `onContextMenu`（:338）**无条件**打开自定义菜单。

真机时间线：

1. t=0 touchstart（passive）→ 走拖拽分支，350ms 定时器；
2. t≈350ms `startTouchDrag`：ghost 出现、`dragSourceId` 已设；
3. t≈500ms（手指仍按住未大幅移动）浏览器派发原生 `contextmenu` → `onContextMenu` → **自定义菜单弹出**（= 症状B"菜单仍弹出"）；`evt.preventDefault()` 只压掉了浏览器原生菜单，且顺带避免了触摸流被系统菜单取消——touch 流继续；
4. 用户开始拖动：touchmove 仍派发到起始元素（touch 事件不重定向），ghost 跟手；但 `updateTouchTarget:523` 的 `document.elementFromPoint` 现在**永远命中 z-index:300 的全屏 `.context-menu` 遮罩**，`closest('.explorer-node__item')` 为 null → `:527-529` 提前 return → `dragTargetId` 始终为空；
5. 松手：`onTouchEnd:486-492` → `executeManualDrop(source, nilNode, null)` → `:239 targetNode.isNil` → **静默 return**（= 症状A"顺序无变化"）。菜单留在屏上等待点击。

旁证：桌面（HTML5 DnD 路径）正常；旧代码里开关关闭时 500ms 定时器与原生 contextmenu **双路径同时开菜单**（视觉上只见一个），所以该原生路径一直存在却从未被注意。

#### H2（次因/并发因素）：滚动手势接管 → touchcancel 杀拖拽

- 等待长按的 350ms 里代码**从不 preventDefault**（`:473-481` 只做抖动判断），touchstart 又是 passive；`.explorer__tree` 是 `overflow:auto` 且无 `touch-action:none/pan-y` 限制；
- 手指只要漂移超过浏览器触摸滑动阈值（通常 ~8-10 物理px，与代码的 8 CSS px 容忍带同量级），浏览器即启动滚动并**接管手势**：典型表现为向页面派发 `touchcancel`（或后续 touchmove 变为 `cancelable:false`，preventDefault 被忽略并告警）；
- `onTouchCancel:497-503` → `stopTouchDrag()` → dragSource 清空，拖拽无声死亡。即使 H1 被修掉，长按成功率仍受此竞态影响——修复时需给 item/树容器加 `touch-action` 约束或在拖拽激活后立刻锁定手势。

#### H3（备选，仅解释"菜单弹出"）：manualSortEnabled 会话内存态被静默重置

`explorer.js:127-128` 注释明示"每次会话默认锁定"。移动端浏览器（Via 尤甚）后台标签页极易被回收重载：重载后 `sortBy` 仍是 'manual'（localSettings 持久化，`:266-271`）但 `manualSortEnabled` 归 false → 长按落入 `:454-458` 的 500ms 菜单分支——菜单弹出、完全无拖拽。可通过失败瞬间开关按钮是否仍高亮（`Explorer.vue:23` `--on` 类）与是否出现过蓝色 ghost 区分 H1/H3。

### 4. 任务追问逐条回答

- (a) `@touchstart` 绑了 `.passive`（:6）；`@touchmove` 无修饰符经 Vue 以 `options=undefined` 注册，元素级默认非 passive → 拖拽中的 preventDefault 有效（滚动未启动时）。
- (b) 拖拽分支门控 `isManualSortDrag && !noDrag && !isRoot`（:445），读 store 无陈旧问题；`isDraggable` 与触摸路径无关（:6, :65-69）。菜单获胜的原因不是分支判断错，而是 H1 的**第三条路径**（原生 contextmenu → :2 → :338）绕过了两个分支。
- (c) ghost 自身 `pointer-events:none`（:666），不拦 elementFromPoint；**拦截者是 ContextMenu 全屏遮罩**（ContextMenu.vue:42-51）。
- (d) 是。`executeManualDrop` 完全依赖 `dragTargetNode/dragTargetPosition`（:486-492 读取，:239 nil 即弃），触摸路径唯一写入点是 `updateTouchTarget→setDragTarget`（:545, store action `explorer.js:356-382`）；遮罩存在时永远写不进去。

### 5. 历史锚点

- 触摸拖拽/手动排序：commit `31fe3372`（07-06 批次）；开关两态样式 `ca4b/ca62…`（阶段1小修 `ca67a4b6`→`ca4…`，见 `git log -- src/components/ExplorerNode.vue`）。
- 层级规则先例：commit `4c0f3211` 已确立"通知/菜单 > modal > 滚动条"层级——菜单 z-index 300 为有意设计，修复不应动层级而应门控菜单打开条件。

---

## W2 CustomScrollbar 伪碰撞箱

### 1. 轨道/滑块 DOM 几何（`src/components/common/CustomScrollbar.vue`）

| 项 | 事实 |
|---|---|
| 轨道 `.custom-scrollbar` | `:115-124`：`position:absolute; top:0; right:0; bottom:0; width:8px; z-index:1; touch-action:none`。**无任何 pointer-events 限制（默认 auto）→ 右缘 8px×全高整条可交互** |
| 显隐 | `:2` `v-show="visible"`；`:24-26` 内容可滚动即显示 → 长文档下轨道常驻全高 |
| 轨道翻页 | `:2` 根元素 `@pointerdown` → `onTrackPointerDown` `:75-80`：`scrollTop += ±0.9*clientHeight`，**pointerdown 即触发**（非 click）→ 一按下页面立跳（"抽搐"），且按下点在轨道上，下层按钮永远收不到这次点击 |
| 滑块 | `:3` `@pointerdown.stop`（阻断冒泡才不触发翻页）+ pointer capture 拖动（`:55-73`）；宽度=轨道 8px |
| 滚轮 | `:2` `@wheel.prevent` → `onWheel :81-83` |
| 挂载点 | `Editor.vue:10`（target=`.editor`，编辑面板右缘；`:197-208` 原生条已隐藏）；`Preview.vue:11`（target=`.preview__inner-1`，`:236-244` 同） |

### 2. 与右缘按钮的相对位置

- **编辑模式**：`Layout.vue:12-25` 编辑面板与 `layout__panel--button-bar`（宽 26px，`layout.js:31`）为相邻 flex 兄弟。ButtonBar（`ButtonBar.vue`）上组 `:3-13`：导航栏切换、侧边预览切换、**眼睛（阅读模式，`toggleEditor(false)`，:10-12）**；下组 `:14-24`（`bottom:0`，:64-66）：对焦、滚动同步、状态栏切换。编辑器滚动条紧贴按钮列左侧 0px。
- **阅读模式**：ButtonBar 隐藏（`v-show="styles.showEditor"`，Layout.vue:23），`previewWidth += buttonBarWidth`（`layout.js:113-115`），预览滚动条顶到屏幕最右缘；右上角编辑铅笔按钮 `preview__button` 在 `top:15px; right:15px`（`Preview.vue:275-281`）。
- **EditorInPageButtons 澄清**：它在**左上角**（`EditorInPageButtons.vue:133-141`：`top:0; left:-108px` hover 滑出），含查找/替换/主题，**没有眼睛按钮**、不与滚动条相邻。用户所称"预览眼睛"实为 ButtonBar 的阅读模式眼睛（或阅读模式下的铅笔）。z-index 关系：滚动条 z-index:1 在编辑容器内，与 ButtonBar 分属不同面板（`overflow:hidden` 的兄弟节点），**无涂层重叠**——拦截纯粹因为触点落进了编辑面板最后 8px。
- 触点误差模型：viewport `initial-scale=1`（`index.html:7`），8 CSS px ≈ 8dp；指尖接触面 7-9mm ≈ 40+ dp，瞄准 26px 宽按钮列时触点极易偏左 ≤8px 落入轨道 → pointerdown 翻页 + 按钮点击丢失。与用户"页面抽搐且未进预览"完全吻合。

### 3. 命中区收窄到可见滑块的选项与代价

| 方案 | 做法 | 失去什么 |
|---|---|---|
| A. pointer-events 收窄 | `.custom-scrollbar { pointer-events:none }` + `.custom-scrollbar__thumb { pointer-events:auto }` | 轨道空白点击翻页（onTrackPointerDown 死）；根上的 `@wheel` 也死，但 wheel 会穿透到下层滚动容器由原生滚动接住，**无净损失**。滑块拖动/capture 不受影响 |
| B. 仅桌面保留轨道 | 方案A + `@media (pointer:fine)`（或 `hover:hover`）恢复轨道 `pointer-events:auto` | 触屏失去翻页，桌面全保留 |
| C. 运行时判别 | `onTrackPointerDown` 里 `evt.pointerType==='mouse'` 才翻页 | 触屏轨道仍会**吞掉点击**（元素仍接收 pointerdown），只是不抽搐——**不解决按钮丢击，单用不可行** |

注：8px 滑块对触屏拖动本身也偏窄（对比 07-10 引入时的 pointer capture 防断触设计，commit `ac627787`），是否加宽触屏命中带属设计决策，此处仅记录。PRD 开放问题3（轨道翻页保留策略）对应 A vs B。

---

## W6 setext 标题全面禁用可行性

### 1. 预览侧（markdown-it，^14.1.0，`package.json:28`）

- 转换器以 **zero 预设**创建：`markdownConversionSvc.js:138` `new MarkdownIt('zero')`——所有规则默认关闭，之后由 `markdownExtension.js:88` `markdown.block.ruler.enable(blockRules)` 显式启用；`blockBaseRules` 列表在 `:24-36`，`'lheading'` 在 **:32**。
- **禁用点**：从 `blockBaseRules` 删除 `'lheading'` 即可（zero 预设下等价于 `md.disable('lheading')`，且更干净——规则从未启用）。全库 grep `lheading|setext` 仅此一处代码引用。
- 无联动风险：`parser_block.mjs:34` 中 lheading **没有 alt 数组**（不是任何规则的段落终止器），禁用它不影响其他规则的 terminator 链；frontmatter 规则锚定在 `before('hr',…)`（`markdownExtension.js:89`），与 lheading 无关。

### 2. 禁用后 `text\n---\n` 的确定性解析结果（读 node_modules 源码推演）

- `parser_block.mjs:29`：`['hr', r_hr, ['paragraph','reference','blockquote','list']]` —— **hr 注册为段落终止器**（CommonMark：thematic break 可打断段落；平时 `text\n---` 成 setext 只因 lheading 规则先吞掉了整块）。
- 逐行：paragraph 规则（`paragraph.mjs:10-27`）从 `text` 行开始，检查下一行 `---` 时 terminator 循环命中 hr 的 silent 模式（`hr.mjs:5-31`：marker `-`、计数≥3 → true）→ 段落在第1行截止 → `<p>text</p>`；主循环随后由 hr 规则消费 `---` → `<hr>`。
- **结论：`text\n---` = 段落 + 水平分隔线**（不是懒延续行、不是 h2）。与"`---` 恒为分隔线"的产品预期一致。
- `text\n===`：`=` 不是 hr marker（`hr.mjs:14-17` 仅 `* - _`），也无其他已启用规则匹配 → 懒延续并入段落 → `<p>text<br>===</p>`（default 预设 `breaks:true`，`presets.js:83-99`；`===` 以明文渲染）。
- 独立 `---`（前有空行）→ `<hr>`（与现状一致）；独立 `===` → `<p>===</p>`。

### 3. 分节（section）影响 —— 无依赖破坏，仅切分点变化

- `markdownConversionSvc.js:62-74` `startSectionBlockTypeMap` 含 `paragraph_open`、`heading_open`、`hr` 等；`parseSections:195-214` 在 level-0 的这些 token 处切分 section，`:143-152` 给这些类型统一注入 sectionDelimiter 渲染。
- setext 从未有专属 token：lheading 产出的就是普通 `heading_open`（`lheading.mjs:67`）。禁用后 `text\n---` 从"一个 h2 section（map 跨2行）"变为"paragraph section + hr section"两段——两种 token 都在切分表中，**编辑器/预览的 section 对齐、增量 diff 机制不需要任何改动**。
- TOC/锚点（`markdownItAnchor`）作用于 heading token：setext 行自动退出 TOC，无需额外处理。

### 4. 编辑器侧语法高亮删除点（`src/services/markdownGrammarSvc.js`）

| 行号 | 内容 | 操作 |
|---|---|---|
| `:106-113` | `grammars.main['h1 alt cn-head']`（`text\n===` 高亮，含批次2负向前瞻 `(?!#{1,6}…\|>\|列表\|围栏\|\|)`) | 整体删除 |
| `:114-119` | `grammars.main['h2 alt cn-head']`（`text\n---`，同上前瞻） | 整体删除 |
| `:390-391` | `grammars.main['h1/h2 alt cn-head'].inside.rest = rest` | **必须一并删除**，否则对 undefined 取 `.inside` 直接 TypeError |

- 删除后的编辑区表现：`---` 行由 `grammars.main.hr`（`:163-165`，`/^ {0,3}([*\-_] *){3,}$/gm`）接管为分隔线样式；`===` 落入兜底 `rest.p`（`:435`）按普通段落渲染。因为编辑器 section 就来自同一 converter 的 parseSections，`text` 与 `---` 会天然分属两个 section，逐 section 的 Prism 高亮与预览一致。
- 样式无孤儿：`.cn-head`/`.cl-hash`（`markdownHighlighting.scss:215,:307`）与 ATX `h1-h6 cn-head`（`markdownGrammarSvc.js:123-130`）共用，没有针对 `alt` 类的专属 CSS（grep 验证）。
- 全库无其他 setext 依赖（grep `lheading|setext|alt cn-head` 仅命中上述位置）。

---

## Caveats / 待真机验证

1. **W1-H1 的平台前提**（Android Chromium 长按 ~500ms 派发原生 `contextmenu` 事件；`user-select:none` 不抑制该事件）是稳定的平台行为知识，但**不可能从仓库代码验证**。真机确认法：失败复现时观察是否先出现蓝色 ghost 浮签再弹菜单（H1）、还是完全无 ghost（H3/开关被会话重置）；或临时在 `onContextMenu` 里 log `this.touchGhost`。
2. **W1-H2 的 touchcancel 行为**（滚动接管时派发 touchcancel vs 后续 touchmove 变 non-cancelable）在不同 Chromium 版本/WebView 上表现有差异，两种形态都会杀死或废掉拖拽，修复方案应同时覆盖（touch-action + 拖拽激活后忽略 cancel 之外仍需真机回归）。
3. W2 用户描述"页面底部"与眼睛按钮（ButtonBar 上组）位置略有出入——底部对应下组三个按钮；但拦截机制对整条右缘按钮列一致成立，不影响结论。
4. W6 的 `text\n===\n` 渲染含 `<br>` 依赖 default 预设 `breaks:true`（用户可在扩展配置改）；无论 breaks 与否都不再是标题。
5. 本文件未跑运行时实验（未起 dev server / 未写测试脚本）；markdown-it 解析结论来自对本仓库 `node_modules/markdown-it@14` 实际源码（hr.mjs/paragraph.mjs/lheading.mjs/parser_block.mjs）的逐行推演，置信度高。
