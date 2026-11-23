# Spec Delta

## Purpose

让用户能在 ADB Helper 面板中通过按钮执行一组常用 adb 命令，并在面板中查看原始输出。

## ADDED Requirements

### Requirement: 常用命令按钮
系统 SHALL 提供一组固定的常用 adb 命令按钮，作用于当前选中设备。

#### Scenario: 执行命令
- **WHEN** 用户选中设备并点击某个命令按钮
- **THEN** 系统执行对应 adb 命令并在面板展示原始输出

#### Scenario: 未选中设备
- **WHEN** 用户未选中设备时点击命令按钮
- **THEN** 面板提示需先选择设备且不执行命令

### Requirement: 命令白名单
系统 SHALL 仅允许执行预定义的命令集合，不允许用户自由输入任意命令。

#### Scenario: 用户尝试自定义命令
- **WHEN** 用户查看命令面板
- **THEN** 界面只展示预定义按钮，不提供任意命令输入框

### Requirement: 输出展示与错误处理
系统 SHALL 展示命令的标准输出与错误，并区分成功与失败。

#### Scenario: 命令失败
- **WHEN** adb 命令执行失败
- **THEN** 面板展示错误文本且不中断其它命令
