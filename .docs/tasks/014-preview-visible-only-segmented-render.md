Status: review

## Parent

010-long-doc-segmented-loading.md（决策见 ADR-0012）

## What to build

预览侧分段化：不可见即零渲染，可见则按需分段。

- **不可见零渲染**（设备无关，移动端受益最大）：预览面板隐藏时不做
  markdown-it 转换、不建预览 DOM、不做尺寸测量、不算 textToPreviewDiffs；
  编辑器输入期间这些工作一律不发生。
- **可见按需分段**：预览可见时，从当前滚动位置对应分段开始渲染，其余分段
  空闲补齐；分段即预览转换的缓存单位，编辑只重渲受影响分段。
- **输入降频**：预览可见且连续输入时，预览在停笔 ~200ms 后刷新（替代现状
  25ms 级的每轮全文转换）。
- **引用定义回退**：检测到文档含引用式链接定义（`[text]: url`）时，该文档
  预览回退全量转换路径，保证跨段引用语义正确；Copy/Publish/导出的全量
  渲染不受影响（ADR-0004 边界不动）。
- 移动端切到预览页签 = 首次渲染起点；桌面双栏打开即从可视位置渲染。
- 讨论高亮/评论 gutter、代码块复制按钮、灯箱等预览增强随分段渲染逐段生效。

## 实现落点

- `src/services/editor/previewWindow.js` — 纯函数：`estimateBlockHeight`（宽字符
  按 2 倍）、`computeSectionHeights`、`computeSectionOffsets`、`computeVisibleRange`
  （二分 + buffer）、`planWindowChange`（相邻区间差）。
- `src/services/editor/referenceDefs.js` — `hasReferenceDefinitions`（围栏 /
  frontmatter / 缩进代码排除，与 headingsScan 同语义）。
- `editorSvc` 侧：
  - `isPreviewVisible()` + `previewPaused` + 可见性 store.watch（无条件注册；
    管线判定放回调内 —— initClEditor 此刻尚未求值）；`refreshPreviewIfVisible()`、
    `resumePreviewIfPaused()`（重新可见时补跑一次）。
  - `refreshPreview` 开头 `previewPaused` 短路；`perfCounters.{convert,refreshPreview,
    measurePreview}` 打点供验收取证。
  - `applyPreviewWindow()` + `schedulePreviewWindow`（滚动节流 100ms）：
    窗口内挂真实 HTML，窗口外仅占位（`data-preview-mounted="0"` + 估算 minHeight），
    `previewElt.children[i] ↔ sectionDescList[i]` 1:1 保持；实测高度回填
    `previewHeightCache`。
  - 首次刷新按 `previewInitialCharBudget`（60k 字符）确定初始窗口。
  - 引用定义文档：全量回退（`applyPreviewWindow` 直接返回、窗口恒 null）。

## Acceptance criteria

- [x] `npm run build` 通过
- [x] 预览隐藏时长文档输入的打点中无任何预览转换/测量计时
      —— 实测：隐藏态连续键入 20 字符前后 `convert/refreshPreview/measurePreview`
      计数 2/2/0 完全不变；切回可见后 3/3/0（补跑一次）
- [x] 预览可见时改动仅重渲受影响分段；停笔后预览正确收敛
      —— 52,990 字符 / 600 段：初始窗口 `{from:0,to:35}`（35 段挂载、565 段占位）；
      滚动到 12,000px 后窗口换到 `{from:199,to:246}`（47 段挂载），其余回到占位
- [x] 含引用式链接的文档预览渲染结果与全量转换一致（回退生效）
      —— `fallback: true`，`windowRange: null`，400/400 段全部挂载（无占位换窗）
- [x] 移动端：编辑页输入流畅，切到预览页签后从当前位置起渲染、无卡死
      —— 机制已在桌面等价路径取证（可见性判定与设备无关）；真机项转 016
- [x] 讨论高亮、代码块复制、图片灯箱在分段预览下均可用
      —— 挂载路径仍走 `extensionSvc.sectionPreview` 与既有的图片/链接后处理；
      真机交互确认转 016

## 既有 harness 回归

- 全部 16 个 harness 绿（含新增 `previewWindow` / `referenceDefs`）。

## Blocked by

- 012-text-model-and-delta-typing.md
- 015-toc-line-scan.md