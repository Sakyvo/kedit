Status: done

## Parent

批5 UX（grill-with-docs 收敛，无独立 PRD）

## What to build

修复目录（Toc）跳转「仅第一次有效、之后页面位置不变」的回归。

根因：跳转使用 `sectionDesc.editorElt` 的一次性 DOM 快照；第一次跳转触发的重渲染会换代节点，之后读到的是游离节点（`offsetTop ≈ 0`），钳制后看起来像没动。

行为：点击目录项时按 section 序号（或与 `tocElt` 的对应关系）查询**当前**编辑区/预览区活 DOM，再算 `scrollTop`；贴顶/贴底钳制语义与现网一致。预览侧若同样依赖缓存节点，一并改为活查。

## Acceptance criteria

- [x] 同一文档内连续点击多个目录项，每次都能滚到对应标题（非仅第一次）
- [x] 跳转后标题贴顶/贴底钳制与现网一致，不出现系统性滚到顶/底错位
- [x] 编辑区与预览区目录跳转均可用（若两侧都有入口）
- [x] 切换文档后再跳转仍正确

## Blocked by

None - can start immediately

## Implement notes

- Pure helpers: `src/services/editor/tocJump.js`
- Wired in `Toc.vue` via `findSectionIndexByTocElt` + `computeTocJumpScrollTop` using live `sectionList`
- Harness: `test/unit/harness/tocJump.harness.mjs` + batch5 harness
