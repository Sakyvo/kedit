# Implement: 第三批 UX 修复

单阶段执行（7 项互相独立，同一 implement 代理一次完成），顺序按风险从低到高。

## 清单

- [ ] 1. Z4：SideBar.vue toggler 加括号。验证：开关可切换、tooltip/按压态联动、关闭时点目录不收起。
- [ ] 2. Z1：`--syncing` 蓝色 + disabled 灰化豁免。验证：同步全程按钮蓝色旋转，无白色态；红/绿不变。
- [ ] 3. Z2：modal z-index 100 + CustomScrollbar z-index 1。验证：打开"移动到"/任意弹窗滚动条被遮；lightbox/notification 正常。
- [ ] 4. Z5：列表缩进 em 化 + L4-6 marker 字形/尺寸精修。验证：对照 38 图逐条（对齐阶梯、L4 面积=L3、L5/6 减小、L6 平滑）；ol 数字不换行不挤压。
- [ ] 5. Z6：processUpload 替换并批 undo（成功+失败路径）。验证：上传→Ctrl+Z 一步消失；上传期间打字后撤销行为合理；redo 可重做。
- [ ] 6. Z3：TOC 编辑模式活 DOM 跳转 + 底部钳制 + scrollSync 编辑源标记。验证：pdir/3.2 Vegas.md 场景各级标题贴顶；文末标题贴底；双栏预览跟随不回拉；纯预览模式不变。
- [ ] 7. Z7：本地图同步设 src + per-URI 尺寸预设。验证：40 视频场景（图片行上下换行/编辑）视口稳定；X1 不回归（多图不串）；http 图防闪烁不回归。

## 全局验证

- `npm run build` 通过。
- dev 手测：上述逐项 + 同步按钮三态/目录跳转/图片编辑组合回归。
- 真机复核：Z3 移动端目录跳转、Z5 移动端列表渲染。

## 风险文件

- `src/services/editorSvc.js`（Z7，紧邻 X1 修复区）
- `src/components/Editor.vue`（Z6 processUpload）
- `src/components/Toc.vue` + scrollSync 交互（Z3）
