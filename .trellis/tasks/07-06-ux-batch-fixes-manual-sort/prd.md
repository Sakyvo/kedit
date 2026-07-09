# PRD: 批量 UX 修复与手动排序模式

## 背景

用户在桌面端与移动端（Via 浏览器）实测后反馈的一批 UX 问题与功能改造。基于 StackEdit fork (KEDIT)。
研究文档：`research/sidebar-explorer.md`、`research/editor-modal-scroll.md`。

## 需求清单

### A. 侧边栏 / 工具栏
- A1. 桌面端出现两个同步按钮；"排序方式"按钮导致侧边栏按钮行溢出 → 修复重复按钮，延展侧边栏宽度
- A2. 未登录时点击同步按钮 → 弹窗提示"登录以使用同步功能"
- A3. "插图"按钮移到"重做"按钮右边
### B. 编辑器 / 文件管理
- B4. 移动端点击目录(TOC)跳转时整个目录出现蓝色 tap highlight → 去除
- B5. 新建文件不再包含 "> Written with KEDIT." 模板尾巴
- B6. 回收站文件允许手动永久删除，弹窗确认
- B7. 编辑区"伪标题"（setext 误判）→ 修复
- B8. 重命名/新建节点：不按 Enter 虚化遮罩不消失 → 修复
### C. 弹窗 / 品牌
- C9. 侧栏子面板（文档空间/同步/发布/历史/目录等）点 X 应返回主菜单层级，而非关闭整个侧栏；主菜单层级点 X 才关闭侧栏
- C10. 网站 logo 更换为用户提供的图片（待用户提供文件）
### D. 滚动
- D11. 编辑区滚动条滑块过短难拖 → 设最小滑块长度
- D12. 移动端浏览器"到页面顶部/底部"手势无效 → 修复
### E. 排序面板改造
- E13. 布局：减小横向留白、增大时间/名称两组间纵向距离
- E14. "已选"标记与其他选项对齐
- E15. 方向标记"→"改"-"；"新-旧"= 新在上、旧在下；名称同理
- E16. 新增"手动 [推荐]"选项，置顶且为默认。基于"创建时间 (旧-新)"（旧在上、新在下，用户确认 2026-07-07），允许手动拖拽调整顺序；新建文件从底部出现（自然延续，无特例）
  - 选中"手动"时，排序模式按钮右侧出现"开启/关闭手动排序"开关，仅开启时可拖；修复移动端拖拽不生效

## 确认的事实（代码探索结论）

- **A1 双同步按钮**：`NavigationBar.vue:11`（快捷同步，恒显示）与 `:24`（原按钮，仅当 `styles.hideLocations` 为 true 时隐藏，由 `layout.js:145-147` 按宽度计算，非媒体查询）。桌面端两者同显。侧边栏溢出：7×38px 按钮 + 8px padding = 274px > `explorerWidth: 260`（`layout.js:27`）。
- **A2**：未登录时同步按钮 `:disabled`，`requestSync()`（NavigationBar.vue:148-152）静默无操作。登录判定 `workspace/loginToken`；提示可用 `simpleModal` 模式（`data/simpleModals.js`）；登录动作参照 GitHub PAT 流程（`MainMenu.vue:189-198`）。
- **B4**：`Toc.vue:26-40` 整块 `.toc__inner` 委托点击；全库无 `-webkit-tap-highlight-color`/`touch-action`，浏览器默认蓝框。
- **B5**：`defaultSettings.yml:121-125` 的 `newFileContent`，由 `workspaceSvc.js:31` 应用于所有无初始内容的 createFile。
- **B6**：trash 为虚拟文件夹 id `'trash'`（explorer.js:116-122）；目前 trash 内删除只弹 info 弹窗，无永久删除。7 天自动清理在 `localDbSvc.js:415-423` / `syncSvc.js:917-929`。确认弹窗用 `simpleModal(msg,'取消','确认删除')` 模式。
- **B7 伪标题根因**：编辑器语法 `markdownGrammarSvc.js:97-108` 的 setext 规则为纯正则（`/^.+\n[-]{2,}[ \t]*$/gm`）且优先于 ATX/hr 规则；`# Title` + `---` 被编辑器渲染成巨大 setext h2，预览正确。编辑器语法亦无 front matter 规则。
- **B8 根因**：新建/重命名输入框的 `v-focus` 指令用 Vue2 钩子 `inserted` 注册（`main.js:50-58`），但项目跑在 Vue 3.5 → 钩子永不触发 → 输入框未聚焦 → 点外部无 blur → 遮罩 `.explorer__tree--new-item` 不消失。改为 `mounted` 并审计其他 Vue2 指令钩子。
- **C9 机制**（用户澄清 2026-07-07）：SideBar.vue:4-12 子面板标题栏左侧 `⋯`(icon-dots-horizontal) 为"返回主菜单"，右侧 X 为"关闭侧栏"。改动：子面板 X → `setPanel('menu')`，主菜单 X → `toggleSideBar(false)`；左侧 `⋯` 按钮冗余，移除。与 modal 栈无关，不改弹窗逻辑。
- **C10 logo 位置清单**：`src/assets/logo.svg`（Splash+About）、`src/assets/favicon.png`（favicon+PWA manifest, vite.config.js）、`src/assets/iconKedit.svg`（icons/Provider.vue:57）、`static/landing/logo.svg` + `favicon.ico`。
- **D11**：编辑器滚动容器 `.editor`（Editor.vue:165-170），预览 `.preview__inner-1`；全局 webkit 滚动条样式在 `app.scss:22-47`（8px，无 thumb min-height）。可用 `::-webkit-scrollbar-thumb { min-height }`，浏览器自动处理位移映射。
- **D12 根因**：`body { position: fixed; overflow: hidden }`（app.scss:3-16），窗口滚动范围为 0，浏览器"到顶/到底"手势作用于窗口滚动，故无效。
- **E13-15 排序面板**：非独立组件，是共享 ContextMenu（`Explorer.vue:154-179` 生成 6 项；"已选"是字面 `● `/全角空格前缀导致不齐；项内边距 `padding: 0 25px` 于 ContextMenu.vue:55-60）。排序状态 `sortBy/sortDirection`（explorer.js:87-88）**未持久化**，刷新即失。
- **E16**：现有拖拽只改 parentId（`ExplorerNode.vue:169-182`），无位置插入；纯 HTML5 drag 事件，移动端 touch 不触发。若给文件项加 `order` 字段会改 `getItemHash`（utils.js:146-154）引发同步扰动；更安全方案是 folderId→有序 id 列表的独立映射。

