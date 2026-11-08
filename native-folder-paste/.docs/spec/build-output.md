# KEDIT Folder Paste 构建输出契约

## 归属与路径
仅覆盖 Windows 辅助程序及扩展，不迁移父项目网站发布树。

```target-layout
{"builds":[{"product":"KEDIT Folder Paste","buildRoot":"../..","targetRoot":".target","deliveryRoot":".target/.distribution","shortcutName":"KEDIT Folder Paste.lnk"}]}
```

## 产物子树
- `.target/release/`：csc Release 编译输出，每次成功构建更新。
- `.target/test/`：本批临时测试/浏览器证据；批次收尾删除。
- `.target/.distribution/app/`：可安装的主机 exe、扩展和安装/卸载脚本。
- `.target/.distribution/app-prev/`：上一已验收交付，仅待验收窗口保留。
- `.target/.distribution/zip/`：最新 `kedit-folder-paste.zip`。
不使用 NuGet，不另建编译缓存或 installer 形态。

## release / package 入口
在本目录运行 `pwsh -File build.ps1`；以 Windows .NET Framework 4.x `csc.exe` 编译，显式 `/target:exe /optimize+ /debug- /platform:anycpu`（stdio 主机；由浏览器无窗口启动），引用系统 `System.Web.Extensions.dll`。生成前校验本契约的身份与路径。
`pwsh -File build.ps1 -Package` 在自检通过后刷新 app、zip 和 delivery.json；构建失败不覆盖交付。

## 最低产品验收
后台：主机 `--self-test`；`node --test test/protocol.test.mjs ../test/node/folderPaste.test.js ../test/node/folderPasteExtension.test.js`；`pwsh -File test/install.test.ps1`（注册表隔离模拟）；父网站 `npm run build`。
前台人工：Vivaldi 安装扩展并注册主机，资源管理器复制单/多文件夹后粘贴，撤销/重做、普通文本/图片回归、其他网站及资源管理器复制不受影响。不为验收抢占用户桌面。

## 主入口
`.target/.distribution/app/KeditFolderPaste.exe`（Native Messaging 按需启动，无常驻界面）。

## 刷新与安装
功能完成刷新 app；批次结束 `-Package` 同步刷新 zip。需要前台验收，凭证保持 `pending-manual-acceptance`；验收通过才设为 accepted 并删除 app-prev。
安装由用户显式运行 `install.ps1`：文件复制到 `%LOCALAPPDATA%/KEDIT/FolderPaste/`，注册当前用户 Chrome NativeMessagingHosts 键（Vivaldi 使用此键）；运行时安装位置不作为第二份开发交付区。卸载只移除本工具拥有的键和安装文件，不影响其他主机。

## delivery.json 与输入
`.target/delivery.json` 记录 app/zip 状态、Release 参数、自检命令与时间、Git SHA、输入 SHA256、文件清单/大小/SHA256。输入为 `host/*.cs`、`extension/*`、`build.ps1`、`install.ps1`、`uninstall.ps1`、`README.md`，按相对路径排序计算指纹；文档规则不在输入集合。主机若运行于 app 目录，拒绝刷新 app 并保留 release 输出。

## 生命周期、预算与入口
仅任务新建的 test 临时文件可在任务结束删除。release 与交付保留；采用全局默认空间阈值。
聚合入口 `K:/Projects/distribution/KEDIT Folder Paste.lnk` 指向本产品 `.target/.distribution/`；首次生成后创建，同名不同目标不覆盖。
