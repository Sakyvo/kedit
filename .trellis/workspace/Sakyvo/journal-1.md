# Journal - Sakyvo (Part 1)

> AI development session journal
> Started: 2026-06-01

---



## Session 1: Doc panel backend operations

**Date**: 2026-06-14
**Task**: Doc panel backend operations
**Branch**: `master`

### Summary

Added Document timestamp metadata, explorer sorting, workspace move/duplicate/export service operations, focused tests, and spec notes for the timestamp contract and current Jest harness blocker.

### Main Changes

- Added `createdOn` / `updatedOn` metadata for Document file items.
- Added explorer sort state and comparator support for name, modified, and created time.
- Added workspace service operations for move, duplicate, and Markdown export.
- Added focused service/store tests for timestamps, sorting, duplicate, move, and export contracts.
- Captured the timestamp metadata contract and the current Jest harness blocker in frontend specs.

### Git Commits

| Hash | Message |
|------|---------|
| `b8547b8f` | (see git log) |

### Testing

- [OK] `npm run build`
- [OK] `git diff --check`
- [BLOCKED] `npx jest --config test/unit/jest.conf.js test/unit/specs/services/workspaceSvc.spec.js --runInBand` fails before loading tests because `package.json` sets `"type": "module"` while `test/unit/jest.conf.js` uses CommonJS `require`.

### Status

[OK] **Completed**

### Next Steps

- Archive only after explicit human approval.


## Session 2: Doc panel backend

**Date**: 2026-06-16
**Task**: Doc panel backend
**Branch**: `master`

### Summary

Completed and archived doc-panel backend work: file timestamp metadata, sorting comparator support, and backend file operations.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b8547b8f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: Trim StackEdit cruft

**Date**: 2026-06-18
**Task**: Trim StackEdit cruft
**Branch**: `master`

### Summary

Removed the legacy badge subsystem, made external image hosts dormant, cleaned obsolete badge-era branches, updated state-management spec, and validated the trim-cruft task.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d7e2667a` | (see git log) |
| `6554c423` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: Toolbar: single-row horizontal-scroll formatting bar (FE)

**Date**: 2026-06-18
**Task**: Toolbar: single-row horizontal-scroll formatting bar (FE)
**Branch**: `master`

### Summary

NavigationBar pagedown 按钮行改 flex nowrap + overflow-x 横滑（隐藏滚动条、保留触摸滑动），移动端全部格式/图片按钮可达、桌面不变；清掉 pagedownClick 冗余 getContent()+trim-cruft 残留空 if。静态校验通过，视觉/构建验证待 06-04 装依赖。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c1e7c76d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: Doc panel frontend: sort/rename/menu/mobile long-press (FE)

**Date**: 2026-07-01
**Task**: Doc panel frontend: sort/rename/menu/mobile long-press (FE)
**Branch**: `master`

### Summary

Explorer 头部排序按钮(名称/修改/创建×升降，复用 backend comparator)；修 ExplorerNode 重命名 get/set bug(绑 editingValue+进入编辑灌原名+聚焦全选)；右键菜单加 移动到…/复制副本/导出.md(调 workspaceSvc moveItem/duplicateFile/exportMarkdown)；移动端长按 500ms 唤菜单 + 二级 contextMenu 文件夹选择器替代触屏拖拽。静态校验通过，构建/视觉验证待用户。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `93b4ab4e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 6: TOC side drawer: click-to-jump + toolbar entry (FE)

**Date**: 2026-07-01
**Task**: TOC side drawer: click-to-jump + toolbar entry (FE)
**Branch**: `master`

### Summary

NavigationBar 加目录按钮(icon-toc)→toggleToc 开 SideBar 的 toc 面板(复用抽屉)；Toc.vue 比例拖拽→点击跳转(平滑滚动到标题顶)、字号9→13px、放开 pointer-events+悬停高亮、保留 mask；tocDimension 实测 DOM 故字号变更自适应。静态校验通过，视觉验证待用户。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e52e4da0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: Ordered-list auto-number boundaries

**Date**: 2026-07-02
**Task**: Ordered-list auto-number boundaries
**Branch**: `master`

### Summary

Fixed ordered-list auto-numbering so thematic breaks end a list and later lists renumber independently.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `46701398` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: Mobile copy/cut selection sync

**Date**: 2026-07-03
**Task**: Mobile copy/cut selection sync
**Branch**: `master`

### Summary

Synced cledit selection state before clean Markdown copy/cut and added mobile selectionchange/touchend triggers.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a4fc980e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 9: Preview frontmatter render rule

**Date**: 2026-07-03
**Task**: Preview frontmatter render rule
**Branch**: `master`

### Summary

Added a render-only markdown-it frontmatter block rule so leading YAML metadata renders as dedicated preview markup without rewriting Document source or becoming a setext heading.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9444d679` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 10: Preview frontend CSS + PWA stale-cache diagnosis

**Date**: 2026-07-05
**Task**: Preview frontend CSS + PWA stale-cache diagnosis
**Branch**: `master`

### Summary

preview-frontend: frontmatter 胶囊/长链接换行/去标题分隔线(0cb21efd)。诊断 kedit.cc.cd 侧栏无反应+修复不显现: deploy job 瞬时失败(Deployment failed, try again later)+registerType:prompt 的 SW 卡死在早期半残部署的 precache; 修 rebrand 漏网 index.html+PWA manifest(start_url /app→/)。用户侧需清一次站点数据。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0cb21efd` | (see git log) |
| `a74882c9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 11: Hotfix toggles + app-data migration to kedit-app-data

**Date**: 2026-07-05
**Task**: Hotfix toggles + app-data migration to kedit-app-data
**Branch**: `master`

### Summary

修复 trim-cruft 签名错位导致侧栏/资源管理器点击无反应(bf7aca6e, 已部署验证); spec 记教训; 将 Sakyvo/stackedit-app-data 全量历史迁至私库 Sakyvo/kedit-app-data 并切换 GitHub 通道 appDataRepo 常量, ADR-0005 增补 Revision。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `bf7aca6e` | (see git log) |
| `d22f6bed` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 12: 07-06 批量UX修复与手动排序上线

**Date**: 2026-07-10
**Task**: 07-06 批量UX修复与手动排序上线
**Branch**: `master`

### Summary

18项UX需求全量交付并部署: v-focus/v-title Vue3钩子迁移(修重命名遮罩+复活tooltip); 新建文件去模板; 插图按钮移位; TOC去tap蓝框; 滚动条最小滑块; 侧栏X层级返回; 桌面单同步按钮+侧边栏300px; logo全量替换; 编辑区伪标题正则修复+frontmatter; 未登录同步登录提示; 回收站永久删除; 移动端代理滚动手势; 排序菜单重构+手动排序(explorerOrder同步数据项+桌面/移动拖拽+开关). 已知缺陷: explorerOrder以本地id为键不能跨设备同步, 转入07-10任务修复(根因已定位:git型工作区每设备随机uid).

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `506787cb` | (see git log) |
| `31fe3372` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
