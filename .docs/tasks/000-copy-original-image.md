Status: anchor

# Copy original image

## Problem

作者在 KEDIT 里写带图片的内容，复制出去时外部目标（Discourse、网页富文本框、
pebrel/pi 等终端、微信类聊天框）只能拿到无法解析的图片引用文本，图片根本到不了
对面；而把含图内容粘回 KEDIT 自己时，图片又会经 processUpload 重复落盘浪费存储。

本批次让选区复制一次写出两副面孔：对外携带原图字节，对内还原引用文本。

## Decisions

- 剪贴板三态载荷：`text/plain` 原文不动；`text/html` 以内联 data URL 携带原图
  原始字节并带 `<!--kedit:copy-->` 标记；选区 trim 后恰好一条图片引用时写
  **纯图剪贴板**（原生 image/png + 带标记 html，不含 text/plain）。html 载荷必须
  附带足够还原引用文本的信息（uri/alt）。
- 自家粘贴识别：text/html 中的注释标记；命中则插原文、跳过 processUpload 与
  turndown；引用在当前工作区解析不到时，从 data URL 救回字节走 updateImg 落盘。
- 实现约束：copy 事件同步先写 text/plain 保底，完整载荷经异步
  `navigator.clipboard.write` 升级；失败则保留纯文本。

完整理由与被否选项：`.docs/adr/0007-copy-ships-original-image-paste-restores-reference.md`
术语定义：`CONTEXT.md` 的 **Self-contained copy**。

## Out of scope

- 预览区复制的同类待遇（本期只做编辑器选区）
- 图片右键"复制原图"独立手势（留作后续候选）
- 一次复制携带多张原生图（操作系统不支持多图剪贴板项）
- pebrel/Notepad3 侧的任何改动（全靠剪贴板形态适配，它们零改动）
- Firefox 完整支持（渐进增强：不支持的浏览器自动退化为现有纯文本行为）

## Testing strategy

Jest 链已断（`npm run build` 是唯一 CI 门槛），本批全部走**真机验收矩阵**：
KEDIT↔KEDIT（含跨文档、跨工作区）、Word/富文本、Discourse 类网页、pebrel pane、
Notepad3。剪贴板载荷构造与标记识别写成 services 层的纯函数模块，便于
`npm run build` 之外的代码检视，但验收以实机粘贴矩阵为准。
首项验收：当前 Chrome 上 `clipboard.write(image/png)` 后 pebrel 能吃图（CF_DIB 通道）。
