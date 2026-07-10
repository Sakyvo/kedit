# Design: 批量 UX 修复与手动排序模式

技术栈基线：Vue 3.5 + Vuex 4（Options API，Vue2 遗留写法混存）、Vite 构建（无 lint/test 脚本，验证 = `npm run build` + `npm run dev` 手测）。

## 1. E13-E16 排序改造（核心）

### 1.1 状态模型
- `store/explorer.js`：`sortBy` 取值扩为 `['manual','name','updatedOn','createdOn']`，`manual` 忽略 `sortDirection`。默认 `sortBy: 'manual'`。
- 新增 `manualSortEnabled`（boolean，默认 `false`，仅内存不持久化——每次进入会话都是"上锁"状态，防误拖）。
- 排序模式持久化（每设备）：`localSettings` 增加 `explorerSortBy` / `explorerSortDirection`；explorer store 初始化时读取，setSortBy/setSortDirection 时回写（`data/patchLocalSettings`）。

### 1.2 手动顺序数据（随工作区同步）
- 新 data 条目 `explorerOrder`，结构 `{ [parentId]: string[] }`（parentId 为 folder id 或 `'root'`；数组内 files 与 folders 混存 id）。
- `store/data.js`：`empty()` 加 case（默认 `{}`），加 getter `explorerOrder` + `patchExplorerOrder`（patcher）。存于 `itemsById`（IndexedDB，非 localStorage）。
- 同步：`syncSvc.js:768-773` 主工作区块内加 `await syncDataItem('explorerOrder')`。对象冲突走既有 `diffUtils.mergeObjects` 按 key 合并。非 main 工作区（git 类）不同步该条目，仅本地生效——与 settings 现状一致，可接受。
- **急切物化**：应用启动后首次构建 nodeStructure 且 `sortBy==='manual'` 时，对无 map 条目的 parent，按"创建时间 **旧-新**"（createdOn asc，旧在上）快照写入 map（一次性 patch，避免每次 getter 里写 store——物化放 action，由 Explorer 挂载/结构变化时触发）。新建文件追加底部即自然延续此序。
- **新建文件落底**：`workspaceSvc.createFile/storeItem` 后若 manual 模式，把新 id append 到其 parent 数组尾部。
- **排序应用**：`Node.sortChildren` 当 manual：按 map[parentId] 的 index 排；不在 map 中的 id 追加尾部（其间按 createdOn asc）；folders 仍恒排在 files 上方（两组各自按 map 相对顺序）。trash/temp 保持现有 compare（updatedOn desc）。
- **删除清理**：文件永久删除/清 trash 时从 map 中移除 id（惰性清理亦可：sortChildren 时过滤不存在 id，物化 patch 时顺带压缩）。

### 1.3 拖拽（桌面 + 移动）
- 语义：`sortBy!=='manual'` → 维持现状（HTML5 拖入文件夹重设 parentId）。`manual && !manualSortEnabled` → 完全禁拖（`draggable=false`）。`manual && manualSortEnabled` → 位置拖拽：
  - drop 目标为节点上半 → 插其前；下半 → 插其后；文件夹节点中部 1/3 → 移入该文件夹尾部。跨 parent 时同时改 `parentId` + 两个 map。
  - 文件拖到 folders 组区间 → 位置钳制到 files 组边界（folders 恒在上，不打破分组）。
- 移动端 touch 拖拽（HTML5 drag 事件 touch 不触发）：`manual && manualSortEnabled` 时长按节点 ≈350ms 进入拖拽（此状态下抑制长按上下文菜单），touchmove 显示浮影 + 目标高亮（复用 drag-target 样式），接近容器上下边缘自动滚动，touchend 落点执行与桌面同一 drop 逻辑。封装为 ExplorerNode 内的小型 touch-drag 处理（复用现有 onTouchStart 计时器结构）。
- 开关按钮：Explorer 工具栏排序按钮右侧，仅 `sortBy==='manual'` 时显示，图标区分锁定/解锁两态。

### 1.4 排序菜单 UI（E13-15）
- `Explorer.vue openSortMenu`：选项重排为：`手动 [推荐]`（顶部）、分组间距、`名称 (A-Z)/(Z-A)`、`修改时间 (新-旧)/(旧-新)`、`创建时间 (新-旧)/(旧-新)`。"新-旧"= 新在上（`desc`，stamp 大者在前——与现 compare 一致，实现时逐项真机核对渲染顺序与文案一致）。
- ContextMenu 增强（共享组件，向后兼容）：item 支持 `selected: true` 标志 → 渲染固定宽度选中列（替换 `● `/全角空格前缀 hack），任一 item 有该字段时全列表启用对齐列；支持 `type: 'separator'` 或分组 gap 用于纵向间距；支持调用方传紧凑 class（横向 padding 25px → ~12px，减小 min-width）。仅排序菜单启用新样式，节点右键菜单不变。
- 注：legacy 文件可能缺 `createdOn`（getStamp 回退 0 → 按名称次序），物化快照同样受此影响，可接受。

## 2. A1/A2/A3 导航栏与侧边栏

