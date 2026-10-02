Status: open

# 可视化 tab「导出」「其他」组：全量键收尾

## Parent

`.docs/tasks/018-visual-settings-config.md`

## What to build

用 020 的控件组件补齐剩余全部键，完成「全盘可视化」：

- 「导出」：wkhtmltopdf 四边距（数字，0–100）+ pageSize（下拉
  A3/A4/Legal/Letter）；pandoc highlightStyle（文本，预填 kate 等候选即普通
  文本框即可）/ toc（开关）/ tocDepth（数字 1–6）。
- 「其他」：turndown 9 项（headingStyle/bulletListMarker/codeBlockStyle/
  fence/emDelimiter/strongDelimiter/linkStyle/linkReferenceStyle 用下拉或
  小文本框，hr 文本框）；git 三条提交信息模板（单行文本，提示 `{{path}}`
  占位）；newFileContent / newFileProperties（多行文本域）。
- 全部经 019 服务写回；本卡结束时 SettingsModal 默认 yaml 全量键均有可视化
  入口。

## Acceptance criteria

- [ ] 上列键全部可在可视化 tab 编辑、校验、写回且注释保留。
- [ ] 修改 newFileContent 后新建文档内容生效；修改 pageSize 后 wkhtmltopdf
  导出参数生效（可构造性验证，不强求真导出 PDF）。
- [ ] `npm run build` 通过。

## Blocked by

- `020-settings-modal-visual-tab-skeleton.md`
