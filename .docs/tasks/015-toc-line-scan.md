Status: open

## Parent

010-long-doc-segmented-loading.md（决策见 ADR-0012）

## What to build

TOC 与预览渲染解耦：改为独立行扫描构建，打开即得完整目录。

- 全文行扫描提取标题行（ATX `#`…`######`，尊重代码围栏内的 # 不算标题、
  沿用现有 frontmatter 处理），构建完整 TOC 树；替代现在从 previewCtx
  sectionDescList 取 heading 的来源。
- 大纲层级沿用现有「孤立标题从左缘起算」的缩进语义；空文档维持
  toc-tab--empty 行为。
- tocJump 适配：跳转目标可能落在未载入分段 → 先触发该段载/渲染，再按
  现有 live DOM 定位逻辑落位。
- 扫描数据源为文本/模型（不依赖预览是否渲染、是否可见），变更随内容
  事件增量刷新。

## Acceptance criteria

- [ ] `npm run build` 通过
- [ ] 打开 80 万字文档后 TOC 立即完整（无需等待预览补齐）
- [ ] 代码围栏内的 `#` 行不出现在目录；frontmatter 不被误当标题
- [ ] 点击目录项跳到未载入段时：先载入/渲染再准确定位到标题
- [ ] 标题增删改后目录增量更新；文档无标题时目录为空态

## Blocked by

None - can start immediately
