# Design: 第四批 数据安全与缺陷修复

研究依据 `research/bugs-syntax.md`（W1/W2/W6 逐条核实）、`research/data-flows.md`（W3/W4/W5）。

## W1 移动端触摸拖拽修复

三处，全部在 ExplorerNode.vue：
1. **门控原生 contextmenu**：`onContextMenu`(:338-342) 开头——若触摸拖拽等待/进行中（onTouchStart 设的 pending/active 标志，contextmenu 约在 touchstart 后 ~500ms 到达，标志必然在位）→ `preventDefault` + return。桌面右键（无触摸标志）不受影响；开关关闭时长按菜单照旧。
2. **等待期防滚动**：350ms 等待分支(:473-481) 对 touchmove 在 8px 容差内 `preventDefault`（监听已是元素级非 passive，可生效）；超容差维持现状取消长按回落滚动。`@touchstart.passive` 保留（touchstart 本身无需 preventDefault）。
3. **elementFromPoint 防毒**：`updateTouchTarget`(:522-529) 命中非节点元素时（如任何遮罩）不再静默 return 保持旧目标不变——门控 contextmenu 后主因已除，此为纵深防御：命中 `.context-menu` 类背板时跳过本次更新（保留上一目标）。
- UX 注记：`manualSortEnabled` 内存态、重载归 false（explorer.js:127 注释明确）——维持设计，不改。

## W2 滚动条命中收窄

- CustomScrollbar.vue：`.custom-scrollbar`（轨道）`pointer-events: none`；`.custom-scrollbar__thumb` `pointer-events: auto`。删除轨道 `@pointerdown` 翻页处理及其方法。滑块拖动（pointerdown→setPointerCapture）不受影响；滚轮自然穿透至下层滚动容器。touch-action:none 移至 thumb。

## W3 去重后缀格式

- `workspaceSvc.makePathUnique`(:351-379)：后缀 `.N` → ` (N)`（作用于名称段，扩展名/路径语义不变）；沿用既有循环与 `pathConflict` 警告弹窗。核对 explorerOrder remap（setOrPatchItem oldGitPath 捕获在 makePathUnique 之后取最终路径——批3已如此）不受影响。

## W4 删除传播墓碑

- **存储**：`localSettings.gitTombstones`：`{ [path]: { sha, ts } }`（每设备——删除动作只属发起设备；不随工作区同步，避免多端互相注入删除）。
- **写入点**：`setOrPatchItem` 既有 oldGitPath 捕获处（路径变更=旧路径墓碑，含文件夹改名——对旧前缀下全部后代路径逐一记录，sha 取 `gitWorkspaceSvc.shaByPath`）；`deleteFile`/永久删除同理；移入回收站属路径变更自然覆盖。
- **消费点**：`gitWorkspaceSvc.makeChanges`（树扫描 :111-119 构造复活候选前）——路径在墓碑中**且树 sha === 墓碑 sha** → 跳过复活（不生成该路径的新建 change），留给同轮既有 remove 循环（syncSvc.js:724 → `githubHelper.removeFile`）删除远端。**sha 不匹配 = 远端已被他端改写 → 放行下载（防误杀他人新文件）并清除该墓碑**。
- **清理**：remove 循环确认远端删除成功后清除对应墓碑；兜底 30 天过期自动清除。
- **回归防线**：不改 `getItemHash`（时间戳继续参与，排序功能依赖）；仅在树扫描复活路径上加闸。

## W5 未引用图片清理

- **数据**：新同步 data 条目 `imgCleanup`：`{ version: 1, unreferencedSince: { [imgPath]: ts }, log: [{path, ts}]（capped 50） }`——按 explorerOrder 四件套接线（data.js empty/getter/patcher + syncSvc syncDataItem + gitWorkspaceSvc 白名单 + localStorageDataIds 不含）。
- **扫描器**（新 service 或并入 workspaceBackupSvc）：引用集 = 复用 `workspaceBackupSvc` 的图片引用收集管线（markdown/HTML/引用式，IDB 游标全文档）；库存集 = `gitWorkspaceSvc.shaByPath` 中 imgs 前缀 blob（路径模板可配置——取自现行 imgs 路径设置，默认 `imgs/`）。
- **计时更新**：每轮 `requestSync` 尾部（既有 trash 7 天清理槽位旁）：库存 − 引用 = 零引用集合；新出现的记 `unreferencedSince[path] = now`（**24h 上传宽限**：路径含 `YYYY-MM-DD` 且日期 ≥ 昨日 → 跳过不记；无法解析则按首见即记，7 天窗口本身覆盖插入间隙）；已存在但重新被引用 → 删除条目；满 **7 天** → 执行删除。
- **删除执行**：`githubHelper.removeFile(path, sha)`（与永久删除同原语）+ 本地 img store 删除（localDbSvc 补删除方法）+ blob URL 引用计数释放 + `unreferencedSince` 清条目 + `log` 追加。
- **手动检测**：MainMenu.vue 打印条目(:94-97)下方新增"图片引用检测" → `modal/open('imageCleanup')`；新 `ImageCleanupModal.vue`（`${Type}Modal` 约定）：打开即扫描（库存−引用），列表项=复选框+缩略图（`workspaceImageSvc.getDataUrl`，缺失显示占位仍可选删）+路径+零引用天数；左上全选、右上 X（ModalInner）；底部"删除所选"→ `simpleModal` 确认（不可恢复文案）→ 逐个删除（同上述原语）；底部折叠区显示清理日志。手动删除无 7 天限制（用户主动行为）。
- **安全**：删除仅限 imgs 前缀路径（硬校验），绝不触碰 `.md`/`.stackedit-data`。

## W6 setext 禁用

- 预览：`markdownExtension.js:32` 启用列表删除 `'lheading'`（已核实 hr 在 paragraph 终结链内，`文字\n---` → `<p>+<hr>` 确定性成立；table/frontmatter 无截胡）。
- 编辑器：`markdownGrammarSvc.js:106-119` setext h1/h2 两条规则删除 + `:390-391` `inside.rest` 接线两行删除（否则 makeGrammars TypeError）；`---` 自动落既有 hr 规则(:163-165)。ATX `heading` 规则（预览+编辑）零改动。
- 分节安全：`paragraph_open`/`hr` 均为 section 起始 token（markdownConversionSvc.js:63/72），编辑预览共用 converter，一致生效。

## 回滚

- W1/W2/W3/W6 独立 hunk 可单独 revert。
- W4 墓碑：清空 `localSettings.gitTombstones` + revert makeChanges 闸门即回到现状（复活 bug 回归但无新风险）。
- W5：关自动清扫 = 移除 requestSync 挂点一行；`imgCleanup` 条目残留无害。最坏情况=误删图片：有 log 可追溯路径，但内容不可恢复（已由 7 天+宽限+sha 校验+imgs 前缀硬校验四重收敛）。
