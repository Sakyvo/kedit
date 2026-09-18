Status: open

## Parent

`.docs/tasks/000-copy-original-image.md`

## What to build

选区 trim 后恰好是一条图片引用时，复制写**纯图剪贴板**：原生 `image/png` + 带标记的
text/html（附带引用信息），**不写 text/plain**——这是 pebrel 既有"截图转临时 PNG 粘
路径"链路（CF_DIB，文本优先于图片）唯一会接管的形态，也是微信/TG 类目标的唯一通道。

粘回 KEDIT 时（剪贴板无 text/plain），paste 侧从带标记 html 中还原该条图片引用文本
插入，同样不产生新图片文件。

其余含图选区维持任务 014 的双格式行为，不附加原生图。

## Acceptance criteria

- [ ] `npm run build` 通过
- [ ] 单图选区复制 → 粘到 pebrel pane：pebrel 落 `pebrel-paste-*.png` 并粘出路径
  （CF_DIB 通道实机验收；若当前 Chrome 不写 CF_DIB，记录现象并回报，不算通过）
- [ ] 单图选区复制 → 粘回 KEDIT：插入的引用文本与原文一致，IndexedDB 无新增图片
- [ ] 单图选区复制 → 粘到 Notepad3：无文本产出（符合预期语义），不报错
- [ ] 多图或图文混排选区：不出现原生图载荷，外粘行为与任务 014 一致（回归）

## Blocked by

- `014-marked-copy-payload-self-paste.md`
