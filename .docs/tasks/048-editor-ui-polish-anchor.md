Status: anchor

# 048 编辑器体验打磨批次锚卡（矩形选择 + 快捷键 + 残留清理）

## Problem

Author（单用户）在五个独立场景下各有明确不满：Alt+拖拽没有矩形选择；「强制从远端覆盖」菜单项图标缺失（组件解析失败渲染为空）；About 弹窗及散落各处仍有 StackEdit 品牌残留；「立即同步」默认键 mod+s 不合手且不可在配置里调整；默认 Welcome file 名称含空格、内容冗长。

## Decisions

grill 收敛，用户全数确认：

1. **矩形选择 = 瞬态列模式**，非多光标 —— 决策与被否选项见 ADR 0014。Alt+mousedown 进入，自绘半透明矩形 overlay；松开保持高亮；`Ctrl+C` 复制各行段按行拼接、`Ctrl+X` 复制+删除、`Backspace/Delete` 一次删各行段（单个可撤销编辑）；任何其他输入/点击退出列模式恢复普通光标。右边界超行尾的行选到行尾。仅桌面鼠标，触屏不受影响。编辑器默认等宽、无软换行，行 = DOM 行。
2. **同步快捷键**：默认 `mod+shift+s`（Mac 即 Cmd+Shift+S）；原删除线默认键取消（配置里可自行绑定，顶栏按钮不受影响）。配置 UI「顶栏按钮」小节**末尾**追加「同步」行：无拖拽手柄、不可作为拖放目标、无启用 checkbox、仅快捷键捕获输入框；拖拽排序插入逻辑显式排除该行，保证永远钉在末尾。
3. **About 弹窗**：删除 Gitee StackEdit 链接、Chrome 应用/扩展死链、mafgwo 邮箱与整个「联系我们」块；保留 logo、版本号、FAQ（已 KEDIT 品牌化）、Apache 许可证与隐私策略链接，**保留一行致谢「基于开源项目 StackEdit (Apache-2.0)」**（Apache 2.0 重分发署名要求）。
4. **StackEdit 残留**：可见文案（Tour Star 引导、预设链接、大文档导出链接、Dropbox/CouchDB 示例文本、备份下载文件名、Drive 工作区文件夹名）全部 KEDIT 化或删除死链；4 个导出 Handlebars 模板外链 `stackedit.cn/style.css` 改为自托管 `https://kedit.cc.cd/style.css`；`package.json` 元数据（name/description/bugs）改 KEDIT。**持久化标识符一律不碰**：`.stackedit-data/`、`.stackedit-trash/`、`stackedit-app-data`、`resetStackEdit`、`stackedit-db`、`stackedit_data` 标记（ADR 0005）。`githubHelper` 的 `mafgwo/stackedit-appdata-template` 模板仓库 URL **保留**（功能性 URL，改掉需先自建模板仓库，本次仅标注）。
5. **Welcome file**：新名 `welcome-file`、内容 `hi`；`syncSvc.isTempFile` 同时匹配新名 `welcome-file` 与遗留名 `Welcome file`（内容 hash 门槛不变）——防止既有设备上未编辑过的旧欢迎文件因改名突然变成"真文件"被推上私有仓库。
6. 「强制从远端覆盖」图标：补 `CloudRefresh`（MDI cloud-refresh，与现有 src/icons 同风格同机制注册），修复空图标 bug。

## Out of scope

- 完整多光标列编辑（ADR 0014 已否决）。
- `static/`（landing 营销页 + sitemap.xml）的 StackEdit 品牌清理——疑似死资产，如需处理另起批次。
- `githubHelper` 模板仓库 URL 切换到自建仓库。
- 触屏/移动端列选择。
- 旧欢迎文件的主动迁移/删除（仅靠名字兼容 + hash 门槛兜底）。

## Testing strategy

Jest 链已断，唯一 CI 门槛 `npm run build`。逐任务以真机 dev 验收为主：

- 矩形选择（053）：验收清单见任务卡——多行矩形、短行截断、列复制粘贴结果逐行对齐、单次 undo 完整回滚列删除、点击/键入即退出、不影响普通选择与拖拽文本移动。
- 快捷键（051）：默认键生效、配置捕获改键生效、删除线默认键为空、同步行不被拖拽排序移动。
- 纯文案/常量类（049/050/052）：构建通过 + 逐处人工核对清单。
