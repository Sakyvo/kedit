Status: review

## Parent

038-toc-batch-a.md

## What to build

修复目录缩进在标题层级编辑后的横向错位（粘滞 bug）。

`refreshPreview()` 的 diff 循环结束后，对 `tocElt` 内全部 `.cl-toc-section` 按文档序
（即现有 DOM 顺序）做一遍全量 outline depth 重算：遍历每个条目克隆的 heading 元素
取其层级（h1-h6），按「孤立标题从左缘起算」的既有栈语义（遇同级/更浅 pop，depth =
栈深）写回 `dataset.outlineDepth`。删除 diff 循环内的局部 `tocHeadingStack` 计算，
全量重算成为唯一事实源。纯 `dataset` 写，不改 DOM 结构，Toc.vue 的
`data-outline-depth` 属性选择器 CSS 零改动。

## Acceptance criteria

- [x] `npm run build` 通过
- [ ] 多级标题文档中改单个标题层级（如 `### C`→`#### C`）：该条目及全部兄弟缩进
      即时正确，不再跳到错误深度
- [ ] 提升/降级中间标题（如 `## B`→`# B`）：其后整个子树缩进即时正确，不再保留旧值
- [ ] 错位不再粘滞：出错路径后的任意后续编辑/滚动不累积错位，无需切文档/刷新自愈
- [ ] 对照组：打开文档、滚动、目录跳转、粘贴含标题内容，缩进均正确（无回归）
- [ ] 空文档 / 无标题文档：目录为空（见 Implement notes：`toc-tab--empty` 类自首次提交
      起即无任何 CSS 消费，属死代码；空态视觉由无子元素的面板本身呈现）

## Implement notes

- 新增 `src/services/editor/tocDepth.js`：`collectTocHeadingLevels`（TOC DOM →
  文档序 heading 等级）+ `applyTocOutlineDepths`（全量栈重算，仅写变化的
  `dataset.outlineDepth`，返回变更数）。栈语义与既有参考实现
  `tocJump.js computeTocOutlineDepths` 一致。
- `editorSvc.refreshPreview()`：删除 diff 循环内的局部 `tocHeadingStack` 计算，
  循环结束后（`toc-tab--empty` 类切换之后、`previewCtx` 赋值之前）调用
  `applyTocOutlineDepths(this.tocElt)` 全量重算。
- Harness：`test/unit/harness/tocDepth.harness.mjs`（含增量刷新回归场景：
  降级中间标题后未重渲染兄弟的 stale dataset 被修正）。
- 事实修正：`toc-tab--empty` 类自首次提交（4622e484，StackEdit 上游）起就只被
  JS 写入、从未有任何 CSS 选择器消费，属上游死代码。本次保留原类切换不动，
  空态验收以面板无子元素的实际视觉为准。

## Blocked by

None - can start immediately