- **A1a 双同步按钮**：NavigationBar.vue:11 快捷同步按钮加 `v-if="styles.hideLocations"`（只在原按钮组隐藏时顶替，恢复其"移动端专用"初衷）。
- **A1b 侧边栏溢出**：`layout.js:27 explorerWidth: 260 → 300`；Explorer 工具栏按钮 38px → 36px（新增手动开关后 8×36+8=296 ≤ 300）。核对 `notEnoughSpace`/移动端布局不受影响（移动端 explorer 宽度另有样式则不动）。
- **A2 未登录点同步**：同步按钮当 `!loginToken` 时不再 `:disabled`，点击弹 `simpleModal`："登录以使用同步功能"，按钮 [取消 / 登录]；[登录] 复用 MainMenu.vue:189-198 的 GitHub PAT 登录流程（抽成共享 action 或直接 dispatch 同一 modal 链）。已登录但无同步位置 → 维持现状 disabled。两个同步按钮（原+快捷）行为一致。
- **A3 插图按钮**：`data/pagedownButtons.js` 中 `image` 项移到数组首（首个 `{}` spacer 之前），使其紧跟"重做"。

## 3. B 组编辑器/文件管理修复

- **B4 tap highlight**：全局 `html { -webkit-tap-highlight-color: transparent }`（app.scss）；`.toc__inner` 加 `user-select: none`。不影响编辑区文本选择。
- **B5 新文件模板**：`defaultSettings.yml newFileContent` 改为空（保留键，值 `''`）；核对 `workspaceSvc.js:31` 对空串路径（`text` 参数缺省 → 取设置值 `''`，`createFile` 后内容为空）。
- **B6 回收站永久删除**：ExplorerNode 上下文菜单对 trash 内文件增加"永久删除"项 → `simpleModal('该操作不可恢复…','取消','确认删除')` → 复用 7 天自动清理的删除原语（`localDbSvc.js:415-423` 所用 store 删除路径：移除 file+content 项）；远端联动依赖既有 syncData 清理（本地 item 消失 → `syncSvc` 移除远端）。仅文件级，不做"清空回收站"。
- **B7 伪标题**：`markdownGrammarSvc.js:97-108` setext h1/h2 正则加负向前瞻，排除首行本身是 ATX 标题/引用/列表/围栏/表格行的情形（`/^(?!(?:#{1,6}[ \t]|>|(?:[-*+]|\d+\.)[ \t]|```|\|)).+\n[-]{2,}[ \t]*$/gm`，h1 同理 `=`）；并为编辑器语法补 front matter 规则（仅文档首 `---…---`，与预览 `markdownExtension.js:78` 同开关）。验收对照：`# 标题`+`---`、front matter、正常段落+`===`。
- **B8 指令钩子**：`main.js` `v-focus: inserted → mounted`；`v-title: bind → mounted, update → updated`；grep 全库其余 Vue2 指令钩子（`vueGlobals.js` 等）一并迁移。修复后：新建/重命名输入框自动聚焦，点外部 blur → `submitNewChild`/提交重命名 → 遮罩消失；v-title 工具提示恢复。

## 4. C9 侧栏层级返回

- SideBar.vue：移除左侧 `⋯`(主菜单) 按钮；X 按钮逻辑：`panel === 'menu' ? toggleSideBar(false) : setPanel('menu')`，v-title 相应二态（"返回主菜单"/"关闭侧边栏"）。TOC 面板同规则。

## 5. C10 Logo 替换

源图 `research/assets/logo-source.png`（1254×1254 RGBA）。PIL 生成：
- `src/assets/favicon.png`（512×512，覆盖）→ vite favicon 注入 + PWA manifest 自动生效。
- `src/assets/logo.png`（新增，~600px）：`app.scss:346 .logo-background` 的 `url(logo.svg)` 改指 png（Splash+About 生效）；删除或保留旧 svg 不引用。
- `iconKedit.svg`：改为内嵌 base64 `<image>` 的 svg 或将 `icons/Provider.vue:57` 换 `<img>` 渲染新 png（取实现时更整洁者）。
- `static/landing/logo.svg` → 替换为 png 引用；`static/landing/favicon.ico`（含 16/32/48）由 PIL 生成覆盖。

## 6. D11/D12 滚动

- **D11**：app.scss 滚动条样式加 `::-webkit-scrollbar-thumb { min-height: 48px; min-width: 48px }`（浏览器原生处理位移映射，无需 JS）。
- **D12 代理滚动（仅触屏设备）**：
  - 检测 `('ontouchstart' in window)` → html 加 class `app--touch`。
  - CSS：`html.app--touch { height: calc(100% + 2px); overflow-y: auto; }`（body 维持 fixed 不动）→ 窗口获得 2px 滚动区间；`scrollbar-width: none` 隐藏窗口滚动条。
  - JS（editorSvc 或 App 挂载处）：`window.scrollTo(0,1)` 驻中；`scroll` 监听：`scrollY===0` → 活动滚动容器（编辑器或预览，按当前布局）scrollTop=0；`scrollY>=2` → 滚到底；随后 `scrollTo(0,1)` 回中。
  - 所有内部滚动容器（editor/preview/side-bar/explorer）加 `overscroll-behavior: contain`，阻断链式滚动误触发（同时压制下拉刷新）。
  - 真机 Via 验证；若手势不作用于窗口 → 回退方案 c（EditorInPageButtons 增加到顶/到底按钮），代理滚动代码移除。

## 兼容与回滚

- `explorerOrder` 为新增 data 条目：旧客户端不读不写、远端多一个文件，无破坏；回滚 = 去掉 syncDataItem 调用即可。
- 全部改动集中于前端展示/交互层与一个新 data 条目，无内容数据迁移；单 commit，git revert 可整体回滚。
- 风险点：① 移动端 touch 拖拽与长按菜单/滚动手势的冲突（用开关态隔离：开=拖拽、关=菜单）；② D12 依赖浏览器手势实现（有回退方案）；③ ContextMenu 是共享组件（新增能力全部 opt-in，默认渲染不变）。
