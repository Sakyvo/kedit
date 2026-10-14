Status: open

## Parent

042-dynamic-loading-anchor.md

## What to build

044 分片补齐后,目录条目所指向的编辑器段可能尚未构建。这一卡做
「点击目录 = 先补建目标段,再滚动定位」的**优先级补建**:

- `tocJump` 的 TOC 跳转路径上新增中间件:判定目标段是否已建;
  未建 → 通知分片队列把这部分段提到队列头(`prioritizeSection(index)`),
  在下一事件循环前完成该段及邻居的 build+mount,然后正常跳转。
- 复用 `resolveTocSectionIndex` 的段位置解析;数据一路通过 segmentIndex 判定。
- 保证打开中先点目录也一样安全,不破坏不变式。

## Acceptance criteria

- [ ] `npm run build` 过
- [ ] 打开后补齐未完时点 TOC 任意条目,编辑器准确跳到对应段(smooth scroll
      或 or direct setScrollTop,但最终落在正确的段落上)
- [ ] 双栏模式下预览同步落位(补建完成后再折叠掉窗口化)
- [ ] OFF 管线行为不变

## Blocked by

- 044-chunked-editor-init-build.md