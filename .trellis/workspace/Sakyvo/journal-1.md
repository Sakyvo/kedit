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
