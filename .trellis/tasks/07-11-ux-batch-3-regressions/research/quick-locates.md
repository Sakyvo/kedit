# Research: batch-3 quick locates (Z1 / Z2 / Z4 / Z5)

- **Query**: Z1 白色同步按钮残留 / Z2 CustomScrollbar 盖住 modal / Z4 tocAutoJump 开关点击无反应 / Z5 列表缩进与 marker CSS 事实
- **Scope**: mixed (internal code + CSS 规范知识)
- **Date**: 2026-07-11
- 行号基于当前工作树（含未提交改动），与 prompt 中引用的历史行号可能有 ±10 偏差。

---

## Z1 — "白色同步按钮" 的真实身份

### 结论先行

**导航栏 DOM 里只有一个同步按钮**（28ef4f68 已成功删除 hideLocations 组内的 `--sync`）。截图 33 中的四个图标从左到右是：

| 截图位置 | 真实元素 | 代码位置 |
|---|---|---|
| 1. "时钟" | **队列活动 spinner**（圆圈+两根旋转指针，静态截图神似表盘） | `src/components/NavigationBar.vue:17-20`（模板）、`:446-496`（`.spinner` 画法：圆环 border + `::before/::after` 两根指针） |
| 2. 上传箭头 | **立即发布按钮**（`--publish`，icon-upload），无发布位置时 disabled 灰白 | `NavigationBar.vue:25` |
| 3. **白色循环箭头** | **`--sync-quick` 快捷同步按钮本尊**，处于白色状态（见下） | `NavigationBar.vue:11` |
| 4. 彩色圆角方块 | **KEDIT logo 按钮 = 侧边栏开关**（`toggleSideBar`），底图 `src/assets/logo.png`（彩虹描边+双蛇杖），**不是同步按钮** | `NavigationBar.vue:13`；`src/icons/Provider.vue:56-58`（`.icon-provider--kedit` → logo.png） |

即：**没有残留的重复按钮**，问题是 `--sync-quick` 在某些状态下渲染为白色，被误认成"残留的白色旧按钮"；而最右侧被当成"彩色同步按钮"的其实是 logo/侧栏开关。

### 白色从哪来（配色规则）

`NavigationBar.vue` 样式段：

- 基础色：`.navigation-bar__button { color: $navbar-color }`（:337-341）；`$navbar-color = mix(#2c2c2c, #fff, 33%) ≈ #b9b9b9` 灰白（`src/styles/variables.scss:19-20`）
- `--unsynced:not([disabled])` → `$error-color #f31` 红（:349-356）
- `--synced:not([disabled])` → `#5cb85c` 绿（:358-365）
- `--syncing` → **只有旋转动画、没有配色规则**（:367-369），保持灰白
- `[disabled]` → 强制 `$navbar-color` 灰白（:371-378）
- 另有 `opacity: 0.85`（:297-307）

状态来源（`NavigationBar.vue`）：

- `syncStatus`（:127-142）：`isSyncRequested` → `'syncing'`；无文档 → `'synced'`；否则 content.hash 对比 syncData.hash
- `syncDisabled`（:118-123）：已登录时 `!isSyncPossible || isSyncRequested || offline`；未登录时仅 `offline`
- 截图里 spinner 同时可见 ⇒ `queue.isEmpty === false`（`showSpinner`，:124-126；`src/store/queue.js:10`）⇒ 大概率**正在同步**：`isSyncRequested` 为 true ⇒ 按钮 disabled + `--syncing` ⇒ 灰白+旋转

按钮变白的完整场景清单：

1. **同步进行中**（最可能，spinner 同框佐证）：每次手动/自动同步期间必然白一阵。自动同步轮询在 `src/services/syncSvc.js:1036-1045`（每 1s 检查 `isAutoSyncReady` 等条件后 `requestSync()`）
2. 已登录但 `!isSyncPossible`（无 syncToken 且当前文件无同步位置，`NavigationBar.vue:114-117`）→ **恒白**
3. offline → disabled 恒白（但此时 spinner 位会换成 `icon-sync-off`，:19，半透明红）

### 全局 icon-sync / requestSync 盘点

渲染 `<icon-sync>` 的组件（grep 全量）：

