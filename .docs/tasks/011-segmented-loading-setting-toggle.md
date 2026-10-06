Status: open

## Parent

010-long-doc-segmented-loading.md（决策见 ADR-0012）

## What to build

用户逃生开关「长文档分段加载」端到端落地，为后续所有分段管线改动提供总闸。

- 设置默认值新增 `segmentedLoading: true`（默认**开启**）。
- 配置 → 可视化页签内新建「性能」组，**位于「常规」组上方**，组内第一个字段
  即开关「长文档分段加载」（toggle），走 settingsYamlSvc 既有读写路径
  （ADR 0009/0010）。
- editorSvc 在读入口处接线：开关 OFF 时整个文档加载/击键管线保持现状
  （旧全量路径），ON 时进入后续卡片实现的分段路径；开关语义先落位，
  本卡内 ON 的行为与现状一致（分段管线的第一刀由后续卡片切入）。
- 开关跟随普通设置 Sync；如真机与桌面需要不同值，Author 可自行加入
  Device-local settings（syncExclude），本卡不预设。

## Acceptance criteria

- [ ] `npm run build` 通过
- [ ] 配置 → 可视化中出现「性能」组且位于「常规」上方，开关默认开
- [ ] 关闭后重启/重开文档走旧全量管线（以全局标志位或日志可证）
- [ ] 开关值改动持久化，且随设置 Sync 到另一设备

## Blocked by

None - can start immediately
