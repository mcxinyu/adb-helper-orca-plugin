# ADB Helper（Orca 插件）

在 Orca 侧边栏中管理 Android 设备。面板顶部是常驻的设备列表/选择区（含「无线连接」按钮，与选中设备无关），下方是五个可切换的 Tab：**实时日志、截图、录屏、应用管理、命令面板**。

## 前置条件

- Orca `>= 1.4.259`
- Node.js（ADB 命令通过插件 worker 的 Node 进程执行）
- 已安装 `adb` 并加入 `PATH`，或在插件设置中指定 adb 可执行文件的完整路径（可含空格）
- 已启动 adb server（`adb start-server`）
- “问 AI”需要当前存在一个 Orca workspace

## 安装与审批

这是 `trusted-worker` 插件，首次加载需审批（以你的账户权限运行 Node 代码）。申请的能力：

- `settings:own` / `storage:own`：配置、连接历史、录屏状态
- `workspace:read` / `workspace:write`：找 workspace、聚焦 agent 终端
- `terminal:send` / `terminal:read`：设备回退与 logcat
- `agent:launch` / `agent:read` / `history:read`：“问 AI”启动 agent、列历史会话
- `notifications:show`：启动 agent 后通知

开发加载返回 `approval_required` 与 `ap1-...` 指纹，确认后：

```sh
orca plugin dev load . --approve <指纹>
```

## 开发

```sh
npm install
npm run build          # 构建 React UI 到 panel/
npm run typecheck      # TypeScript 类型检查
npm test               # 单元测试

orca plugin types .
orca plugin validate .
orca plugin check .
orca plugin dev watch .
```

UI 源码在 `web/src/`，worker 在 `src/`，`panel/` 是构建产物不要直接编辑。

## 配置

Orca 插件设置中可配置：ADB 路径（默认 `adb`）、界面语言（`zh-CN`/`en`）、logcat 过滤标签、“问 AI”使用的 agent（默认 `opencode`）。

面板标题右侧的 ⚙ 按钮会弹出「插件设置」对话框，编辑的是与 Orca 设置页同一份配置（`orca.settings`），保存后立即生效（含界面语言切换），无需跳转。

## 使用

顶部选中一台在线设备后（状态对全部 Tab 共享），切换下方 Tab 使用不同工具；无线连接与设备选择无关，放在顶部设备区的「无线连接」按钮中。

1. **实时日志**：点“开始 logcat”在 Orca 终端运行 logcat；未选择设备时状态栏与日志区都提示“请先选择一台在线设备”。日志按优先级/字段着色，默认滚到最新，主动滚动后停止跟随（点“↓ 回到最新”恢复）。过滤框只过滤显示。选中日志文本后浮动菜单提供“复制 / 问 AI”；问 AI 打开对话框，可选 agent、历史会话或新会话，编辑文本与提示词（默认“解释下这段信息：{selected-text}”），发送后聚焦 agent 终端。控制行从左到右为“开始 logcat / 停止 logcat / 清除日志”，最右侧是“在终端中打开”——它在 Orca 中另开一个终端页运行 logcat 并聚焦，不与面板内的日志视图共享同一个终端，因此“停止 logcat”不会关闭它。
2. **截图**：点“截取屏幕”，面板预览 PNG，点“保存到文件”通过系统对话框保存。
3. **录屏**：选时长上限，开始/停止录制，停止后可保存 MP4；录制中显示计时，达到上限自动结束。
4. **应用管理**：刷新并过滤包名列表，选中包后可启动/停止/清除数据/卸载；安装 APK 可点击“浏览 APK”或把 APK 拖入安装区域，也保留手动输入本机完整路径。选择的文件通过分片上传到 worker 临时文件后执行 `adb install -r`，分片约 45 KiB，以适配 Orca 面板消息大小限制。
5. **命令面板**：点击预定义命令按钮（Android 版本、型号、电池、第三方应用、IP、内存），原始输出显示在面板中；只运行白名单命令，不接受任意输入。
6. **无线连接**（设备区「无线连接」按钮）：输入 `IP:端口` 连接或断开，连接成功后自动刷新设备列表；面板显示「当前无线连接设备」列表（来自设备列表中 serial 为 `IP:端口` 的项）和连接历史，可点击重连或断开。当前无线设备行右侧另有 ✕ 图标按钮，可直接对该设备断开，无需先点行再点顶部按钮。

截图/录屏通过 Orca 的 `files.saveAs` 保存，插件不主动选择路径。面板底部固定显示版本号与编译号，便于确认加载的是最新构建。

## 已知限制

- 不支持远程（SSH/WSL）设备；不支持 fastboot。
- APK 可选择/拖放（≤512 MiB），也可手输本机完整路径。
- 录屏文件上限约 64 MiB（`files.saveAs` 限制），时长上限 180 秒。
- 原始 ADB/logcat 输出不翻译，以保持可复制与可排错。
