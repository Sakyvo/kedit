Status: open

## Parent

042-dynamic-loading-anchor.md

## What to build

设置更名与默认值翻转,与本批其余管线接线的最小手术:

- `defaultSettings.yml`:去掉 `segmentedLoading: true`,新增 `dynamicLoading: false`。
- `settingsFields.js`:可视化 → 性能组内,
  「长文档分段加载」改为「**动态加载**」。
- `segmentedLoading.js`:谓语改读新键并默认关 —— `settings.dynamicLoading === true`
  时才走分段管线;旧键直接废弃(单作者产品不迁移)。
- `editorSvc.js`:所有门控引用跟随新键;控制台日志文案改成「动态加载」。
- 同步对外灰度请保持:启用时仍插入钩子、关闭时回旧管线。
- 清理:`editorSvc.segmentedLoadingEnabled` 改名 `dynamicLoadingEnabled`?

## Acceptance criteria

- [ ] `npm run build` 过
- [ ] 默认关:不碰设置时进产品 = 旧全量管线(现网行为),无新日志
- [ ] 打开动态加载后,门面所有卡 010 的功能仍可用(窗口 diff/逐步高亮/预览窗口/行扫描 TOC)
- [ ] 旧设备上已存的 `segmentedLoading` 键不影响今天的行为(静默忽略)

## Blocked by

None — 可以立即开工