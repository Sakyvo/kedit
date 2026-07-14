# KEDIT

## 项目定位

个人单作者在线 Markdown 编辑器（StackEdit fork），文档以私有 GitHub 仓库
（kedit-app-data）为唯一持久化源，手动 Publish 喂给 pdir 公开展示。
领域术语与概念边界见 CONTEXT.md。

## 技术栈与结构

- 技术栈：Vue 3.5（Options API）+ Vuex 4 + Vite；编辑器 = cledit + Prism 语法高亮；预览 = markdown-it；Python/Flask 支持层。
- 结构：
  - `src/services/` — 业务逻辑（editorSvc/syncSvc/workspaceSvc/localDbSvc…）
  - `src/services/providers/` — 远端 provider 专属逻辑
  - `src/store/` — Vuex 模块；`src/extensions/` — markdown-it 配置
  - `server/` — Flask 支持层（OAuth/导出），规则见就近 `server/AGENTS.md`
  - `.docs/` — 开发文档（adr/issues/guides/archive）

## 常用命令

- 构建：`npm run build`（唯一 CI 门槛；Jest 测试链已断，勿依赖）
- 运行：`npm run dev`
- 部署：push master → GitHub Pages workflow 自动部署 https://kedit.cc.cd/

## 常驻法则

- Git：任务执行前 `git pull`；工作到达可验证节点（实现完成、修复完成、阶段产出）后一律自动 `git commit` + `git push`，无需等待确认——push 同时触发 Pages 部署供真机验收。仅当用户主动要求暂缓时跳过，且仅对当次生效。
- 沿用 Options API + Vuex 既有模式；不引入 Composition API 或新状态库。
- 业务逻辑写进 `src/services/`，provider 专属逻辑写进 `providers/`；组件内不复制服务逻辑。
- 保留 StackEdit 时代持久化标识符（`.stackedit-data/`、`.stackedit-trash/`、`stackedit-app-data`、`resetStackEdit`）；品牌重塑只改可见文案。
- 原始 Markdown 是唯一存储源；预览只允许渲染层分歧，不回写源文本。
- 私有图片私有落盘（IndexedDB + git blob）；base64 仅为 Publish/复制的瞬态投影，绝不存入文档。
- 联动：新增随工作区同步的 data 条目，必须按 `.docs/state-management.md` 的四触点接线（empty/getter/syncDataItem/git 白名单），且禁止把本地 item id 写入跨设备数据（用 git 路径）。
- 联动：新增浮层必须取用 `.docs/frontend-conventions.md` 的 z-index 阶梯值，不得裸写。

## 按需读取索引

- 涉及领域术语（Author/Document/Sync/Publish 等）→ 读 `CONTEXT.md`。
- 改 Vuex/持久化/同步数据契约 → 读 `.docs/state-management.md`。
- 写改组件、样式、指令、浮层 → 读 `.docs/frontend-conventions.md`。
- 找文件或目录迷路 → 读 `.docs/directory-structure.md`。
- 需要架构决策背景（fork/私有仓库/图片模型/预览分歧/品牌） → 读 `.docs/adr/`。
- 部署 OAuth 应用或大文档导出 → 读 `.docs/guides/`。
- 考古历史任务（Trellis 时代 13 个任务+journal） → 读 `.docs/archive/trellis-tasks/INDEX.md`。

## 优先级

1. 用户当前明确指令。
2. 更近目录的 `AGENTS.md`（如 `server/AGENTS.md`）。
3. 本文件。
4. 本文件路由到的 `.docs/*.md` 细则。
