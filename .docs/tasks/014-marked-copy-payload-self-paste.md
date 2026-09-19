Status: review

## Parent

`.docs/tasks/000-copy-original-image.md`

## What to build

编辑器选区复制/剪切只写 `text/plain` 原文——不在剪贴板上附加任何 html/base64 载荷
（ADR 0008：data URL 方案被废弃，ADR 0007 被取代）。这是本批的"退守"基线：复制零
开销、零卡顿，外部目标收到与选区完全一致的 Markdown 原文；粘回 KEDIT（同文档/跨
文档/跨工作区）时按原文逐字符插入，天然不触发 processUpload、不产生新图片文件，
无需任何自家标记。

实现：撤销 014 初版的 marked-html 载荷与粘贴标记分支；copy/cut 保持同步
`text/plain` 写入（`clipboardSvc.upgradeCopiedSelection` 仅对单图选区另作升级，
不影响本任务语义）。

## Acceptance criteria

- [x] `npm run build` 通过；`node test/unit/harness/clipboardCopy.harness.mjs` 全绿
- [ ] 复制图文混排选区粘到任意外部目标：文本逐字符等于原文，无空白换行、无卡顿
- [ ] 同一份内容粘回 KEDIT（同文档/跨文档/跨工作区）：逐字符一致，IndexedDB 无新增图片
- [ ] Discourse 收到 Markdown 原文（图片之后走 015 单图通道逐张传）
- [ ] 无图选区复制粘贴行为与现状完全一致（回归）

## Blocked by

None - can start immediately
