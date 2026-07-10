# Design: 第二批 UX 修复

基线：Vue 3.5 + Vuex 4，验证 = `npm run build` + dev 手测。研究依据 `research/sync-explorer.md`、`research/images-editor-toc.md`。

## 1. M1 explorerOrder 路径化（缺陷修复，最高优先）

- **根因**：map 以本地 Vuex id 为键，git 型主空间每设备对同一文件随机生成 id（gitWorkspaceSvc.js:65），跨设备互不相识；materializeOrder 压缩把外来 id 当失效剔除并回传本机序，双端互覆。
- **新数据形状**：`{ version: 2, orders: { [parentKey]: string[] } }`；`parentKey` = 父 folder 的 git 路径（`gitPathsByItemId`），根用 `'root'`；数组元素 = 子项 git 路径。读到无 `version` 的旧数据一律视为空（旧数据本就跨端无效，自动重物化，无迁移成本）。
- **转换层**：读写边界统一经 `gitPathsByItemId` / `itemIdsByGitPath`（store/index.js 既有 getter）：sortChildren 排序时 childId→path 查 index；drop/append/materialize 写入时 id→path。无 git 路径的项（理论不存在于主空间）回退追尾。
- **顺带修复**（research 发现的两个数据项同步小 bug，syncSvc.js）：数据项首次上传时 syncData 丢 `id` 字段落到 `"undefined"` 键；syncData 内嵌整份 data 造成冗余——修复为带 id、只存 hash。
- **验收**：设备 A 拖动排序 → 同步 → 设备 B（同账号）刷新同步后顺序一致；`.stackedit-data/explorerOrder.json` 内容为路径键。

## 2. S 组：同步按钮统一（仅显示层）

- **S2 合并**：删除 hideLocations 组内的白色 `--sync` 按钮；`--sync-quick` 移除 `v-if="styles.hideLocations"` 恒显示（编辑+预览、桌面+移动）。位置组内的同步位置图标与"立即发布"保留。
- **S1 状态判定重写**：弃用 `lastSyncSuccess`/`updatedOn` 启发式。新 getter（复用 syncSvc.js:784-819 判据）：当前文件 content hash === 其 syncData hash → `synced`(绿)；不一致 → `unsynced`(红)；`isSyncRequested||正在同步` → `syncing`。打开未编辑文件 = 绿。
- **S2 旋转**：补 `--syncing` CSS（icon 360° 旋转动画，linear infinite）。
- **S3**：状态类无尺寸差（已核），实现时 devtools 对比红/绿实测；若真有差异多半来自 disabled 态或相邻元素，就地修。
- **S4**：随 S2 恒显示自然覆盖预览模式。

## 3. I 组：图片对话框与编辑区图片

- **I1**：ImageModal 移除"取消"按钮；X（reject）路径补 `callback(null)` 语义（修 pagedown 焦点恢复不执行 + unhandled rejection——在 modal open 的 catch 里调）。
- **I2/I4**：确认时按 `,`/换行拆分多 URL → 多条 `![输入图片说明](url)` 以 `\n` 连接插入。pagedown doLinkOrImage 回调改为可接受数组（pagedown.js:799-840 单点扩展）。
- **I3**：file input 加 `multiple`；选择后逐个 `imageSvc.updateImg` 上传，全部成功即直接以多图 markdown 插入并关闭弹窗（不再回填 URL 框）；部分失败：成功的插入、失败的 notification 提示。
- **I5**：编辑区放大命中从 `.img-wrapper` 收窄为仅 IMG 元素（Editor.vue:52-54 findZoomableImage，对照 Preview.vue:134）。
- **X1**：imgCache 修复（editorSvc.js:670）：空 src 不入缓存 + URI 参与缓存 key（双保险，保留防闪烁收益）。

## 4. T 组：目录面板

- **T1**：`.toc__inner` 字号 13px→15px、容器左右 padding 20px→8px、各级 margin-left 约按 2/3 缩小（实现时目测微调）。
- **T2**：SideBar.vue X 分支：`panel === 'menu' || panel === 'toc'` → `toggleSideBar(false)`（TOC 例外直接关闭回文档，其余子面板维持返回主菜单）。新增"自动跳转"开关按钮：仅 toc 面板显示、位于 X 左侧；新画单 path SVG 图标（准星/定位隐喻）；状态存 layoutSettings（data.js:70-81 toggler 工厂，默认 true）；开启时 Toc.vue 点击跳转后（:36-37）`toggleSideBar(false)`。按压态样式沿用 `--on` 模式。

## 5. R1 + M2 + G4：菜单与工具栏视觉