| 位置 | 说明 |
|---|---|
| `NavigationBar.vue:11` | 唯一的导航栏同步按钮（本案主角） |
| `src/components/menus/SyncMenu.vue:10` | 侧栏同步菜单入口（menu-entry 图标） |
| `src/components/menus/MainMenu.vue:61` | 侧栏主菜单"同步"项图标 |
| `src/components/Tour.vue:43` | 引导文案内联图标（"点击 <icon-sync> 立即同步"） |
| `src/components/modals/SyncManagementModal.vue:5` | 弹窗标题图标 |

调用 `syncSvc.requestSync()` 的位置：`NavigationBar.vue:161-178`、`SyncMenu.vue:233-236`、`MainMenu.vue:194`、`menus/HistoryMenu.vue:172,181`、`Modal.vue:208`、`store/discussion.js:147`、`services/optional/shortcuts.js:50`（快捷键）。

**`EditorInPageButtons.vue` / `PreviewInPageButtons.vue` 均无同步按钮**（前者：查找/替换/编辑主题，`EditorInPageButtons.vue:2-19`；后者：分享/复制/预览主题/帮助，`PreviewInPageButtons.vue:2-22`）。07-05 任务（10bfa2b9）的"快捷同步"就是加在 NavigationBar 原主题切换按钮的位置（commit message "移除夜间切换按钮, 原位改常驻同步按钮"），d60e0ebf 给它加三态色，28ef4f68 去掉 `v-if="styles.hideLocations"` 使其恒显示并删掉标题区白色 `--sync`（diff 已核实：`navigation-bar__button--sync` 行被删除）。

### 若删掉这个"白色按钮"会破坏什么

它就是唯一的快捷同步按钮，删除会失去：

1. 导航栏唯一同步触发点；
2. **未登录引导流**：`requestSync()`（:161-174）在无 loginToken 时走 `signInForSync` → `githubPat` 弹窗 → `githubHelper.signinWithToken` → `afterSignIn` → 同步；
3. **Tour 锚点**：按钮带 `tour-step-anchor="theme"`，`Tour.vue:40,69,104-106` 的 'theme' 步骤按此定位，文案 :43 引用同步图标。

（修复方向应是处理**白色状态的观感**——例如给 `--syncing` 配色/给 disabled 态配色——而非删按钮；此处仅记录事实与影响面。）

---

## Z2 — CustomScrollbar 浮在 modal 之上

### 两个 z-index 与 DOM 位置

| 元素 | 定位/层级 | 位置 |
|---|---|---|
| `.custom-scrollbar` | `position: absolute; right:0; width:8px;` **`z-index: 10`** | `src/components/common/CustomScrollbar.vue:115-124` |
| `.modal`（遮罩+对话框容器） | `position: absolute; width/height:100%; background rgba(160,160,160,.5);` **无 z-index（z-auto）** | `src/components/Modal.vue:267-277` |

实例挂载点：`Editor.vue:10`（`.editor-container` 内最后一个子节点）、`Preview.vue:11`。`<modal>` 挂在 `App.vue:5`，是 `<layout>`（App.vue:4）之后的兄弟节点。

### 层叠上下文分析（关键）

scrollbar 的祖先链：`.app`（无样式规则，static）→ `.layout`（absolute，z-auto，`Layout.vue:177-181`）→ 若干 `.layout__panel`（relative，z-auto，overflow:hidden，`Layout.vue:183-189`）→ `.layout__panel--editor`（同上）→ `.editor-container`（absolute，z-auto，`Editor.vue:174-178`）→ `.custom-scrollbar`。

- **链上没有任何元素创建层叠上下文**（无 z-index/transform/filter/opacity<1；`.editor` 只是 absolute+overflow:auto，`Editor.vue:180-191`，**不创建**层叠上下文）
- 因此 `.custom-scrollbar` 的 `z-index:10` 直接参与**根层叠上下文**排序，压过 z-auto 的 `.modal`（DOM 顺序在后只在同为 z-auto 时有用）
- 34-move-scrollbar.png 可见灰色 thumb 悬在"移动到…"（FolderPicker）弹窗顶部之上，与该机制吻合

### 其他浮层如何共存（参照系）

