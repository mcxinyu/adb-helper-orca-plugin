# 设计

## 背景

动机见 `proposal.md`。仓库当前包含一个生成的 Orca 面板插件（`local.adb-helper`），带有占位的 `panel/index.html`、一份仅声明 `workspace:read` 的 manifest，以及空的 `src/` 和生成的 `.orca/types/`。

相关的 Orca API 约束是：插件代码没有通用的 shell/child-process API。宿主 API 包括终端创建、文本输入与输出读取；受信任 worker 可以注册命令、处理面板请求、发布面板事件，并使用自有的 settings/storage。因此长驻日志流无法建模为单次请求/响应命令。复用 ADB server 意味着插件无需拥有独立的后端进程，但仍需一种方式保持 logcat 流存活，并把输出喂给面板。

## 目标 / 非目标

**目标：**
- 验证端到端闭环：设备列表、设备选择、设备详情与面板内实时 logcat。
- 为设备选择与流状态保持单一事实来源。
- 支持混合发现模型：优先 ADB server 方式，Orca 终端输出作为回退。
- 提供简体中文与英文 UI，支持区域格式化、本地化设备状态与错误，并提供持久化的显式语言选择。
- 保留 ADB 原始输出不变，并提供“问 AI”操作，将所选输出交给 Orca agent 解释。
- 使用 Orca 自有的 settings/storage 保存配置与轻量状态。
- 为后续里程碑（截图、录屏、无线连接、应用操作、命令面板）建立扩展点。

**非目标：**
- 替用户安装、启动或配置 ADB。
- 在本里程碑实现截图、录屏、无线连接/断开、应用操作或通用命令面板。
- 本里程碑支持通过 SSH/WSL workspace 触达的远程设备。
- 跨插件重启持久化完整日志历史。
- 翻译 ADB 原始输出本身；原始输出保持逐字不变以便复制和调试。
- 在面板内嵌入 AI 聊天；“问 AI”改为交接给 Orca agent 终端。

## 决策

### 1. React + Vite 面板构建到 `panel/`

面向用户的 UI 将用 React 实现，并构建到现有的 `panel/` contribution 目录。源码位于 `panel/` 之外，构建步骤把静态产物输出到 `panel/`。

考虑过的替代方案：
- **纯 HTML/CSS/JS：** 零构建，但随着后续里程碑增加更多工具，设备列表、流状态、过滤器与错误状态会变得难以维护。
- **Orca TSX 组件面板：** 无构建步骤，但对于会成长为多个工具界面的应用而言，人体工学较窄。

### 2. 受信任 worker 作为面板后端

增加一个受信任 worker，负责 ADB 交互并向面板暴露带类型的命令/请求。面板只负责渲染状态，不拥有进程生命周期。

理由：
- worker 可以使用 `orca.host`、`orca.panels`、`orca.settings`、`orca.storage` 与 `orca.commands.register`。
- worker 可以发布面板事件，用于异步日志行与设备变化。
- 在一个地方集中执行设备选择与流所有权。

### 3. 混合 ADB 访问

设备发现优先使用本地 ADB 集成，不可用时回退到基于 Orca 终端的 `adb devices -l`。一次性简单命令可以走终端桥；长驻 logcat 通过专用适配器复用 ADB server。

考虑过的替代方案：
- **全部走终端：** 权限最简单，但不利于连续流式传输与结构化事件。
- **全部走本地后端服务：** 能力最强，但要求用户安装并运行另一个进程，与“复用 ADB server”的决策冲突。

### 4. 长驻 logcat 作为 Orca 终端 + 轮询

logcat 由 Orca 管理的终端进程运行（`terminal.create` 执行 `adb -s <serial> logcat`），而不是 worker 的 child_process。worker 暴露启动/停止操作以及 `adb.pollLogcat` 轮询请求；worker 对终端输出按行去重、分配 seq 后返回，UI 定时轮询并按 seq 追加，同时在本地过滤与自动滚动。日志视图默认跟随最新行；用户一旦主动滚动（滚轮、触摸、方向键或拖动滚动条）即停止跟随，直到点击“回到最新”或重新启动/切换 logcat。worker 将 terminalId、seq 基数与上次行窗口存入 `storage:own`，即使在空闲被回收后重启也能从终端继续读取，不丢流。

理由：
- Orca 会回收空闲 worker（日志中有 `worker reaped after idle period`）；若 logcat 是 worker 子进程，流会随 worker 回收而中断。终端由 Orca 管理，不受此影响。
- 轮询 + seq 去重避免 `orca.panels.post` 的 200 条/10 秒频率上限（早期逐行推送曾触发 `too many posts` 丢日志）。
- 切换设备时先关闭旧终端，自然保证至多一个活跃流。

### 5. 配置与状态存储

