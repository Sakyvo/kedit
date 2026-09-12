Status: open

## Parent

批6 pdir 直发追加（/plan 收敛，规划文件 `.claude/plans/publish-progress-popup.md`）。

## What to build

发布到 pdir 时的悬浮进度弹窗：右下角卡片展示步骤级进度（读取内容源 → 逐张图片
上传/覆盖/复用 → 写入正文），可最小化为「发布中 k/N」药丸继续后台展示，点击还原；
成功停留约 4s 自动收场，失败停在出错步骤并显示消息（既有错误通知不动）。弹窗纯
展示，发布仍在队列异步执行，关闭仅隐藏 UI。

- 会话级 Vuex 模块承载状态（不持久化、不进同步数据）。
- 组件挂 Layout 根层，z-index 取新阶梯值 50（低于 modal/notification），并同步
  增补 `.docs/frontend-conventions.md` 的 Overlay Z-Index Ladder。
- 仅接入 pdir 直发（唯一多步骤多图流）；其余 provider 不接入。

## Acceptance criteria

- [ ] 发布含多图文档：弹窗逐图走进度（上传/覆盖实时、复用瞬时 done），最小化
      药丸计数正确，成功约 4s 自动收场
- [ ] 重发零上传场景：全部复用瞬时 done，整体秒完
- [ ] 发布失败（断网/无权限/模块缺失）：弹窗停在 error 步骤并显示消息，错误
      通知照常弹出
- [ ] 最小化后发布继续，点击药丸还原完整视图；关闭后发布不受影响
- [ ] 弹窗层级不遮挡模态与通知（z-index 50 入阶梯文档）

## Blocked by

- `011-pdir-image-pipeline.md`
