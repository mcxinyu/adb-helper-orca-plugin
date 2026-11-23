# Spec Delta

## Purpose

让 Android 开发者能够在 ADB Helper Orca 面板中为选中设备启动、查看、过滤和停止实时 logcat 输出，而无需单独管理一个终端窗口。

## ADDED Requirements

### Requirement: 按设备隔离的 logcat 流
系统 SHALL 仅流式传输用户所选设备的实时 logcat 输出。

#### Scenario: 用户在线上设备启动 logcat
- **WHEN** 用户选中一台在线设备并启动 logcat
- **THEN** 面板接收并展示该设备产生的日志行

#### Scenario: 流式传输期间设备变化
- **WHEN** 用户在 logcat 流激活时选中另一台设备
- **THEN** 系统在为新设备启动任何流之前先停止原有流

### Requirement: logcat 生命周期控制
系统 SHALL 提供显式的启动与停止控件，并且 MUST 向用户报告激活/停止状态。

#### Scenario: 用户停止激活的流
- **WHEN** 用户停止当前激活的 logcat 流
- **THEN** 流终止，且不再追加新的日志行

#### Scenario: 流意外结束
- **WHEN** logcat 进程退出或在标记为激活时失去连接
- **THEN** 面板将流显示为已停止，并给出失败原因

### Requirement: 日志过滤
系统 SHALL 允许用户通过文本查询过滤展示的日志行，而无需停止流。

#### Scenario: 用户应用过滤
- **WHEN** 用户在 logcat 流式传输期间输入文本过滤条件
- **THEN** 面板仅展示包含该查询的日志行，并保留底层已捕获的日志行

#### Scenario: 用户清除过滤
- **WHEN** 用户清除文本过滤条件
- **THEN** 面板恢复展示此前捕获的日志行

### Requirement: 流失败处理
系统 SHALL 呈现阻止 logcat 启动或继续的 ADB server、设备及权限相关失败。

#### Scenario: ADB server 未运行
- **WHEN** 用户启动 logcat 且无法访问 ADB server
- **THEN** 面板显示错误，指出 ADB server 可用性问题

#### Scenario: 设备拒绝 logcat 访问
- **WHEN** 设备拒绝 logcat 访问
- **THEN** 面板显示本地化的拒绝原因，并保持设备列表可用

### Requirement: 日志高亮展示
系统 SHALL 按 logcat 优先级（V/D/I/W/E/F）与字段（时间戳、PID、TID、标签、正文）对日志行着色展示，并且 MUST 保留原始日志行文本逐字不变（复制时无损）。界面语言切换不改变日志原始文本。

#### Scenario: 不同优先级的日志
- **WHEN** 日志行包含 E/W/I/D/V 等优先级
- **THEN** 系统用对应颜色标注优先级字母，不使用整行背景色，且原始文本保持不变

#### Scenario: 字段分区
- **WHEN** 日志行为标准 logcat 格式
- **THEN** 时间戳、PID、TID、标签与正文分别以可区分的样式展示，且复制内容与原文一致

### Requirement: 对原始输出使用问 AI
系统 SHALL 仅在用户选中一段原始 ADB/logcat 文本后提供“问 AI”操作，并打开一个对话框让用户选择智能体、选择历史会话或新会话，以及编辑选中文本与提示词。默认提示词为“解释下这段信息：{selected-text}”，其中占位符用选中文本替换。系统 MUST 按用户确认的提示词原文发送，不做翻译。

#### Scenario: 用户针对选中文本问 AI
- **WHEN** 用户在日志区选中一段文本、激活“问 AI”、确认对话框并发送
- **THEN** 系统按所选智能体与会话启动或恢复 Orca agent，并把对话框中的提示词逐字发送给它

#### Scenario: 用户编辑提示词或文本
- **WHEN** 用户在对话框中编辑提示词或选中文本后发送
- **THEN** 系统发送编辑后的内容，而不是原始默认值

#### Scenario: 没有选中文本
- **WHEN** 用户没有选中任何日志文本
- **THEN** 面板不显示“问 AI”操作

#### Scenario: 无可用 workspace
- **WHEN** 用户发送“问 AI”但没有任何 Orca workspace 可承载 agent
- **THEN** 面板显示本地化错误，说明需要 workspace，且不发送任何输出