| 浮层 | 定位 | z-index | 与 scrollbar 的关系 |
|---|---|---|---|
| `ImageLightbox` | fixed | **1000**（`ImageLightbox.vue:137-139`） | 直接压过 z:10 —— 靠更大 z 共存 |
| `Notification` | absolute | 无（`Notification.vue:36`） | App.vue:6，靠 DOM 顺序压 modal，同样会被 scrollbar 压住（顶部区域通常不重叠） |
| `ContextMenu` | absolute | 无（`ContextMenu.vue:43,55`） | App.vue:7，同上 |
| ExplorerNode 拖拽影子 | — | 1000（`ExplorerNode.vue:659`） | 同 lightbox 策略 |
| `.modal__sponsor-banner` | fixed | 1（`Modal.vue:279-289`） | 模板中已注释掉 |

### 修复所需事实（两条路线的支撑数据）

- **调层级**：`.editor-container`/preview 面板内**没有任何其它元素带 z-index**，且 scrollbar 是容器内最后一个兄弟节点 ⇒ 仅靠 DOM 顺序它已能盖住 `.editor` 内容；z:10 目前唯一"打赢"的对象恰是 modal/notification 这类 z-auto 浮层。若降为 0/auto，modal（DOM 在后）即压回 scrollbar。唯一相互作用：预览面板的 `.preview-in-page-buttons`（absolute，bottom:10px，hover 时滑入 right:0，z-auto，`PreviewInPageButtons.vue:272-297`；DOM 在 `<preview>` 之后，`Layout.vue:30-31`）滑出时与滚动条右缘几何重叠，届时会盖住 thumb 底部 34px——现状（z:10）是 thumb 盖住它。
- **modal 打开时隐藏**：开关信号现成——`store.getters['modal/config']` 打开时为 truthy（`Modal.vue:2` 的 `v-if="config"`、`:182-184` mapGetters）。

---

## Z4 — tocAutoJump 开关点死 — 确切根因

### 根因（一句话）

`SideBar.vue:7` 把 action **不带括号**绑给 `@click`，Vue 将原生 `MouseEvent` 作为 payload 传入；toggler 工厂把非 undefined 的 payload 当"目标值"并 `!!value` 强转为 `true`——而 `tocAutoJump` 默认就是 `true`（`src/data/defaults/defaultLayoutSettings.js:13`），"设为 true"与现值相同 ⇒ 不派发 patch ⇒ 状态永远为开，点击无任何效果。

### 证据链

1. `src/components/SideBar.vue:7`：
   `@click="toggleTocAutoJump"`（无括号）+ `v-title="tocAutoJump ? '自动跳转：开' : '自动跳转：关'"`
2. `SideBar.vue:98-101`：`...mapActions('data', ['toggleSideBar', 'toggleTocAutoJump', ...])` ⇒ 组件方法第一参即 dispatch payload ⇒ payload = MouseEvent
3. `src/store/data.js:277`：`toggleTocAutoJump: layoutSettingsToggler('tocAutoJump')`
4. `src/store/data.js:71-82`（工厂）：

   ```js
   const toggleLayoutSetting = (name, value, getters, dispatch) => {
     const currentValue = getters.layoutSettings[name];
     const patch = { [name]: value === undefined ? !currentValue : !!value };
     if (patch[name] !== currentValue) {   // true !== true → false ⇒ 不派发
       dispatch('patchLayoutSettings', patch);
     }
   };
   ```

   `value = MouseEvent`（truthy 对象）⇒ `!!value === true` ⇒ patch 与现值相等 ⇒ 无操作。

### 排除项（都不是原因）

- action 名没写错（data.js:277 存在同名 action）
- computed 读的 getter 正确：`store.getters['data/layoutSettings'].tocAutoJump`（SideBar.vue:93-95）
- `v-title` 是响应式的：`src/main.js:64-73` 的指令有 `updated` 钩子（31fe3372 已迁移 Vue3 钩子）
- 消费方正常：`Toc.vue:42` 跳转后按 `layoutSettings.tocAutoJump` 决定是否收侧栏

### 工作正常的对照（全部带括号或显式实参）

- `ButtonBar.vue:4,7,10,15,18,21`：`toggleNavigationBar()` / `toggleSidePreview()` / `toggleEditor(false)` / `toggleFocusMode()` / `toggleScrollSync()` / `toggleStatusBar()`
- `NavigationBar.vue:6` `toggleExplorer()`；`:13` `toggleSideBar()`
- `SideBar.vue:10` `toggleSideBar(false)`；`Explorer.vue:35` `toggleExplorer(false)`；`Preview.vue:13` `toggleEditor(true)`

**全代码库唯一不带括号的 toggler 绑定就是 SideBar.vue:7。**

