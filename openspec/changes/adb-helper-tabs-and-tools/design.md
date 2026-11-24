# 设计

## 背景

动机见 `proposal.md`。当前插件已完成第一个里程碑（设备列表 + 实时 logcat + 问 AI），实现集中在单个 `web/src/App.tsx` 与 `src/worker.ts`。manifest 已是 `trusted-worker`，具备 settings/storage/workspace/terminal/agent/history/notifications 等能力。worker 通过 `node:child_process` 调用 adb，logcat 运行在 Orca 终端中。

Orca host API 提供 `files.saveAs`（panel 侧，接受 string 或 ArrayBuffer，≤64 MiB），但插件桥接 `plugin.request` 只传 JSON，二进制不能经请求回传。

## 目标 / 非目标

**目标：**
- 面板改为 Tab 布局，设备列表/选择常驻，所有 Tab 共享同一选中设备。
- 五个 Tab：实时日志、截图、录屏、应用管理、命令面板；无线连接作为设备区常驻入口（见决策 5）。
- 复用现有 adb 桥接与 worker 请求模式；所有 adb 命令仍由 worker 的 Node 进程执行。
- 中英文 i18n 与版本栏在 Tab 化后保持一致。

**非目标：**
- 不替用户安装/配置 adb 或启动 adb server。
- 使用 HTML 面板原生文件输入/拖放读取 APK 字节；Orca 插件 host API 没有 `files.open`，JS 也拿不到完整本地路径。选中文件通过 `plugin.request` 分片（约 45 KiB/片）传给 worker，worker 追加写入系统临时文件，再执行 `adb -s <serial> install -r <tempPath>`，结束后删除临时文件。手动输入完整路径仍保留，作为更直接的安装方式。
- 不在本变更中支持远程（SSH/WSL）设备。
- 不持久化截图/录屏文件内容到插件 storage（只保存到用户选定的本地路径）。
- 不实现 adb 之外的平台工具（如 fastboot）。

## 决策

### 1. Tab 布局与共享设备状态

面板顶部为常驻设备区（列表 + 详情 + 刷新 + 当前设备标识），下方为 Tab 栏与 Tab 内容。选中设备 serial 提升到 App 顶层 state，通过 props 传给各 Tab；切换 Tab 不改变选中设备。实时日志、问 AI、高亮等既有 UI 迁入“实时日志”Tab，逻辑尽量不改动。

### 2. 截图：base64 过桥 + panel 侧保存

worker 执行 `adb -s <serial> exec-out screencap -p`，把 stdout 以 base64 字符串返回（JSON 可传）。panel 侧把 base64 解码为 ArrayBuffer，调用 `orca.host.call('files.saveAs', { suggestedName, mimeType: 'image/png', data })` 保存。面板同时用 `<img src="data:image/png;base64,...">` 预览。需要该文件保存能力在面板侧可用（files.saveAs 无需额外 capability，但需用户点击触发）。

### 3. 录屏：终端/子进程 + 文件先落临时路径

录屏是长操作且产生二进制流。worker 用 `adb -s <serial> shell screenrecord <path>` 写入 adb 可执行目录下的临时文件（插件 storage 目录或系统临时目录）；开始/停止作为两个请求，停止后 worker 读取文件为 base64 返回 panel，panel 用 `files.saveAs` 保存。录屏期间面板显示状态与计时。由于 worker 可能被回收，录屏进程与临时文件路径写入 storage 以便恢复状态；若 worker 重启后进程不在，标记失败并清理临时文件。

### 4. 应用管理：文件选择/拖放 + 手动路径兜底

Orca 插件 host API 没有打开文件对话框的 host API，且浏览器 `File` 对象不给完整本地路径。安装 APK 通过 HTML 面板原生文件输入/拖放读取字节，分片传给 worker 写入临时文件后执行 `adb -s <serial> install -r "<tempPath>"`；同时保留面板内输入框让用户填写本机 APK 路径（可含空格），worker 直接执行 `adb -s <serial> install -r "<path>"`。其余操作用固定命令：`pm list packages`、`<package>` 启动/停止（`am start`/`am force-stop`）、`pm clear`。返回原始输出展示。

### 5. 无线连接：设备区常驻入口 + 历史 + 当前无线设备

无线连接与“选中的设备”无关（它本身就是建立连接），因此不作为 Tab，而是放在顶部设备区“无线连接”按钮展开的面板中。`adb connect`/`adb disconnect` 执行后刷新设备列表；面板显示“当前无线连接设备”（从设备列表中筛出 serial 为 `IP:端口` 形式的项，可点击填入目标并断开）与连接历史（storage:own，点击重连）。

### 6. 命令面板：白名单命令

面板提供常用 adb 命令按钮（如 devices、shell getprop ro.build.version.release、shell dumpsys battery、shell pm list packages 等）。worker 用统一命令执行器运行并返回原始输出。不允许用户自由输入任意命令，避免命令注入与权限扩大。

### 7. i18n 与能力

所有新增 UI 文案进 i18n 资源包（中/英）。manifest 能力尽量复用现有（settings/storage/terminal/workspace/agent/notifications/history）；若 `files.saveAs` 无需声明 capability，则不新增。新增设置：截图保存默认目录名、录屏时长上限、默认 agent 等按需要补充。

## 风险 / 权衡

- **[截图数据大] →** 限制预览分辨率（adb screencap 原始尺寸可能很大），base64 仅用于单次预览与保存，不入 storage。
- **[录屏文件可能超过 64 MiB] →** 限制录屏时长（如默认 30 秒、上限 180 秒），超限提示用户分次录制。
- **[worker 回收中断录屏] →** 录屏状态与临时路径写 storage；面板轮询状态，worker 重启后若能找到文件则允许保存，否则报错清理。
- **[APK 路径需手输或选择] →** 提供路径输入框、浏览按钮和拖放提示；选中文件走分片上传，手输路径直接交给 adb。
- **[命令面板注入风险] →** 只用固定白名单命令，serial 与参数做转义/校验。

## 迁移计划

先完成 Tab 容器与设备区抽取，保持“实时日志”Tab 行为不变并验证；再逐个加入其它 Tab 与 worker 请求，每个 Tab 单独验证。现有 change `adb-device-logcat-mvp` 暂不归档，待本变更完成后一并归档或按项目约定处理。

## 待定问题

无阻塞问题。截图/录屏在真机上的性能表现、不同 Android 版本 screenrecord 参数差异可在实现时用真机验证。
