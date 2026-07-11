# Implement: 第二批 UX 修复

三阶段顺序执行（同 07-06 模式，每阶段一个 implement 代理）；阶段内按依赖排序，风险最高的 M1/B1 分居 2/3 阶段。

## 阶段 1：独立小修（视觉/正则/单点逻辑）

- [ ] 1.1 R1：trash 文件菜单移除"删除"仅留"永久删除"；ContextMenu 渲染分支加 `:class="item.className"`（opt-in）+ `--danger` 红字样式。验证：trash 内右键只见红色"永久删除"，其他菜单不变。
- [ ] 1.2 M2+G4：开关禁用态无背景/启用态高对比；新增 arrow-all"移动"SVG 图标替换 iconMenu；trash 红、temp 黄着色。验证：两态肉眼可辨；夜间主题同样成立。
- [ ] 1.3 I5：编辑区放大命中仅 IMG（Editor.vue findZoomableImage 收窄）。验证：点灰色 URL 区不触发放大，点图片触发。
- [ ] 1.4 X1：imgCache 空 src 不入缓存 + URI 参与 key（editorSvc.js:670 一带）。验证：多张本地图文档反复编辑/切换分节，编辑区图片不串；无闪烁回退。
- [ ] 1.5 U1：预览 emphasis tokenizer 拦截 `0x5F` + 编辑器语法删 4 条 `_` 规则的 `_` 分支。验证用例：`_a_`/`__b__`/`a_b_c` 双侧均普通文本；`*a*`/`**b**` 正常；工具栏加粗/斜体按钮（`*` 系）正常。
- [ ] 1.6 H1：编辑区标题梯度 1.5/1.4/1.3/1.2/1.1/1.05 + 预览显式同梯度（限定作用域）；核对导出 HTML 模板样式是否同源，不同源则补。验证：007 场景 H1 略大于 H2、H6 > 正文，编辑与预览一致。
- [ ] 1.7 N1+N2：预览列表 padding-left 30→16px；6 级 marker（disc/circle/square/'□ '/'◆ '/'◇ '，4-6 用 ::marker content）。验证：010 场景逐级符号正确、缩进≈一个汉字。
- [ ] 1.8 T1+T2：TOC 字号 15px/贴边 padding 8px/缩进收窄；SideBar X 对 toc 面板直接关闭侧栏；"自动跳转"开关（新 SVG、layoutSettings 持久化、默认开、开启时跳转后自动收起侧栏）。验证：003 场景观感；X 直接回文档；开关关闭时跳转不收起。
- [ ] 1.9 S3：devtools 实测红/绿态尺寸，若有差就地修（本项与 2.1 同文件，可并入阶段 2 执行）。

## 阶段 2：同步按钮 + 图片流程

- [ ] 2.1 S1/S2/S4：删除白色 `--sync` 按钮；`--sync-quick` 恒显示（去 v-if）；状态判定重写为 hash 比对 getter（synced 绿/unsynced 红/syncing 旋转，补旋转 CSS）；打开未编辑文件=绿。验证：打开旧文档绿→输入一字符红→点同步旋转→完成绿；预览模式可见可用；未登录点击仍弹登录提示（07-06 A2 回归）。
- [ ] 2.2 I1/I2/I3/I4：ImageModal 移除"取消"、X 语义修复（callback(null)+焦点恢复）；多 URL（`,`/回车拆分）；上传 multiple + 直插 + 部分失败通知；多图 `\n` 分隔插入（pagedown doLinkOrImage 接受数组）。验证：单/多 URL 插入、单/多文件上传直插、X 关闭后光标回编辑器无控制台报错。

## 阶段 3：数据与结构改动（最大风险块）

- [ ] 3.1 M1：explorerOrder v2 路径化（{version:2, orders}, parentKey/子项均 git 路径，root='root'；读写边界 id↔path 转换；旧形状视为空）；materialize 压缩基于 path；顺带修 syncSvc 数据项 syncData 丢 id 落 "undefined" 键 + syncData 内嵌整份 data 两个 bug。验证：本地拖动刷新保序；`.stackedit-data/explorerOrder.json` 为路径键；**双设备同账号顺序一致（用户真机终验）**。
- [ ] 3.2 G3+G1：imgs 特殊文件夹（摘出主树、置 temp 下方、蓝色、点击弹跳转确认 → getFilePathUrl('imgs')；未登录降级提示）；"移动到"目标集排除 imgs 及后代。验证：imgs 不再展开、跳转 URL 正确指向 kedit-app-data/imgs。
- [ ] 3.3 G2：FolderPickerModal 固定弹窗（全展开嵌套树+滚动+X 关闭+点击即移动；排除 trash/temp/imgs/自身子树）；ExplorerNode"移动到"切换为 modal。验证：006 场景不再溢出；移动语义与原先一致（含手动排序 append 行为）。
- [ ] 3.4 B1：CustomScrollbar 组件（pointer capture 拖动、比例映射含 48px 最小滑块修正、track 翻页、ResizeObserver）；挂载 editor+preview 并隐藏这两处原生条。验证：拖住滑块横向移出仍持续滚动（鼠标+触摸）；长文档映射准确；D12 手势与滚动同步不回归。

## 全局验证

- `npm run build` 通过（唯一 CI 门槛）。
- dev 手测回归：07-06 验收清单抽查（拖拽排序、永久删除、伪标题、侧栏 X、代理滚动）不回归。
- 真机（Via）：B1 触摸拖滚动条、T1/T2 目录、S 组按钮三态。
- 双设备：M1 顺序同步终验。

## 风险与回滚点

- 风险文件：`src/store/explorer.js` + `src/services/syncSvc.js`（M1 路径化）、`src/services/editorSvc.js`（X1 缓存）、`src/libs/pagedown.js`（多图回调）、新组件 `CustomScrollbar.vue`/`FolderPickerModal.vue`。
- explorerOrder v2 单向升级、旧端安全忽略；B1 回退=卸载组件+还原两行 CSS；U1 回退=移除 tokenizer 包装与语法删改。