附注：data.js:271-276 其它 toggler 写了第二实参（如 `layoutSettingsToggler('showEditor', 'toggleEditor')`），工厂只收一个形参，第二参历来被忽略——`toggleTocAutoJump` 只传一个参数并无问题。

---

## Z5 — 预览列表当前 CSS 事实（batch-2 之后）

### 字号链（"1 个中文字 = 多少 px"）

- `html, body` 基准 16px（`src/styles/base.scss:9`），但预览/编辑面板由**内联 font-size 覆盖**：`Layout.vue:26`（preview）/`:12`（editor）`fontSize: styles.fontSize + 'px'`
- `src/store/layout.js:88-104`：基准 **18px**；`doublePanelWidth < 1120` 减 1 → 17px；`textWidth < 640` 再减 1 → 16px；最后 `× fontSizeFactor`（默认 1，`src/data/defaults/defaultSettings.yml:4`）
- ⇒ **桌面宽屏 1 字 = 18px，中窄 17px，手机 16px**（用户可调 factor）。列表用 px 定缩进就是与"字宽"错位的根源：16px 固定 vs 16~18px 动态字宽

### 列表规则（全部在 base.scss，无其他来源）

| 规则 | 值 | 位置 |
|---|---|---|
| `ul, ol` 缩进 | `padding-left: 16px`（batch-2 ca7a4b67 由 30px 改来） | `base.scss:40-43` |
| L1/L2/L3 marker | 关键字 `disc` / `circle` / `square` | `base.scss:48-58` |
| L4/L5/L6 marker | 字符串 `'\25A1\20'`(□␠) / `'\25C6\20'`(◆␠) / `'\25C7\20'`(◇␠) | `base.scss:60-70` |
| 列表外边距 | `p,…,ul,ol,dl { margin: 0 0 1.1em }`；嵌套列表**也是** `0 0 1.1em` | `base.scss:31-38, 111-116` |
| li 自身 | **无任何全局 padding/margin/li 规则**（`base.scss:333` 的 `li{display:block}` 限定在 `.stackedit__toc` 导出 TOC 内；`.toc ul`/`.preview-toc ul` 为 list-style:none，:222-227/:26-29） | — |
| `list-style-position` | 未设置 ⇒ 默认 `outside` | — |

其它来源核查：`src/styles/` 其余文件无 list-style/padding-left 规则；非默认预览主题动态加载 `/themes/preview-theme-*.js`（`src/store/theme.js:112-131`）可能自带列表样式，默认主题只吃 base.scss。规则同时作用于预览（`.cl-preview-section`）与导出 HTML（`.stackedit__html`）。

### marker 定位机制（CSS 规范事实）

- `outside` 模式下 **marker 盒右缘对齐 li 内容盒左缘**（即文字起点）；文字起点 = ul 的 padding-left 边缘（每级 +16px）
- **字符串型 list-style-type**：字符串就是 marker 文本，按 li 的字体/字号渲染；marker 的 `white-space` 默认保留空格 ⇒ `'\20'` 尾随空格被保留、充当符号与文字的间距（浏览器不再额外加 gap）
- **关键字型 disc/circle/square**：由 UA 绘制的小几何图形（远小于 1em）+ UA 自定间距 ⇒ 这就是 38-list-indent.png 里 L4-6 字形明显大于 L1-3 圆点的原因：□◆◇ 是**正常文本字形（≈1em 高宽）**，且 Lato/Helvetica 不含 Geometric Shapes 区块，字形来自系统回退字体（Windows: Segoe UI Symbol；Android: Noto Sans Symbols）——**各平台大小/粗细会有差异**
- 字符串 marker 宽度（≈1em 字形 + 空格 ≈0.25em ≈ 22px@18px）**大于 16px 缩进**时向左悬挂进上级空间，不会推挤文字（除非撞上 overflow:hidden 祖先才裁切）

### marker 大小的可用旋钮

1. **`li::marker`**：可设属性仅限字体系（`font-size`/`font-family`/`font-weight`…）、`color`、`content`、`white-space`、`direction`/`unicode-bidi`/`text-combine-upright` 及动画——**margin/padding 不生效**。可逐级选择：`ul ul ul ul > li::marker { font-size: .8em }`。支持：Chromium 86+ / Firefox 68+；Safari 部分支持（版本存疑，见 Caveats）
2. **`list-style: none` + `li::before`**：content 字形 + `display:inline-block; width/margin` 全可控（经典兜底，全浏览器）
3. **`@counter-style`**（`symbols` + `suffix` 控制符号与间隔文本）：Chromium 91+ / FF 33+ / Safari 17+（存疑）
4. `list-style-position: inside` 会把 marker 变为首行内联盒（换行不悬挂），几何模型完全不同——仅记录存在

