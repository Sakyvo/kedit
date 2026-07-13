# PRD: 第四批：移动拖拽/滚动条命中/同名保护/重命名同步/未引用图片清理

## 背景

07-11 上线后的第四轮反馈：2 个上批交付缺陷（W1 移动拖拽、W2 滚动条命中）、2 个数据安全问题（W3 同名覆盖、W4 重命名同步重复）、1 个新功能（W5 未引用图片清理）、1 个语法决策（W6 setext）。证据：`research/assets/41-setext-again.png`。

## 需求清单

- **W1. 移动端触摸拖拽无效**（07-06 交付缺陷）：开启"移动"开关后，长按拖到目标位置松手，文档顺序无变化；且开关开启时长按仍弹出上下文菜单子框（设计本应抑制）。→ 触摸拖拽路径疑似整体未生效，需真因排查修复。
- **W2. 滚动条伪碰撞箱**（07-10 交付缺陷）：CustomScrollbar 轨道占满右缘全高，手指在页面底部点右缘按钮（如预览"眼睛"）被轨道拦截，页面抽搐且未进预览。→ 命中区域应只有"可见的滑块部分"。
- **W3. 同名文件保护**：同目录下创建/重命名同名文件应自动加 `(1)` `(2)` 后缀；移动到已有同名文件的目录同理，不允许覆盖。
- **W4. 重命名同步重复**：A 重命名为 B 后自动同步会把云端 A 拉回来（A、B 并存）。→ 需"重命名墓碑"：记录旧路径，同步时匹配墓碑的远端路径不再下行恢复，并推送远端删除。
- **W5. 未引用图片检测与删除**：
  - 自动：一张图片连续 3 天未被任何文档引用 → 从仓库永久删除。
  - 手动：主菜单"打印"下方新增"图片引用检测"：扫描所有文档，列出未引用图片（左复选框+右预览图；左上全选、右上 X 关闭），支持全选/自选后删除。
- **W6. setext 伪标题仍在**（41 图）：普通文字上一行 + `---` 仍成大标题——这是 setext 语法本身。待决策：是否全面禁用 setext（编辑+预览一致，`---` 恒为分隔线）。

## 确认的事实（代码探索结论，详见 research/*.md）

- **W1 根因链**：07-06 的长按抑制只移除了 500ms JS 定时器，但 Android 长按会派发原生 `contextmenu` 事件，命中 ExplorerNode.vue:2 无门控的 `@contextmenu` → 全屏遮罩菜单（z:300）→ 毒化 `updateTouchTarget` 的 `elementFromPoint` → `dragTargetId` 写不进 → `executeManualDrop` 因 isNil 静默返回。次因：350ms 等待期不 preventDefault，浏览器滚动接管派发 touchcancel 杀拖拽。注意 `manualSortEnabled` 为内存态，移动端标签页重载归 false。
- **W2 根因**（已核实）：CustomScrollbar 轨道为右缘 8px×**全高**条带（z:1, touch-action:none），`@pointerdown` 即翻页 0.9 屏（"抽搐"）并吞掉该次触摸；ButtonBar 26px 按钮列（含"阅读模式"眼睛及底部对焦/滚动同步键）紧贴轨道，属**相邻拦截**；真 z-index 覆盖仅阅读模式的 preview__corner 铅笔按钮（右 8px 被盖）。修法：轨道 `pointer-events:none`、滑块 `auto`（滑块拖动靠 setPointerCapture 不受影响）；代价=轨道空白翻页取消（全库无 (pointer:fine) 先例，不做桌面特例）。
- **W3 现状**：`workspaceSvc.makePathUnique`（:351-379）已在创建/重命名/移动（含拖放/FolderPicker）全路径同步去重，后缀 `.N` 格式 + `pathConflict` 警告弹窗；`ensureUniquePaths` 每轮同步后再兜底。真正的覆盖窗口不存在。仅需后缀格式 `.N` → ` (N)`（用户规格）。
- **W4 根因（KEDIT 回归，commit b8547b8f）**：`getItemHash` 含 createdOn/updatedOn；树扫描为"无本地项路径"构造候选项时间戳 0/0（gitWorkspaceSvc.js:111-119）→ 哈希必不匹配存量 syncData → `applyChanges` 在删除循环（syncSvc.js:724）之前复活旧路径为新 uid 文件 → 远端 A 永不删除。**波及范围：重命名/移动/移入回收站/永久删除/文件夹改名（后代整体复活）**——上游 StackEdit 无时间戳哈希故无此病。修法：墓碑（localSettings 每设备即可——删除动作只属发起设备），钩子=setOrPatchItem 既有 `oldGitPath` 捕获（workspaceSvc.js:191,205）+ deleteFile；makeChanges 对墓碑路径跳过复活，让既有 remove 循环（githubHelper.removeFile:290-307）在同轮删远端；确认远端已删后清墓碑。
- **W5 组件清单**：引用扫描管线**已存在**——workspaceBackupSvc.js:9-166（markdown/HTML/引用式三种匹配 + 相对路径解析 + `collectReferencedImages` 走 IDB 游标 `localDbSvc.getWorkspaceItems`）；仓库图片全集 = `gitWorkspaceSvc.shaByPath`（每轮同步重建，含 sha）；删除原语 = `githubHelper.removeFile(path, sha)`（与永久删除同源）；本地 imgs store 需补删除方法，blob URL 引用计数已有（editorSvc.js:79-99）；3 天追踪存储 = 复制 explorerOrder 的同步 data 条目四件套（跨设备一致）；自动清扫挂点 = requestSync 里既有的 7 天 trash 清理槽位（syncSvc.js:920-956）；菜单插入点 = MainMenu.vue:94-97（打印下方）；复选框弹窗先例 = WorkspaceBackupExportModal，缩略图 = `workspaceImageSvc.getDataUrl`。
- **W6 可行性**：预览删 markdownExtension.js:32 的 `'lheading'`（zero 预设永不启用）→ `text\n---` 确定性解析为 `<p>text</p><hr>`；分节机制不受影响（paragraph_open+hr 均为 section 起始 token）。编辑器删 markdownGrammarSvc.js:106-119 两条 setext 规则时必须连带删 :390-391 的 inside.rest 接线（否则 TypeError）；`---` 自动落 hr 语法。

