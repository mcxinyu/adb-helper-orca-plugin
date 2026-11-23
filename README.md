# ADB Helper（Orca 插件）

在 Orca 侧边栏中查看 Android 设备、设备详情与实时 logcat。首个里程碑覆盖：设备发现（本地 ADB 优先、Orca 终端回退）、设备详情、实时 logcat 流、日志过滤、中英文界面，以及把选中原始输出交给 Orca agent 的“问 AI”。

## 前置条件

- Orca `>= 1.4.259`
- Node.js（本地 ADB 命令通过插件 worker 的 Node 进程执行）
- 已安装 `adb` 并加入 `PATH`，或在插件设置中指定 adb 可执行文件的完整路径（可含空格）
- 已启动 adb server（`adb start-server`），并至少连接一台设备
- “问 AI”需要当前存在一个 Orca workspace（agent 会在 workspace 的新终端中启动）

## 安装与审批

这是一个 `trusted-worker` 插件，首次加载需要审批，因为它会以你的账户权限运行 Node 代码，并申请以下能力：

- `settings:own` / `storage:own`：保存 adb 路径、界面语言、上次选中的设备
- `workspace:read`：寻找承载终端/agent 的 workspace
- `terminal:send` / `terminal:read`：设备发现回退路径
- `agent:launch` / `agent:read`：“问 AI”启动 agent
- `workspace:write`：把启动的 agent 终端切到前台
- `notifications:show`：启动 agent 后弹系统通知

开发加载首次会返回 `approval_required` 与一个 `ap1-...` 指纹。确认授权后带上该指纹重新执行：

```sh
orca plugin dev load . --approve <指纹>
```

同一开发目录内后续代码修改无需重复审批；新增能力或提升执行级别需要重新审批。

## 开发

```sh
npm install
npm run build          # 构建 React UI 到 panel/
npm run typecheck      # TypeScript 类型检查
npm test               # ADB 解析单元测试

orca plugin types .    # 生成/刷新 .orca/types
orca plugin validate . # 校验 manifest
orca plugin check .    # 静态检查
orca plugin dev watch . # 加载并监听日志/热重载，Ctrl-C 卸载
```

修改 UI 源码在 `web/src/`，修改 worker 在 `src/`。`panel/` 是构建产物，不要直接编辑。

## 配置

在 Orca 的插件设置中可配置：

- **ADB 可执行文件路径**：默认 `adb`
- **界面语言**：`zh-CN`（默认）或 `en`，面板内也可切换，选择会持久化
- **logcat 默认过滤标签**：启动时附加 `-s <tag>`
- **“问 AI”使用的 agent**：默认 `opencode`，可改为本机已安装并启用的其他 agent（如 `codex`、`claude`）

## 使用

1. 打开右侧的 ADB Helper 面板，设备列表自动加载。
2. 点击一台设备查看型号、Android 版本与序列号（未授权设备不可选）。
3. 选中设备后点“开始 logcat”，会在一个 Orca 终端中运行 adb logcat；日志实时显示并默认自动滚到最新。你一旦主动滚动（滚轮/拖动滚动条），视图就停止跟随，可点“↓ 回到最新”恢复。过滤框只过滤显示，不改变原始内容。即使 worker 空闲重启，终端日志也会继续被读取。
4. “复制原文”复制完整原始输出；在日志区选中一段文本后才会出现“问 AI”，点击后只把选中的文本发送给 Orca agent 解释。
5. 在日志区选中一段文本后会弹出浮动菜单：点“复制”复制选中文本，点“问 AI”弹出对话框——可选择智能体和历史会话（或新会话），可编辑选中文本与提示词（默认“解释下这段信息：{selected-text}”）。发送后在当前 workspace 启动/恢复 agent，把提示词发给它，并把 agent 终端切到前台、弹出通知。取消选区（点击别处）时浮动菜单自动隐藏。

## 已知限制

- 本里程碑不支持截图、录屏、无线连接、应用操作或远程（SSH/WSL）设备。
- 日志历史不跨 worker 重启持久化；面板最多保留 1000 行。
- 原始 ADB/logcat 输出不做翻译，以保持可复制与可排错。
