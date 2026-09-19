Status: review

## Parent

`.docs/tasks/000-copy-original-image.md`

## What to build

编辑器选区复制/剪切时，剪贴板携带"原文 + 标记 html"双格式，粘回 KEDIT 时按原文还原。

- copy/cut 事件里同步写入 `text/plain`（选区原始 Markdown，行为保底）；
  随即异步升级为完整载荷：`text/plain` + `text/html`，html 中选区涉及的每张私有
  图片以其原始字节（IndexedDB 存的 base64，不重编码）内联为 data URL，html 头部带
  `<!--kedit:copy-->` 标记，并附带还原引用文本所需的信息（uri/alt）。异步升级失败
  或浏览器不支持时，剪贴板退化为现有纯文本行为。
- paste 侧：命中标记的 html 时直接插入 `text/plain` 原文；`Editor.vue` 捕获阶段的
  图片分支与 cledit 的 turndown 分支都跳过——同一选区粘回 KEDIT 不产生任何新图片
  文件，内容逐字符等于原文。

剪贴板载荷构造与标记判定收进 services 层的新模块（业务逻辑不进组件），cleditCore
与 Editor.vue 只做薄接线。

## Acceptance criteria

- [ ] `npm run build` 通过
- [ ] 复制含私有图片的选区，粘到 Word/网页富文本框：图片以原字节显示，文本原样
- [ ] 同一份内容粘回 KEDIT（同文档/跨文档）：插入内容与原文逐字符一致，IndexedDB 无新增图片
- [ ] 无图选区复制粘贴行为与现状完全一致（回归）
- [ ] 不支持异步剪贴板写的环境：复制结果退化为现有纯文本，不报错、不空剪贴板

## Blocked by

None - can start immediately
