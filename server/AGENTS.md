# server/ — Flask 支持层规则

Python/Flask 小型支持层：静态资源托管、OAuth token 交换、运行时配置、文档导出。产品行为几乎全部在前端（`src/`）。

## 边界（不可越）

- 路由保持薄桥：Documents/同步/provider 契约/持久化的业务规则属于 `src/services/` 与 Vuex，不进后端。
- **无数据库**：不引入 DB/ORM/迁移/队列/新后端服务，除非任务明确要求架构变更。持久化源 = 用户私有 GitHub 仓库 + 浏览器 IndexedDB（`src/services/localDbSvc.js`，`objects`/`imgs` 两 store）。
- 秘密只留服务端：公开配置仅经 `Config.public_values()`；绝不通过公共路由暴露 `Config.values()`。
- 私有图片保持私有落盘；后端不得制造公共图床，不得把 base64 存入 Document。
- 保留 StackEdit 时代持久化标识符：`.stackedit-data/`、`.stackedit-trash/`、`stackedit-app-data`、`resetStackEdit`——品牌重塑只改可见文案。

## 错误与日志

- 无全局错误信封，各路由自有响应形状（OAuth 失败 `jsonify({error}),400`；PDF 超时 408/未授权 401/其余 400 纯文本）——不要顺手统一；改形状必须同任务更新前端调用方。
- OAuth 助手用 `response.raise_for_status()`；子进程先校验参数（如 `AUTHORIZED_PAGE_SIZES`）、超时必杀、临时文件 `finally` 清理。
- 日志用标准 `logging`（级别由 `LOG_LEVEL`，访问日志由 `HTTP_ACCESS_LOG`）；`logger.exception` 只给意外失败。**禁止记录**：OAuth code/token/secret、Document 内容、图片/base64 载荷、完整导出请求体。

## 验证

- 无 Python 测试套件：改 `server/app.py` 或导出助手后手动冒烟路由；影响打包集成时跑 `npm run build`。
- 评审清单：秘密不出服务端？`/conf` 只吐公开配置？调用方契约保持？Sync（私有）vs Publish（公开）边界保持？临时文件/子进程/外部请求有界？

详情与结构参考：[.docs/directory-structure.md](../.docs/directory-structure.md)、[.docs/adr/](../.docs/adr/)。
