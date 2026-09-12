Status: open

## Parent

批6 pdir 直发（grill-with-docs 收敛，无独立 PRD）。领域术语见 CONTEXT.md（Module 等）。

## What to build

最小直发闭环：发布菜单顶部新增「发布到 pdir」，把当前 Document 发布进 pdir 的某个
Module（保留 Module 标题行，只替换正文）。

- 入口门控：仅存在 login 为 Sakyvo 的 GitHub token 时渲染；仓库访问权限由发布动作时
  GitHub API 自然校验，无权则报错通知。
- 图标：pdir 站点 favicon，尺寸与发布菜单其他图标规格一致。
- 合一确认弹窗：实时解析 pdir 单源 main.md 的模块清单（H2 Part / H3 Module，与 pdir
  后台同规则）；首发选模块、重发显示既有目标模块；内嵌 commit message 输入；点
  「确认发布」才动手。重发也必经此弹窗，永不静默直发。
- 发布动作：下载 main.md → 定位目标 Module（按标题文本）→ 替换其正文 → 上传；
  Module 不存在时报错并允许重选。`_index.json` 不动。
- 标准 publishLocation（providerId `pdir`，记录模块标题文本），接通「已发布/立即发布/
  文件发布管理」既有体系；providerId 不进 gitProviderIds 通用弹窗链（提交信息由专属
  弹窗承载）。
- 临时护栏：Document 引用 `/imgs/` 私有图时拒发并提示（011 图片管线解除）。

## Acceptance criteria

- [ ] 无 Sakyvo token 时菜单无此项；有则出现在发布菜单顶部第一项，图标规格一致
- [ ] 首发：弹窗列出当前全部 Module，确认后目标 Module 正文被 Document 替换，
      Module 标题行不变，pdir 公开页可见新内容
- [ ] 重发：「立即发布」经同一确认弹窗（显示目标模块+提交信息）；Module 被删时
      报错且可重选
- [ ] publishLocation 出现在「文件发布」管理弹窗中，可查看可删除
- [ ] 含 `/imgs/` 私有图的 Document 被拦截并提示等待图片管线
- [ ] 无仓库权限的 token 发布时收到明确错误通知

## Blocked by

None - can start immediately
