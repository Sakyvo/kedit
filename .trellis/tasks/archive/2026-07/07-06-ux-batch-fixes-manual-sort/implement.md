# Implement: 批量 UX 修复与手动排序模式

执行顺序按"独立小修 → 结构改动 → 核心功能"排列，每步可独立验证；风险最高的 E16 放最后。

## 阶段 1：独立小修（互不依赖）

- [ ] 1.1 B8 指令钩子迁移：`src/main.js` `v-focus inserted→mounted`、`v-title bind→mounted / update→updated`；grep `inserted(|bind(|componentUpdated(` 全库审计其余 Vue2 钩子（含 `src/components/common/vueGlobals.js`）。验证：新建/重命名自动聚焦选中文本；点击外部遮罩消失；悬停按钮出现 tooltip。
- [ ] 1.2 B5 新文件模板：`src/data/defaults/defaultSettings.yml` `newFileContent` 置空；验证新建文件内容为空（含 explorer 新建与欢迎文件不受影响）。
- [ ] 1.3 A3 插图按钮：`src/data/pagedownButtons.js` 将 `image` 项移至数组开头（spacer `{}` 之前）；验证工具栏顺序 回退|重做|图片|…。
- [ ] 1.4 B4 tap highlight：app.scss 全局 `-webkit-tap-highlight-color: transparent`；`.toc__inner { user-select: none }`；验证（移动端 devtools 模拟 + 真机）点 TOC 无蓝框，编辑区仍可选文本。
- [ ] 1.5 D11 滚动条：app.scss `::-webkit-scrollbar-thumb` 加 `min-height/min-width: 48px`；验证长文档拖拽。
- [ ] 1.6 C9 侧栏 X：`SideBar.vue` 移除 ⋯ 按钮；X 二态逻辑 + v-title 二态；验证：文档空间→X→主菜单→X→侧栏关闭；TOC 面板同。
- [ ] 1.7 A1 双同步按钮 + 宽度：NavigationBar.vue:11 加 `v-if="styles.hideLocations"`；`layout.js explorerWidth 260→300`；Explorer 工具栏按钮 38→36px。验证：桌面仅一个同步按钮；窄窗口出现快捷按钮；侧边栏按钮单行含关闭按钮完整可见。
- [ ] 1.8 C10 logo：PIL 脚本从 `research/assets/logo-source.png` 生成 favicon.png(512)/logo.png/favicon.ico(16,32,48)；改 `.logo-background` 引用、`icons/Provider.vue` kedit 图标、`static/landing/` 引用。验证：dev 页 favicon/splash/about/侧栏切换按钮/landing 全部新图。

## 阶段 2：中等改动

- [ ] 2.1 B7 伪标题：`markdownGrammarSvc.js` setext h1/h2 正则加负向前瞻 + 编辑器语法补 front matter 规则。验证用例：`# 标题`+`---`（编辑=标题+hr）；文档首 front matter（编辑区弱化显示，非 h2）；`段落`+`===`（仍 setext h1）；`段落`+`---`（仍 setext h2）；列表项后 `---`（hr 不成标题）。
- [ ] 2.2 A2 未登录同步提示：`data/simpleModals.js` 加 `signInForSync` 条目（[取消/登录]）；NavigationBar 两个同步按钮 `!loginToken` 时可点击 → 弹窗 → 登录复用 GitHub PAT 流程（MainMenu.vue:189-198 逻辑抽用）。验证：未登录点两处同步均弹窗，登录后恢复正常同步；已登录无位置仍 disabled。
- [ ] 2.3 B6 回收站永久删除：ExplorerNode 上下文菜单 trash 内文件加"永久删除"→ simpleModal 确认 → 复用 localDbSvc 自动清理删除原语；同步工作区验证远端文件同被删（syncData 清理路径）。
- [ ] 2.4 D12 代理滚动：touch 检测加 `app--touch` class + CSS 2px 窗口滚动区间 + scroll 监听驻中逻辑（作用于当前活动滚动容器 editor/preview）+ 全部内滚容器 `overscroll-behavior: contain`。验证：桌面无任何变化；真机 Via 长按前进/后退跳编辑区顶/底（**需用户真机验收**，失败则回退方案 c）。

## 阶段 3：排序改造（E13-16，一体实现）

- [ ] 3.1 状态与持久化：explorer store `sortBy` 扩 `manual`（默认）、`manualSortEnabled`；localSettings 加 `explorerSortBy/explorerSortDirection` 并接通读写；`data.js` 加 `explorerOrder` getter/patcher/empty case；`syncSvc` main 块加 `syncDataItem('explorerOrder')`。
- [ ] 3.2 排序应用与物化：`Node.sortChildren` manual 分支（map index 排序、缺失 id 按 createdOn asc 追尾、folders 恒在上）；启动/结构变化时急切物化快照（创建时间 旧-新，createdOn asc）；`createFile` 后 manual 模式 append 尾部；删除时清理 map。
- [ ] 3.3 排序菜单 UI：ContextMenu 支持 `selected` 对齐列 + 分组间距 + 紧凑 class（全部 opt-in）；`openSortMenu` 重排选项（手动 [推荐] 置顶）+ "新-旧"文案；逐项核对文案与实际渲染顺序一致（含 legacy 无 createdOn 文件的回退行为记录）。
- [ ] 3.4 桌面位置拖拽：ExplorerNode drop 位置检测（上半/下半/文件夹中部）；manual+开关开 → 位置插入与跨文件夹移动（双 map 更新 + parentId）；manual+开关关 → 禁拖；非 manual → 现状不变。
- [ ] 3.5 移动端 touch 拖拽：长按 350ms 进入拖拽（抑制上下文菜单）、浮影 + 目标高亮、边缘自动滚动、touchend drop 复用 3.4 逻辑。
- [ ] 3.6 开关按钮：Explorer 工具栏排序按钮右侧，仅 manual 显示，两态图标 + v-title。
- [ ] 3.7 综合验证：拖拽重排刷新后保序；另一浏览器 profile 同一账号同步后顺序一致；新建文件落底；切"名称"排序再切回"手动"顺序不丢；移动端 devtools touch 模拟 + 真机拖拽；trash/temp 不可拖不受影响。

## 全局验证

- `npm run build` 通过（唯一 CI 门槛，无 lint/test 脚本）。
- `npm run dev` 手测回归清单 = prd.md 验收标准逐项。
- 移动端项（B4/D12/3.5）需用户真机（Via）最终确认。

## 风险与回滚点

- 阶段 1/2 每项独立，可单独 revert hunk。
- 阶段 3 集中在 explorer store/组件 + data.js/syncSvc 少量插入；若手动排序出问题，回滚 = sortBy 默认改回 `updatedOn` + 隐藏菜单项，`explorerOrder` 条目留存无害。
- 风险文件：`src/store/explorer.js`（核心 getter 重写）、`src/components/ExplorerNode.vue`（拖拽双路径）、`src/services/syncSvc.js`（仅 +1 行调用，但位于同步主循环）。
