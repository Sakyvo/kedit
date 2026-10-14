Status: open

## Parent

042-dynamic-loading-anchor.md

## What to build

预览的「占位 + 延迟」策略,配合 044 完整解决「页面不卡死」:

- **占位**:分段管线下,打开文档时预览面板立刻渲染一个「预览生成中…」的
  简单占位(纯文本,不带组件)。等编辑器首帧完成后才进入下列顺序。
- **延迟启动**:convert/refreshPreview 不再卡在 onEditorChanged 的首次同步路径上;
  当编辑器首帧已经出过后再由 rAF/idle 调度。预览转换顺带做分段(每次 ≤40ms):
  convert 完整体 tokens → 格外的按窗口挂载步骤分段完成;
  预览隐藏时仍为 0。
- **完成信号**:首屏可见段渲染出来(首个 div.content 出现 → 0 空白 flash),
  随即滚动正常的 window 挂载逻辑接管(现有 applyPreviewWindow)。

## Acceptance criteria

- [ ] `npm run build` 过
- [ ] 预览可见 + 动态加载开:长文档打开时预览区域在登顶滚动期间一直显示
      「预览生成中…」或完成态,不出现长期空白
- [ ] 预览隐藏时:**020 什么都不做**吗? —— 门控逻辑正确(读取预览服务作为分片
      路过不出),不提供任何曝光
- [ ] 预览一旦生成,滚动/转换/测量仍由 014 的窗口路径驱动,长任务不超过上限分段预算
- [ ] OFF 路径不发生变化

## Blocked by

- 044-chunked-editor-init-build.md