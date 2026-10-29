Status: review

## 后台验证记录

- About：删 Gitee/Chrome/邮箱/联系块，保留致谢行（链向上游 benweet/stackedit）、许可证、隐私策略、FAQ。
- Tour 中性化、预设链接删、PDF 弹窗去链、CouchDB 示例中性化 + 删死链 actions、备份文件名/Drive 新建文件夹名 KEDIT 化、4 模板 style.css 自托管、package.json name/bugs 改。
- 全局复查：剩余 stackedit 命中仅红线项（.stackedit-data/db 等持久化标识、CSS 类名、Dropbox 注册应用功能性路径、代码注释、githubHelper 模板 URL）。
- vite build 通过。
- 剩余（人工验收）：About/Tour/导出 HTML 实机看一眼。

## Parent

`.docs/tasks/048-editor-ui-polish-anchor.md`

## What to build

StackEdit 品牌残留清理（用户可见面 + 导出模板 + 包元数据）。范围与红线见锚卡 Decisions 3/4。

**About 弹窗**（`AboutModal.vue`）：删除 Gitee 仓库/问题跟踪/更新日志链接、Chrome 应用/扩展死链、mafgwo 邮箱与「联系我们」块；保留 logo、版本号、FAQ、Apache 许可证与隐私策略链接，新增一行「基于开源项目 StackEdit (Apache-2.0)」。

**可见文案**：
- `Tour.vue`：Gitee Star 引导改为中性欢迎语（或删除该句）；
- `FilePropertiesModal`：指向 mafgwo presets 的链接删除（死链对单作者无意义）；
- `PdfExportModal`：大文档导出指南链接删除或去 StackEdit 化；
- Dropbox 账号/保存/发布弹窗、CouchdbWorkspace 弹窗中的 `StackEdit (restricted)`、`stackedit-workspace` 示例文本改中性示例（注意 `dropboxProvider.js` 里 `/Applications/StackEdit (restricted)` 路径前缀是 Dropbox API 的实际路径约束，代码逻辑不动，仅弹窗说明文案跟随现实）；
- `workspaceBackupSvc` 下载文件名 `StackEdit workspace.json/zip` → `KEDIT workspace.json/zip`；
- `googleDriveWorkspaceProvider` 新建 Drive 文件夹名 `StackEdit workspace` → `KEDIT workspace`（仅影响新建，改名不断既有引用）。

**导出模板**：4 个 Handlebars 模板（styledHtml / WithToc / WithTheme / WithThemeAndToc）中外链 `https://stackedit.cn/style.css` 全部改为自托管 `https://kedit.cc.cd/style.css`（build-style 本来就产出该文件）；`stackedit__*` CSS 类名与模板结构保留（style.css 依赖）。

**包元数据**：`package.json` 的 name/description/bugs 改 KEDIT 语义（About 弹窗只读 version，无连锁反应）。

**红线（不碰）**：`.stackedit-data/`、`.stackedit-trash/`、`stackedit-app-data`、`resetStackEdit`、`stackedit-db`、`stackedit_data` 标记、`imgCleanupSvc` 的 `^\.stackedit-` 匹配器、`githubHelper` 模板仓库 URL、`static/` 目录、代码注释中的历史溯源。

## Acceptance criteria

- [ ] About 弹窗无任何 Gitee/Chrome/邮箱/联系方式，含一行 StackEdit 致谢与许可证、隐私策略链接，FAQ 正常渲染。
- [ ] 全局 `rg -i stackedit src` 结果中，除红线清单与代码注释外无用户可见残留。
- [ ] 导出（styled HTML 系模板）产物引用 `kedit.cc.cd/style.css`，浏览器打开样式正常。
- [ ] 备份下载文件名、新手 Tour、各 provider 弹窗均无 StackEdit 字样。
- [ ] `npm run build` 通过。

## Blocked by

None - can start immediately.
