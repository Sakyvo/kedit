Status: done

## Parent

批5 UX（grill-with-docs 收敛，无独立 PRD）

## What to build

修复编辑模式下私有图片诡异纵向拉伸 + 闪屏回归。

## Acceptance criteria

- [x] 编辑区图片在宽被 `max-width` 约束时保持比例，不再纵向拉伸
- [x] 切换文档、再切回同一文档，不因陈旧尺寸缓存再次拉伸
- [x] 刷新后行为正常；正常加载路径无新增闪屏
- [x] 预览区图片显示不回归

## Blocked by

None - can start immediately

## Implement notes

- `imgSizeGuard.js`; editorSvc onload/preset guards; CSS `height: auto` on `.img-wrapper img`
