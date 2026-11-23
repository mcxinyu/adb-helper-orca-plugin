# 提案

## 为什么

ADB Helper 的第一个里程碑已经验证了架构：React 面板 + 受信任 worker + adb 桥接 + 基于终端的 logcat，并交付了设备列表与实时日志。但最初规划的能力还有截图、录屏、应用操作、无线连接和命令面板没有实现，且当前面板是单视图，无法容纳这些并列工具。

把这些能力做成与“实时日志”并列的 Tab，设备选择作为所有 Tab 共享的常驻区域，可以让用户在一个面板里切换完成所有 ADB 常见操作，而不必在多个界面间跳转。

## 变更内容

- 将面板重构为 Tab 布局：顶部为常驻的设备列表/选择区，下方为可切换的功能 Tab。
- Tab 集合：实时日志（现有）、截图、录屏、应用管理、无线连接、命令面板。
- 截图：对选中设备执行 `adb exec-out screencap -p`，在面板预览并可保存到本地文件。
- 录屏：开始/停止 `adb shell screenrecord`，保存到本地文件并显示状态。
- 应用管理：安装 APK、卸载、启动/停止应用、清除数据、查看已安装包列表。
- 无线连接：`adb connect`/`adb disconnect`，并保存连接历史（插件 storage）。
- 命令面板：一组常用 adb 命令按钮，输出展示在面板内。
- 新增这些操作所需的 worker 请求、事件、manifest 能力与设置项。
- 保持现有设备列表、logcat、问 AI、i18n、版本栏与高亮功能在 Tab 化后继续可用。

## 能力

### 新增能力

- `adb-screenshot`：对选中设备截取屏幕并在面板中预览、保存。
- `adb-screenrecord`：开始和停止设备录屏，并保存录制文件。
- `adb-app-management`：安装、卸载、启停应用，清除应用数据，列出已安装包。
- `adb-wireless`：通过 IP/端口连接或断开设备，并管理连接历史。
- `adb-command-palette`：把常用 adb 命令作为按钮执行并展示输出。
- `adb-device-sharing`：设备选择作为跨 Tab 共享状态与统一通知。
- `adb-logcat-tab`：实时日志作为 Tab 迁入后的行为契约。

### 修改的能力

无。第一个变更 `adb-device-logcat-mvp` 尚未归档，主 specs 中还没有对应能力可修改；待两个变更一起归档时合并同名能力。

## 影响

- `web/src/App.tsx`：从单视图重构为 Tab 容器 + 各功能子组件；设备区常驻。
- `web/src/`：新增各 Tab 的 React 组件与 i18n 文案扩展。
- `src/worker.ts`：新增截图、录屏、应用管理、无线连接、命令执行相关的请求处理器。
- `src/`：新增 adb 命令封装（screencap/screenrecord/pm/am/connect/disconnect）与本地保存桥接。
- `orca-plugin.json`：按需增加文件保存、通知等能力与设置项。
- OpenSpec 主 specs（归档后）：合并新的能力规格与对现有能力的修改。
