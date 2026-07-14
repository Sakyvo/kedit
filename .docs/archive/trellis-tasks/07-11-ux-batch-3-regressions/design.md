# Design: 第三批 UX 修复

全部为缺陷修复/精修，无新功能。研究依据 `research/quick-locates.md`、`research/editor-deep.md`。

## Z1 同步按钮 syncing 态配色

- NavigationBar.vue：`--syncing` 增加蓝色 color 规则（旋转动画已有）；`[disabled]` 灰化对 `--syncing` 态豁免（选择器特异性覆盖）。红/绿态不变。队列 spinner、logo 按钮不动。

## Z2 层级修正

- `Modal.vue` `.modal` 设显式 `z-index`（参照 ImageLightbox z:1000 之下、高于常规内容，取 100）；`CustomScrollbar.vue` z-index 10 → 1（DOM 末位 + 容器内已足够盖住编辑内容）。核对 ImageLightbox/notification/tour 等其他覆盖层不受影响。

## Z3 目录跳转精确化（编辑模式）

- Toc.vue 点击处理：编辑模式（含双栏）改读活 DOM——`sectionDesc.editorElt.offsetTop`（相对 editorElt 累加至滚动容器坐标系），`scrollTop = 目标 offset`，钳制 `min(offset, scrollHeight - clientHeight)`（贴底），参照 editorSvcUtils.js:139-145 样板。
- 双栏：跳转后将 scrollSync 的同步源标记为编辑区（复用其 isScrollEditor/focus 机制），预览随动，消除 50ms 过期维度反拉。
- 纯预览模式路径不动。

## Z4 一字符修复

- `SideBar.vue:7` `@click="toggleTocAutoJump"` → `@click="toggleTocAutoJump()"`。

## Z5 列表对齐与符号（预览 CSS）

- 缩进改 em 基准：`ul, ol { padding-left: 1em }`（每级 1 字宽阶梯；ol 数字宽度单独核对，必要时 ol 保留更大值）。
- li 文字与 marker 关系核对（list-style-position: outside，marker 盒右缘贴文字起点），微调至"marker 居第 1 字位、文字起第 2 字位"。
- L4-6 marker：更平滑字形候选（▫+FE0E、⬩/⋄、⬦/⋄）+ 逐级 `li::marker { font-size: … }` 缩至与 L3 `square` 面积相当；L5 实心、L4/L6 空心。实现时目测定稿并截图对照 38 图验收。

## Z6 上传占位符撤销合并

- Editor.vue processUpload 完成回调：最终 URL 替换从常规 `replaceAll`（自建 undo 态）改为 `setContent(newContent, true)`(noUndo) + `undoMgr.addDiffs(替换 diffs)` 且不 saveState——替换与占位符插入合入同一 undo 批次，Ctrl+Z 一步回到插入前。
- 边界：上传期间用户打字（占位符位置漂移）——replaceAll 本就按字符串匹配替换，维持；undo 合并只影响 diff 归批，不影响匹配。上传失败路径同样处理（占位符移除也应并批）。

## Z7 图片行视口稳定

- editorSvc.js 图片创建处：
  1. **同步解析本地图 src**：创建 img 时查 `pathUrlMap`（:53），命中直接设 blob src——本地图重新满足"非空 src"进入 imgCache 复用池（X1 守卫语义不变：仍然拒绝空 src）。
  2. **预设尺寸**：新增 per-URI 尺寸 map；img onload（:729 一带）记录 naturalWidth/Height；创建时若有记录则预设 width/height 属性，消除 0→H 塌缩。
- 若实测仍有轻微跳动，备选（不默认做）：onload 内对视口内图片做 scrollTop 再锚定。

## 回滚

- 各项独立 hunk；Z7 若引发新问题回退两个小改动即可；Z6 回退即恢复两段式 undo（无数据风险）。