用户设置（如 ADB 可执行文件路径、首选日志级别与 UI 语言）存于 `settings:own`。轻量状态（如最后选中的设备或最近发现的设备）存于 `storage:own`。本里程碑不涉及敏感值。

### 6. 能力与审批模型

manifest 只声明本里程碑所需的能力：自有 settings、自有存储，以及用于回退路径的基于终端执行。每一项新增都经过 Orca 审批流程审查；不假设拥有无限制的 shell/进程能力。

### 7. 国际化

所有用户可见的面板文本来自简体中文与英文的语言资源包，通过语言控件选择并经 `settings:own` 持久化。日期、时间与数字使用浏览器的 `Intl` API 按当前语言格式化。已知设备状态与 ADB 错误码映射为本地化标签，而 ADB 原始输出从不翻译。缺失翻译时回退英文，语言选择在 worker 重载后保留。

考虑过的替代方案：
- **自动跟随 Orca UI 语言：** 当前宿主 typings 未暴露 locale/language API，自动检测不可靠；因此采用插件级显式选择。
- **翻译原始输出：** 因会破坏 ADB/logcat 文本的复制、搜索与调试而拒绝。

### 8. 问 AI 交接

“问 AI”入口：选中文本后的浮动菜单（复制 / 问 AI），点“问 AI”打开对话框，用户可选择智能体、选择历史会话或新会话，并自行编辑选中文本与提示词。默认提示词模板为“解释下这段信息：{selected-text}”，其中 {selected-text} 用当前选中文本替换。用户取消选区（点击别处、折叠选区等）时，浮动菜单自动隐藏。

Orca 原生终端的“添加到聊天”是 renderer 内部能力（React 组件 + 内存 store + `mode:'add-to-chat'`），未暴露为 command id / host API / CLI / IPC，插件无法直接触发；其 draft 语义（文本进输入框不发送）在插件 API 里也无等价物，因此采用上面的对话框方案（立即发送）。

后端：`adb.listAgents` 从历史会话里实际出现过的 agent 加一组常见候选动态汇总（不调用 CLI——worker 的 Node 环境里 `orca` 解析到 Electron 入口，无法可靠执行子命令）；`adb.listSessions` 用 `agent.listSessions` 列出历史会话。新会话走 `agent.launch` 带 prompt；已有会话走 `agent.resume` 恢复后用 `terminal.sendText` 发送提示词。由于 `agent.launch/resume` 固定后台启动，launch/resume 后调用 `terminal.focus` 切到前台，并用 `notifications.show` 通知，向面板返回明确成功/失败消息。agent 可配置（默认 `opencode`）；无 workspace 或 agent 不支持某会话恢复时给出可操作错误。

所需能力：`agent:launch`、`agent:read`、`history:read`（列会话）、`workspace:read`、`workspace:write`（聚焦终端）、`notifications:show`。

考虑过的替代方案：
- **面板内 AI 聊天：** 没有用于直接同步 AI 补全的宿主 API；插件 API 也无法直接打开预填 prompt 的 chat。
- **从插件调用外部 AI 服务：** 本里程碑拒绝，因为会引入网络能力、API key 处理与新的信任边界。
- **嵌套 `orca agent launch --surface chat` CLI：** worker 里 `orca` 解析到 Electron 入口，无法可靠执行子命令，不采用。

## 风险 / 权衡

- **[ADB server 未运行] →** 提供清晰错误状态与已记录的前置条件；本里程碑不自动启动或安装 ADB。
- **[终端回退基于文本] →** 防御式解析 `adb devices -l`，解析失败时呈现错误，而不是展示错误设备。
- **[面板关闭后日志流泄漏] →** 面板卸载时调用 stopLogcat 关闭终端；worker 停用/回收后终端仍在，但下次启动会先关闭旧终端，避免多流并存。
- **[日志量过大] →** 终端输出按 seq 去重、面板限 1000 行；使用轮询而非事件推送，规避 `too many posts` 频率上限。
- **[终端列宽折断长日志行] →** 接受终端渲染的换行；原始文本仍可通过“复制原文”获取。
- **[语言回退掩盖未翻译文本] →** 开发构建中让回退到英文键可见，并在集成检查中审阅两种语言资源包。
- **[问 AI 把原始日志暴露给 agent] →** 启动前显示显式确认与目标 workspace；绝不未经用户点击就发送数据。
- **[问 AI 无可用 workspace] →** 用本地化说明禁用该操作，并提供打开 workspace 的引导。

## 迁移计划

没有既有用户或持久化数据。在 manifest 中启用新 worker 与能力，用构建后的 React 输出替换占位 `panel/index.html`，然后校验并加载开发插件。回滚方式是恢复生成的 `panel/index.html` 并从 manifest 移除 worker/能力。

## 待定问题

本里程碑没有阻塞性问题。后续里程碑可重新评估是否需要专用本地后端，以支持更丰富的录屏或设备侧文件操作。
