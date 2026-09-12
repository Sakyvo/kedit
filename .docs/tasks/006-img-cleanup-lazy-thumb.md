Status: done

## Parent

批5 UX（grill-with-docs 收敛，无独立 PRD）

## What to build

图片引用检测弹窗懒加载缩略图 + 落盘。

## Acceptance criteria

- [x] 本地无缓存的未引用图：滚入可见区后出现缩略图（成功路径）
- [x] 再次打开弹窗 / 同机再次扫到该 path：优先本地缓存，不重复全量拉取
- [x] 失败/离线：保持「无预览」，不阻塞删除勾选与其它条目
- [x] 打开弹窗不一次性请求全部图；仅可见区（及合理预取缓冲）发起请求
- [x] 删除所选等既有清理操作不受影响

## Blocked by

None - can start immediately

## Implement notes

- `imgThumbLazy.js`; ImageCleanupModal IntersectionObserver + syncImg on miss
