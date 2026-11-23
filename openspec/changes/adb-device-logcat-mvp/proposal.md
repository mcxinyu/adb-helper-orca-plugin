# 提案

## 为什么

在 Orca 中，Android 开发者目前没有一等公民的方式去查看已连接设备、检查设备基本状态，或者在不必切换到独立终端窗口的情况下跟踪实时日志。插件骨架已经存在，但还没有交付任何面向用户的 ADB 工作流。

第一个里程碑建立一个可用的闭环：在 ADB Helper 面板中发现设备并流式查看日志。它同时验证核心架构假设——简单命令可以通过 Orca 终端运行，而长驻的日志流可以复用本地 ADB server。

## 变更内容

- 用 React + Vite UI 替换占位面板。
- 增加一个受信任的 worker，向面板暴露带类型的命令/请求。
- 展示已连接的 Android 设备，包括在线/离线/未授权状态及基本详情。
- 为选中设备启动和停止实时 logcat 流，并向用户展示启动/停止状态与错误。
- 使用混合设备来源：本地 ADB 集成可用时优先使用，不可用时回退到 Orca 终端执行 `adb devices -l`。
- 用户配置存入 Orca 插件 settings，轻量状态存入插件 storage。
- 添加该里程碑所需的插件能力与审批，以支持基于终端的命令执行以及自有的 settings/storage。
- 支持简体中文与英文的面板 UI 文案、区域格式、设备状态与 ADB 错误信息；保留 ADB 原始输出不变。
- 提供“问 AI”操作，将选中的原始输出连同本地化问题说明交给 Orca 中的 agent 进行解释。

## 能力

### 新增能力

- `adb-device-management`：发现 Android 设备、读取基本设备详情，并在 ADB Helper 面板中呈现连接状态。
- `adb-logcat`：为选中设备启动、流式展示、过滤和停止实时 logcat 输出。

### 修改的能力

无。

## 影响

- `orca-plugin.json`：增加 worker contribution、命令/请求/事件，以及 settings/storage 与基于终端执行所需的能力。
- `panel/`：将生成的 HTML 面板替换为构建后的 React 应用。
- 新增 `src/` 下的 worker 与共享 API 代码，用于命令执行、设备发现、日志流、区域设置与 AI 交接。
- 新增与本地 ADB server/CLI 通信的 ADB 桥接模块。
- 本地化资源文件，以及通过插件 settings 持久化的语言选择器。
- React + Vite 构建工具链及相应的校验/检查流程。
- 本地 ADB 安装及运行中的 ADB server 仍是外部前置条件。
- “问 AI”需要一个已有的 Orca workspace，因为 `agent.launch` 会在 workspace 中启动 agent 终端。