- **R1**：trash 文件菜单移除"删除"，仅留"永久删除"；ContextMenu 两个渲染分支加 `:class="item.className"`（opt-in），新 CSS `context-menu__item--danger`（红字），"永久删除"传入。
- **M2**：开关默认（禁用）态完全无背景；启用态维持深背景并提高对比（背景加深 + opacity 1）。图标从 iconMenu 换为新"四向移动箭头"（arrow-all）单 path SVG 组件。
- **G4**：ExplorerNode 特殊节点着色：trash 红、temp 黄（label 颜色 class，日夜间主题各给色值）。

## 6. G 组：imgs 特殊文件夹与"移动到"弹窗

- **G3 imgs 特殊化**：nodeStructure 构树时识别顶层 `imgs` 文件夹（git path `imgs`）→ 标记 `isImgs`：从主树摘出、置于 temp 节点下方、蓝色、`noDrag/noDrop`、点击不展开而是 `simpleModal`（"是否跳转到 GitHub 数据仓库的图片目录？"）→ 确认后 `window.open(githubAppDataProvider.getFilePathUrl('imgs'))`（owner=token.name）。其日期子树不再渲染。
- **G1**：imgs 及其后代从"移动到"目标集中排除（无论菜单还是弹窗实现）。
- **G2 移动到弹窗**：新建 `FolderPickerModal`（`${Type}Modal` 约定注册）：固定居中弹窗、嵌套树默认全展开、超高滚动、右上 X 关闭；点击文件夹立即选定并执行移动（复用现 perform 的 storeItem 逻辑）；根目录为首项；排除 trash/temp/imgs 及被移动项自身子树。ExplorerNode"移动到"改 `modal/open`。

## 7. U1 下划线语法移除

- 预览：markdownExtension.js 包装 `md.inline.ruler.at('emphasis', wrapped)`——tokenizer 入口遇 `0x5F`（_）直接返回 false，`*` 原样放行（深层 import 原 emphasis 规则）。`_em_`、`__strong__` 全部失效为普通文本。
- 编辑器：markdownGrammarSvc.js:323-354 四条含 `_` 的 em/strong/混合规则删除 `_` 分支（保留 `*` 系）。
- 验收：`_a_`、`__b__`、`snake_case_name` 编辑与预览均为普通文本；`*a*`、`**b**` 不受影响。

## 8. H1 标题梯度 + N 列表样式（预览为主）

- **H1**：编辑区（markdownHighlighting.scss:189-213）1.7/1.4/1.2/1.1/1.0/0.9 → **1.5/1.4/1.3/1.2/1.1/1.05**（h1 略大于 h2，h6 > 正文）；预览 base.scss 新增同梯度显式规则（限定预览容器作用域）；核对导出 HTML 模板样式来源，若复用则一致生效，不复用则同步补。
- **N1**：预览 `ul,ol { padding-left: 30px→16px }`（≈一个汉字）。
- **N2**：预览 li 按嵌套深度定义 6 级 marker：1 `disc`、2 `circle`、3 `square`、4 `'□ '`、5 `'◆ '`、6 `'◇ '`（4-6 用 `li::marker { content }` 字符串；现代浏览器均支持）。编辑区为纯文本高亮，不动。

## 9. B1 自定义滚动条（新组件）

- `CustomScrollbar.vue`：props 传目标滚动元素；渲染右缘覆盖 track+thumb（宽 8px，thumb 最小 48px，比例映射含 min 修正）；`pointerdown` thumb → `setPointerCapture` → pointermove 按比例驱动 `scrollTop`——**捕获后指针移到任何位置都持续拖动**（鼠标+触摸统一 pointer events）；track 空白点击 = 翻页；监听目标 scroll + ResizeObserver（内容/容器尺寸变化重算）。
- 挂载于 Editor.vue（`.editor`）与 Preview.vue（`.preview__inner-1`）；这两容器原生条隐藏（scrollbar-width:none + ::-webkit-scrollbar:none，选择器严格限定）；D12 代理滚动逻辑不受影响（其驱动的是 scrollTop，本组件只是显示+输入层）。
- 样式与现主题滚动条观感一致（颜色沿用 app.scss 变量），常显不自动隐藏（简单可靠）。

## 兼容与回滚

- explorerOrder v2 形状对旧客户端：旧端读到 `version` 键会当普通条目忽略其 orders（旧代码取 `map[parentId]` 得 undefined → 回退 createdOn），不崩溃；新端忽略旧形状。单向升级，无迁移。
- 各组互相独立，单 commit 内 hunk 可独立 revert；B1 出问题时移除组件挂载 + 还原两行隐藏原生条 CSS 即回退。
- 风险点：① B1 拖动映射与 D12/滚动同步的叠加（组件只读写 scrollTop，理论正交，真机验证）；② U1 拦截 tokenizer 对既有文档中 `_` 语法内容的显示变化（预期行为，用户已确认）；③ G3 依赖 token.name 构 URL（未登录时点击 imgs → 提示需登录，降级处理）。
