Status: review

## 后台验证记录

- 三处联动已落：welcomeFile.md=hi、localDbSvc 创建名 welcome-file、syncSvc isTempFile 新旧名双匹配（hash/讨论数门槛不变）。
- vite build 通过。
- 剩余（人工验收）：清数据首启创建 welcome-file/hi；遗留 Welcome file 仍判临时不同步。

## Parent

`.docs/tasks/048-editor-ui-polish-anchor.md`

## What to build

新设备首次进入时的默认欢迎文件改为 `welcome-file`（不再含空格，git 路径友好），内容改为 `hi`。三处联动：

1. 默认欢迎文件内容源（`src/data/welcomeFile.md`）改为 `hi`；
2. 创建点（`localDbSvc` 的 `createFile`）名字改 `welcome-file`；
3. `syncSvc.isTempFile` 的欢迎文件判定改为**同时匹配 `welcome-file` 与遗留 `Welcome file`**，内容 hash 门槛与讨论数门槛不变——既有设备上未编辑过的旧欢迎文件继续被视作临时文件，不会因改名被推上私有仓库。

新内容的 hash 会在启动时自动登记进 `welcomeFileHashes`，无需迁移。

## Acceptance criteria

- [ ] 清空本地数据后首启，创建的文件名是 `welcome-file`，内容 `hi`。
- [ ] 未编辑的 `welcome-file` 不出现在同步仓库路径中（临时文件语义保持）。
- [ ] 模拟遗留 `Welcome file`（旧内容）在场时，它仍被判定为临时文件、不触发远端同步。
- [ ] `npm run build` 通过。

## Blocked by

None - can start immediately.
