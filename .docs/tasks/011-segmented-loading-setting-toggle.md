Status: review

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

- [x] `npm run build` 通过（exit=0，全量 39.7s）
- [x] 配置 → 可视化中出现「性能」组且位于「常规」上方，开关默认开
      （tmp-verify-011.mjs 断言字段描述序与默认值；视觉确认见人工项）
- [x] 关闭后重启/重开文档走旧全量管线——标志位 `editorSvc.segmentedLoadingEnabled`
      + 开关翻转日志 `[kedit] 长文档分段加载：开/关` 可证；
      本卡内 ON/OFF 皆为旧管线（分段管线的第一刀在 012 切入），无行为分叉风险
- [x] 开关值改动持久化（settingsYamlSvc set 往返断言通过）；
      跨设备 Sync 实效见人工项（sync 投影保留开关已断言）

## 人工验收项（skipped-manual）

1. 打开 配置 → 可视化：顶部出现「性能」组（位于「常规」上方），开关
   「长文档分段加载」默认开。
2. 关闭开关 → 刷新页面 → 控制台出现 `[kedit] 长文档分段加载：关`；
   重新开启后日志为「开」。
3. 双设备：一侧改开关，另一侧设置同步生效（非 Device-local settings）。

## Blocked by

None - can start immediately