## 验收标准

- [ ] A1: 桌面端仅一个同步按钮；侧边栏按钮行不换行不溢出，关闭按钮可见
- [ ] A2: 未登录点同步弹窗"登录以使用同步功能"，可跳转登录入口
- [ ] A3: 插图按钮位于重做按钮右侧
- [ ] B4: 移动端点 TOC 无蓝色高亮框，跳转正常
- [ ] B5: 新建文件内容为空
- [ ] B6: trash 内文件可"永久删除"，需确认弹窗，删除后不可恢复
- [ ] B7: `# 标题` 下接 `---` 等场景编辑区不再显示伪 setext 标题，与预览一致
- [ ] B8: 新建/重命名时点击输入框外部即提交/取消，遮罩消失
- [ ] C9: 子面板点 X 返回主菜单；主菜单点 X 关闭侧栏；左侧 ⋯ 按钮移除
- [ ] C10: 所有 logo 位置（favicon/PWA/splash/about/landing）替换为新图
- [ ] D11: 长文档下滚动条滑块 ≥ 最小长度（约 40px），拖拽可用
- [ ] D12: 移动端浏览器"到页面顶部/底部"手势可滚动编辑区
- [ ] E13-15: 排序菜单紧凑、选中项对齐、方向文案为"新-旧"式且语义=左侧在上
- [ ] E16: "手动 [推荐]"置顶默认；开关开启时可拖拽排序（含移动端 touch）、跨文件夹移动；新建文件出现在底部；顺序持久化

## 范围外

- 回收站自动清理策略调整（保持 7 天）
- 同步冲突策略、其他浏览器兼容专项

## 已决策

- **E16 持久化**（用户确认 2026-07-07）：手动顺序**随工作区同步**——存为独立 data 条目（`folderId → 有序文件 id 列表`映射，类似 settings 的同步方式），不给文件项加字段，避免 `getItemHash` 变化引发同步扰动。当前排序模式（手动/时间/名称+方向）一并持久化于该条目。
- **C9 方案**（用户澄清 2026-07-07）：子面板 X → 返回主菜单，主菜单 X → 关闭侧栏；左侧 ⋯ 返回按钮移除。
- **D12 方案 a**（用户确认 2026-07-07）：代理滚动——仅移动端给窗口造 2px 滚动区间、滑块常驻中间；窗口滚到 0 → 编辑区到顶，滚到 max → 到底，随后回中；用 `overscroll-behavior` 压制下拉刷新干扰。真机 Via 验证；若手势不作用于窗口则回退方案 c（EditorInPageButtons 加到顶/到底按钮）。
- **A3 机制**：「插图」即工具栏"图片"按钮（`data/pagedownButtons.js` 的 `image` 项，NavigationBar.vue:37-42 渲染）；重排数组使其紧跟"重做"之后。

## 开放问题

（无——全部已决策）

## 设计注记（实现时生效，用户可否决）

- **E16 基线语义**（用户确认 2026-07-07）：手动模式基线 = 创建时间 **旧-新**（旧在上、新在下）；首次启用时按此快照存序，之后新建文件追加底部即自然延续，无特例。
- E16 移动端手势冲突解决：手动排序开关**开启**时，长按节点=开始拖拽（抑制长按上下文菜单）；开关**关闭**时长按=上下文菜单（现状）。
- E16 开关不持久化：每次加载默认关闭（防误拖），拖拽仅开启时可用；开关关闭时 manual 模式下完全禁拖（非 manual 模式维持现有"拖入文件夹"行为）。
- E15 排序模式/方向持久化到 localSettings（每设备），手动顺序 map 随工作区同步（`explorerOrder` data 条目）——此 fork 中 settings 云同步本就被禁用（syncSvc.js:770-772），故模式不跨设备同步是既有惯例。
- B6 范围：仅提供逐文件"永久删除"（trash 内右键/长按菜单 + `simpleModal` 确认）；不做"清空回收站"。
- B8 附带收益：`v-title` 指令同样因 Vue2 钩子失效（tooltip 一直未生效），一并修复。
- C10 源图已留档：`research/assets/logo-source.png`（1254×1254 PNG，来自 C:\Users\ASUS\Desktop\a27450a8-a538-4987-aba1-c047fa6748c4.png）。
