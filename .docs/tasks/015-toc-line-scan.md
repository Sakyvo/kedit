Status: review

## Parent

010-long-doc-segmented-loading.md（决策见 ADR-0012）

## What to build

TOC 与预览渲染解耦：改为独立行扫描构建，打开即得完整目录。

- 全文行扫描提取标题行（ATX `#`...`######`，尊重代码围栏内的 # 不算标题、
  沿用现有 frontmatter 处理），构建 完整 TOC;替代从 previewCtx
  sectionDescList 取 heading 的来源。
- 大纲层级沿用现有「孤立标题从左缘起算」的缩进语义;空文档维持
  toc-tab--empty 行为。
- tocJump 适配:跳转目标可能落在未载入分段 → 先触发该段载/渲染,再按
  现有 live DOM 定位逻辑落位。
- 扫描数据源为文本/模型(不依赖预览是否渲染、是否可见),变更随内容
  事件增量刷新。

## 实现落点

- `src/services/editor/headingsScan.js` — 纯行扫描:`extractHeadings`（ATX / 围栏 /
  frontmatter / 缩进代码）、`mapHeadingsToSections`、`computeSectionStarts`。
- `src/services/editor/tocModel.js` — `computeTocEntries`（与 sectionList 等长对齐，
  无标题段占位）、`tocEntryKey`、`planTocPatch`（公共前后缀 + 单次 splice）。
- `editorSvc.rebuildTocFromScan()` — ON 时由 `contentChanged` / `highlighted` /
  `highlightedSectionsRefreshed` 驱动重建；TOC 槽位来自编辑器自己的 `sectionList`
  （markdown-it 划分），保证 `tocElt.children[i] ↔ sectionList[i] ↔ preview` 1:1；标题
  内容走 markdown-it `renderInline` + sanitize。OFF 时完全保留旧路径
  （refreshPreview 里由预览 HTML 克隆标题）。

## 事实核查中暴露并修复的 012 遗留缺陷

1. **ON 下预览全空**：`sectionParser` 走 docModel 分支后 `this.parsingCtx` 永不赋值，
   `convert()` 拿到旧/空上下文，`refreshPreview` 配对崩坏。修复：编辑器与预览共用
   同一 section 源（markdown-it），模型只负责文本事实。
2. **廉价分段器与 markdown-it 的块边界不等价**（样本 9546 vs 10801，index 0 即分歧：
   标题/列表/hr 可无空行打断段落）→ 若强行喂给 cledit 会破坏预览 1:1 配对。
   结论落盘为注释（`sectionParser` 处），廉价分段器不再参与编辑器分节。
3. **`getDomTextOffset` 用 `docModel.sections.indexOf(cleditSection)` 永为 -1** →
   每次击键都回退全量 DOM 重建（delta 路径实际是死的）。修复：按 sectionList 累积
   偏移 + 段内 TreeWalker 相对偏移。
4. **`initClEditor` 不重置 `parsingCtx`/`conversionCtx`/`previewCtx`** → 重开文档后
   `convert()` 与陈旧上下文 diff，产生 `sectionDesc` 缺失的错位配对（`editorElt` 崩溃）。
   修复：重建时重置四者上下文 + TOC 键与偏移缓存。

## Acceptance criteria

- [x] `npm run build` 通过
- [x] 打开 80 万字文档后 TOC 立即完整（无需等待预览补齐）——实测 81 万字符文档：
      TOC 决策 19757 标题 / 46098 条与编辑器同时到位（页内计时 35ms 出 TOC、49ms 出全文）
- [x] 代码围栏内的 `#` 行不出现在目录（`fenceHeadingInToc: false`）;frontmatter 不被误当标题
- [x] 点击目录项跳到未载入段时：先载入/渲染再准确定位到标题（末条 `Sub 39` 点击后
      scrollTop 0 → 33347）
- [x] 标题增删改后目录增量更新（`# `→`## ` 后首条 H1→H2、depth 归 0，条目数不变）;
      文档无标题时目录为空态（`toc-tab--empty`）
- [x] 行内富文本标题渲染（`## Bold **strong** heading` → `Bold <strong>strong</strong> heading`）
- [x] OFF 开关回退旧路径（`pipeline: false` 时 `tocKeys` 为空、TOC 由预览 HTML 克隆驱动）

## Blocked by

None - can start immediately