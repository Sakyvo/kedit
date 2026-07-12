# PRD: 第三批 UX 修复：同步按钮残留/目录精确跳转/列表对齐/上传撤销

## 背景

07-10 批次上线后的第三轮反馈：1 个阶段 2 回归 + 2 个阶段 1/3 的 bug + 4 个精修。证据：`research/assets/33-*.png ~ 40-*.mp4`。

## 需求清单

- **Z1. 白色同步按钮依然在**（33-white-sync.png）：导航栏仍有一个白色同步图标按钮（时钟/上传/白色循环箭头/彩色按钮并排）。07-10 只删了 hideLocations 组内那个，还有残留实例（疑似 07-05 移动端任务加在别处的快捷同步）。要求：全局只保留彩色三态按钮。
- **Z2. "移动到"弹窗滚动条图层过高**（34-move-scrollbar.png）：自定义滚动条（编辑/预览的 CustomScrollbar）浮在 modal 遮罩之上。修 z-index 层级。
- **Z3. 目录跳转不精确**（35/36/37 png，样例文件 /Projects/pdir/3.2. Vegas.md）：编辑模式下点目录项，目标标题应滚到**编辑区顶部**；若下方内容不足一屏则向底对齐。（预览模式维持按预览对齐的现状。）当前在含图片的长文档中偏差大。
- **Z4. 自动跳转开关点击无反应**（36-toc-autojump.png）：TOC 标题栏"自动跳转"按钮点击后状态不变（tooltip 恒"自动跳转：开"）。
- **Z5. 列表缩进对齐与符号精修**（38-list-indent.png）：
  - 对齐：缩进 1 的圆点位于正文"正"字正下方，文字"缩"对齐"常"（即 marker 占 1 字宽，文字从第 2 字位起）；逐级同理（缩进 2 的"缩"对齐缩进 1 的"进"）。
  - 缩进 4 空心方块过大 → 面积与缩进 3 实心方块一致，保持空心。
  - 缩进 5/6 菱形面积适当减小；缩进 6 的"◇"锯齿感明显 → 换更平滑的字形或缩小。
- **Z6. 上传图片后 Ctrl+Z 出现占位残留**（39-upload-undo.png）：撤销后出现 `[图片上传中...(image-xxx)]` 文本而非直接消失。撤销应一步回到插入前状态。
- **Z7. 图片行上下编辑时视图乱飞**（40-viewport-jump.mp4）：编辑时视口随机跳动，通常发生在图片行附近（换行时闪屏）。

## 确认的事实（代码探索结论，详见 research/*.md）

- **Z1**：导航栏 DOM 仅一个同步按钮（28ef4f68 删除无误）。"白色按钮"= `--sync-quick` 在同步中的样子：`--syncing` 无 color 规则 + `[disabled]` 灰白（$navbar-color）；截图中"彩色按钮"实为 KEDIT logo 侧栏开关，"时钟"为队列 spinner。修法：`--syncing` 配色（蓝）+ 豁免该态的 disabled 灰化。
- **Z2**：`.custom-scrollbar` z-index:10 且祖先链无层叠上下文 → 直达根上下文；`.modal` 无 z-index（z-auto）被压。修法：modal 设显式 z-index + scrollbar 降为容器内小值（其 DOM 末位已足够盖编辑区）。
- **Z4 根因**：`SideBar.vue:7` `@click="toggleTocAutoJump"` 不带括号 → MouseEvent 作 value → `!!event===true` 恒为默认值。全库唯一不带括号的 toggler 绑定。修法：加括号。
- **Z3**：Toc.vue:37 用 `sectionDesc.editorDimension.startOffset`（500ms 防抖缓存），编辑区图片 onload 无补测钩子 → 多图误差系统性偏小。精确源已存在：`sectionDesc.editorElt`（活 section div，重渲染时刷新），点击时读 `offsetTop` 即准；底部钳制样板在 editorSvcUtils.js:139-145。双栏时 scrollSync 50ms 后会用过期维度反算拖歪预览（第二重扰动），需以编辑区为同步源。预览模式走 previewDimension（测量前已 await 图片）本就准，不动。
- **Z6**：触发链路是 Editor.vue 粘贴/拖放直传（processUpload:66-97），非 ImageModal。占位符插入与上传完成 `replaceAll` 是两个 undo 态（模式缓冲上限 1000ms 无法跨越上传耗时）。合并机制可行：替换改 `setContent(newContent, true)`(noUndo) + 手动 `undoMgr.addDiffs` 不 saveState → 替换 patches 与插入 patches 同批，一次 Ctrl+Z 整体逆转（cleditUndoMgr.js:144-154；含"上传期间打字"边界推演）。
- **Z7**：图片与相邻文本同 section，编辑即整段重建 DOM；X1 守卫使本地图彻底失去 imgCache 复用 → 每次重渲染 display:none 塌缩→异步 blob→撑开，scrollTop 被钳制；光标滚动窗还按塌缩期坐标滚动。治本：创建时同步查 `pathUrlMap`（editorSvc.js:53）直接设 blob src（本地图重获缓存复用，不破坏 X1 语义）+ onload 记 naturalW/H 到 per-URI map 并在创建时预设宽高。
- **Z5**：预览字号 18/17/16px 动态（×fontSizeFactor），缩进固定 16px（px 恒错位于字宽）→ 改 em 基准；L4-6 字符串 marker 按正文字号渲染故偏大，`::marker` 支持逐级 font-size；更平滑候选码点：⬦U+2B26、⋄U+22C4、▫U+25AB、⬩U+2B29（缀 U+FE0E 防 emoji 呈现）。

## 已决策 / 设计注记（可否决）

- Z1 同步中显示**蓝色**旋转（与红/绿三态区分，避免任何白色态）。
- Z3 行为：编辑模式（含双栏）点目录 → 标题行贴编辑区顶部、文末不足一屏贴底；双栏时预览由 scrollSync 以编辑区为源跟随；纯预览模式维持现状。
- Z5 对齐基准：缩进宽度与 marker 尺寸全部改 em 基准（随预览字号缩放），逐级 `::marker font-size` 微调至与 L3 面积相当；具体字形实现时目测定稿。

## 验收标准

- [ ] Z1: 全局（编辑/预览/桌面/移动）仅一个同步按钮（彩色三态）
- [ ] Z2: 打开任意 modal 时自定义滚动条不再浮于遮罩之上
- [ ] Z3: 编辑模式点目录项，标题行滚至编辑区顶部；文末不足一屏时贴底；含图片文档误差 ≤ 1 行
- [ ] Z4: 自动跳转开关可切换（tooltip/按压态随之变化），关闭时点目录不收起侧栏
- [ ] Z5: 38 图场景各级 marker 与文字按"1 字宽阶梯"对齐；4-6 级符号面积与 3 级相当、无明显锯齿
- [ ] Z6: 上传插入后 Ctrl+Z 一步回到插入前，无占位文本残留
- [ ] Z7: 图片行附近换行/编辑不再引发视口跳动

## 范围外

- 预览模式的目录对齐逻辑（维持现状）
- 同步逻辑本身

## 开放问题

（无——7 项均已定位根因，意图明确）