### "marker 占 1 字宽、文字从第 2 字起"的设计输入数据

- 字格宽 = 1em = 16/17/18px（动态，见上）；当前每级台阶 = 固定 16px ⇒ **按字格对齐必须用 em 计（如 padding-left: 2em / 每级 1em 类方案），px 恒错位**
- 文字起点即 padding 边缘；marker 右缘贴文字起点、向左延伸（字形宽+尾随空格）。要"符号正压第 1 字格"，可用数据：符号字形宽 ≈1em（回退字体几何图形通常等宽 1em）、尾随 `\20` 空格宽 ≈0.25em（Lato 空格）——去掉尾随空格或用 `::marker`/`suffix` 控制间距皆可调
- L1-3 关键字圆点尺寸由 UA 决定、无法直接设大小（`::marker font-size` 对关键字型的图形缩放在 Chromium 生效——它按 font-size 比例画点；需实测确认）

### Unicode 候选字符（仅列清单，选型在实现期实测）

菱形（替代/缩小 L5 ◆ U+25C6、L6 ◇ U+25C7）：

| 字形 | 码点 | 名称 | 备注 |
|---|---|---|---|
| ⋄ | U+22C4 | DIAMOND OPERATOR | 小号、数学区，覆盖广 |
| ⬦ | U+2B26 | WHITE MEDIUM DIAMOND | 中号空心，比 ◇ 秀气 |
| ⬥ | U+2B25 | BLACK MEDIUM DIAMOND | 中号实心 |
| ⬩ | U+2B29 | BLACK SMALL DIAMOND | 小号实心 |
| ◈ | U+25C8 | WHITE DIAMOND CONTAINING BLACK SMALL DIAMOND | 装饰感强 |
| ♢ | U+2662 | WHITE DIAMOND SUIT | 扑克花色区，字形圆润 |
| ⟡ | U+27E1 | WHITE CONCAVE-SIDED DIAMOND | 覆盖较差 |

方块（替代/缩小 L4 □ U+25A1）：

| 字形 | 码点 | 名称 | 备注 |
|---|---|---|---|
| ▫ | U+25AB | WHITE SMALL SQUARE | 小号空心，与 L3 square 面积接近 |
| ▪ | U+25AA | BLACK SMALL SQUARE | 小号实心 |
| ◽ | U+25FD | WHITE MEDIUM SMALL SQUARE | **默认 emoji 呈现风险**（需缀 U+FE0E 文本变体，或避用） |
| ◾ | U+25FE | BLACK MEDIUM SMALL SQUARE | 同上 emoji 风险 |

小号圆点系（备用）：• U+2022、◦ U+25E6、· U+00B7、‣ U+2023、▹ U+25B9。

通用备注：这些字形都走回退字体，`li::marker { font-family: ... }` 可锁定字体统一观感；另一条路是保持 □◇ 原字符、仅 `::marker font-size` 缩至与 L3 面积一致（PRD Z5 的验收口径）。

---

## Caveats / Not Found

- **Z1**：截图中白色状态推断为"同步进行中"（spinner 同框佐证），未 live 复现验证；"恒白"场景 2（登录但 isSyncPossible=false）是否实际出现取决于用户工作区状态，未验证。
- **Z2**：结论基于对全 `src/` 的 z-index grep（仅 5 处）与祖先链逐级核查，未运行 DevTools 实测；`html.app--touch` 等移动端规则不引入新层叠上下文（app.scss:25-43 已查）。
- **Z5**：`::marker` 各浏览器版本号、`@counter-style` Safari 支持、关键字 disc 是否随 `::marker font-size` 缩放——出自训练知识，**本会话无 web 搜索工具，实现前请对照 caniuse/MDN 或直接真机验证**（部署目标以 Chromium 桌面 + Android Chrome 为主，上述特性在 Chromium 均可用）。
- 本文件行号快照于 2026-07-11 工作树（有未提交改动：ContextMenu/Editor/Explorer/editorSvc 等，与本研究四题无冲突，但 Z3/Z7 相关文件正在改动中）。
