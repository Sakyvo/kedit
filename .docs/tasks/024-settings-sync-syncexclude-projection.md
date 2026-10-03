Status: review

# settings 纳入同步 + syncExclude 投影层

## Parent

`.docs/tasks/018-visual-settings-config.md`

## What to build

让 settings 跨设备 Sync，并按 ADR 0010 加按设备排除的文本投影：

- 启用 `syncSvc.js` 中被注释的 `syncDataItem('settings')`；核对四触点
  （empty 工厂/getter 已存在，`gitWorkspaceSvc` 白名单正则已含 `settings`，
  补上同步触点与 `syncDataById` 首次路径现状核对）。
- 投影层（复用 019 服务的剥除/合并能力）：上传前从 yaml 文本剔除本机
  `syncExclude` 键集（默认内置 `colorTheme/fontSizeFactor/maxWidthFactor`，
  与用户 yaml 里的 `syncExclude` 取并集，键本身永不同步）；下载应用远端
  yaml 时，本机被排除键保本机值（把远端文本与本机排除值合并回完整文本）。
- 两端对键的归属分歧 = 不同步。
- `.docs/spec/state-management.md` 增补「Settings Sync + syncExclude」契约节。
- vm 沙盒验证：模拟两端（A 排除 colorTheme、B 不排除）双向同步脚本。

## Acceptance criteria

- [x] 非排除键（如 autoSyncEvery、headButtonOrder）跨设备一致。（投影算法双端剧本 node 用例通过；真实双机同步留人工验收——需含 GitHub workbench 的线上环境）
- [x] 排除键在两端保持各自本机值，且不随上传/下载漂移。（同上剧本覆盖）
- [x] 单改排除键最多触发一次内容不变的空载同步（已知噪音，不消除）——投影哈希驱动，只改排除键不触发上传。
- [x] state-management.md 契约节已更新；术语与 CONTEXT.md「Device-local
  setting」一致。
- [x] `npm run build` 通过。

实现备注：syncSvc.syncDataItem 对 settings 走专属分支——脏检查/远端变更比较/上传体
一律投影（`settingsYamlSvc.projectForSync`），store 条目恒为全量本地文本。

## Blocked by

- `019-settings-yaml-line-surgery-svc.md`
