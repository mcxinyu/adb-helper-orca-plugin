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

### Requirement: 区域感知的日志展示
系统 SHALL 使用当前语言展示日志时间戳与面向用户的日志标签，并且 MUST 保留原始日志行文本不变。

#### Scenario: 语言使用不同日期格式
- **WHEN** 日志展示期间语言发生变化
- **THEN** 面向用户的时间戳按当前语言重新格式化，而每条原始日志行保持不变

### Requirement: 对原始输出使用问 AI
系统 SHALL 允许用户将选中的原始 ADB 或 logcat 输出发送给 Orca agent 进行解释，且不得翻译或修改选中的输出。

#### Scenario: 用户针对某日志行问 AI
- **WHEN** 用户选中一条原始日志行并激活“问 AI”操作
- **THEN** 系统启动一个 Orca agent，附带本地化说明并逐字包含所选原始文本

#### Scenario: 无可用 workspace
- **WHEN** 用户激活“问 AI”但没有任何 Orca workspace 可承载 agent
- **THEN** 面板显示本地化错误，说明需要 workspace，且不发送任何输出