## 验收标准

- [ ] W1: 真机开启"移动"开关后，长按 350ms 起拖（不弹上下文菜单、页面不滚动）、浮影跟随、松手落位生效（同夹重排+跨夹）；关闭开关长按菜单恢复
- [ ] W2: 手指/鼠标点右缘按钮列（眼睛/对焦/滚动同步）不再被轨道拦截、无翻页抽搐；滑块拖动（含 pointer capture 离条持续）不受影响；阅读模式角落铅笔可点
- [ ] W3: 同目录创建/重命名/移动同名文件自动加 ` (1)` ` (2)` 后缀，有警告弹窗，无覆盖
- [ ] W4: A 改名 B → 同步 → 云端 A 消失、仅 B；移动/移入回收站/永久删除/文件夹改名同理不复活；另一设备对同路径新建的文件不被墓碑误杀
- [ ] W5-auto: 零引用满 7 天的图片在下轮同步被自动删除（仓库+本地）；上传 <24h 不计时；重新被引用即清零
- [ ] W5-manual: 主菜单"打印"下方"图片引用检测"→ 弹窗列出未引用图片（复选框+缩略图、全选、X 关闭）→ 删除所选（确认弹窗）；清理日志可查
- [ ] W6: `文字`+`---` 渲染为段落+分隔线（编辑+预览一致）；`文字`+`===` 为普通文本；`#` 标题不受任何影响

## 范围外

- 图片存储路径模板变更、imgs 目录结构调整
- 同步频率/策略调整（W4 仅修复删除传播）

## 已决策

- **W6**（用户确认 2026-07-12）：全面禁用 setext 标题（`文字`+`---`/`===` → 段落+分隔线/普通文本），**`#` ATX 标题完全不动**——预览仅删 `lheading` 规则（`heading` 独立无涉），编辑器仅删 setext 两条规则+接线（ATX 规则不动）。
- **W5 口径**（用户确认 2026-07-12）：零引用计时起点 = 同步后扫描首次发现零引用（时间戳存随工作区同步的 data 条目）；连续零引用满 **7 天** 自动永久删除；期间任一次扫描发现被引用即清零。**24h 上传宽限**：上传未满 24h 的图片不进入计时（按 imgs/YYYY-MM-DD 路径日期判定，无法解析则按首见时间兜底）。自动清理写入"最近清理"日志（仅路径+时间，手动检测弹窗内可查，可否决）。
- **W2 取舍**：轨道命中全部取消（pointer-events:none），不做桌面翻页特例（全库无 (pointer:fine) 先例；轨道透明后滚轮自然穿透到内容，无实损）。
- **W3 格式**：去重后缀采用用户规格 ` (1)` ` (2)`（现为 `.N`），冲突警告弹窗保留。

## 开放问题

（无——全部已决策）
