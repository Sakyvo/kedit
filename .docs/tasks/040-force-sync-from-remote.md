Status: done

# 040 强制从远端覆盖按钮（清文档库+红警示确认）

## 背景

移动端「文档全空 + 同步无改善 + 远端仓库正常」是本地 IndexedDB 数据层断裂
的现网事件。原有「重置应用程序」会清所有 workspace + settings + 授权，粒度
过粗。需要一个范围更小的救援操作。

## 实现

- **入口**: MainMenu「重置应用程序」正上方新增「强制从远端覆盖」菜单项
- **确认**: 新模态 ForceSyncFromRemoteModal —— 红色警示 + 顶部红条 +
  「请输入当前工作区名以确认」手输校验（大小写及空白敏感），按钮在匹配前
  disabled
- **执行**: 写 `localStorage.forceSyncFromRemote = 1` 后 reload；
  `localDbSvc.init` 检出此 flag 时调用
  `forcedClearCurrentWorkspaceData()` —— `indexedDB.deleteDatabase(utils.
  getDbName(currentWorkspace.id))` 删当前 workspace 的整个 IDB 库；与
  workspaceSvc.removeWorkspace 不一样，**保留 workspace 登记、OAuth token、
  settings、layoutSettings、imgCleanup、pdirMarks、SyncManagement history**
- **重建**: reload 后 syncSvc.init 正常工作，getChanges + prepareChanges
  把远端 git tree 作为变更源，本地完全空 → 所有远端文件走下载重建；既有
  sync 链路自有该自愈路径，不需新增 sync 代码

## 验证

- 构建: terser 完整门槛通过
- agent_browser 实测: 入口顺序 ✓（强制从远端覆盖在重置应用程序上方）、
  模态开启 ✓、手输匹配校验 ✓（空/错名 disabled、对工作区「主文档空间」
  可点）、确认后端到端清库 ✓（`indexedDB.databases()` 只剩初始库、欢迎
  文档重建）
- 末点「远端全量重拉」依赖在线 OAuth + 真实仓库，属 sync 既有链路正确性
  领域，在本地 preview 环境不可验证；如未来真机验收发现不自愈，另立任务

## 安全设计点

- 工作区名必须手输避免误点；「覆盖」二字不设关键词陷阱（多语言环境会出坑）
- 确认后按钮文案切换为「正在清理…」防止双击
- 远端仓库本身不会被修改（只删本地 cache）
