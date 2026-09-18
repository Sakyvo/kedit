Status: open

## Parent

`.docs/tasks/000-copy-original-image.md`

## What to build

自家粘贴（命中标记）时若某条图片引用在当前工作区解析不到——复制后切换了工作区，
或本机 IndexedDB 里该图已被清理——不再照插引用然后破图，而是从剪贴板 html 的
data URL 中取回该图原始字节，走现有 updateImg 路径落盘进当前工作区，插入生成的新
引用文本。图片随内容走，跨工作区粘贴保持自包含。

解析得到就绝不落盘：同一工作区内粘贴仍然零新增图片（任务 014 的行为不被本任务退化）。

## Acceptance criteria

- [ ] `npm run build` 通过
- [ ] 工作区 A 复制含图选区 → 切到工作区 B 粘贴：图片出现在 B 的 imgs 目录、预览
      正常显示，插入的是新引用文本
- [ ] 同工作区内粘贴（图可解析）：无新增图片（回归任务 014）
- [ ] 选区含多张图、仅部分解析不到：只救回缺失的那几张
- [ ] data URL 同样缺失/损坏的极端情况：按引用原文插入，不抛异常

## Blocked by

- `014-marked-copy-payload-self-paste.md`
