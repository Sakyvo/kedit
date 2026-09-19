Status: review

## Parent

`.docs/tasks/000-copy-original-image.md`

## What to build

选区 trim 后恰好是一条工作区图片引用时，复制把剪贴板升级为**纯图**：仅
`image/png`（来自 IndexedDB 原图字节，非 png 时无损转码），不写 text/plain、
不写 html——这是 pebrel 既有"截图转临时 PNG 粘路径"链路（CF_DIB）、社媒 textbox、
聊天框唯一会当作图片接受的形态（ADR 0008）。

粘回 KEDIT 时靠**内存像素指纹**识别（复制时记录 64 点采样指纹，粘贴时解码剪贴板
位图采样比对；容忍 Chrome 的 PNG 重编码）：匹配则插入原引用文本、不产生新图片；
不匹配（用户在别处复制了别的图）走原 processUpload 上传路径。

## Acceptance criteria

- [x] `npm run build` 通过；`node test/unit/harness/clipboardCopy.harness.mjs` 全绿
      （单图判定：trim 后恰一条本地引用才命中，text+图/两图/远程图均不命中）
- [ ] 单图选区复制 → 粘到 pebrel pane：pebrel 落 `pebrel-paste-*.png` 并粘出路径
      （CF_DIB 通道实机验收；Chrome 不写 CF_DIB 则记录现象并回报，不算通过）
- [ ] 单图选区复制 → 粘到社媒 textbox / 聊天框：作为图片附件或图片消息发出
- [ ] 单图选区复制 → 粘回 KEDIT：插入的引用文本与原文一致，IndexedDB 无新增图片
- [ ] 复制后先在别处复制另一张图，再粘回 KEDIT：指纹不匹配 → 走原上传路径（新图落盘）
- [ ] 单图选区复制 → 粘到 Notepad3：无文本产出（符合预期语义），不报错
- [ ] 多图/图文混排选区复制：剪贴板只有纯文本（无原生图），外粘为 Markdown 原文

## Blocked by

None - 014 退守后本任务自包含（不再依赖标记 html）
