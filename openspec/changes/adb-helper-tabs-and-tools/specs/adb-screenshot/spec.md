# Spec Delta

## Purpose

让用户能在 ADB Helper 面板中对选中设备截取屏幕，在面板中预览并保存到本机文件。

## ADDED Requirements

### Requirement: 截取设备屏幕
系统 SHALL 对当前选中的在线设备执行截屏，并在面板中显示预览。

#### Scenario: 设备在线时截图
- **WHEN** 用户选中一台在线设备并触发截图
- **THEN** 系统获取该设备当前屏幕图像并在面板中显示预览

#### Scenario: 无选中设备
- **WHEN** 用户未选中设备或设备不在线时触发截图
- **THEN** 面板显示本地化错误且不发起截图

### Requirement: 保存截图
系统 SHALL 允许用户把预览的截图保存到本机文件。

#### Scenario: 用户保存截图
- **WHEN** 用户点击保存并提供文件名
- **THEN** 系统通过文件保存对话框把 PNG 写入用户选择的位置

### Requirement: 截图失败处理
系统 SHALL 呈现截图过程中的设备与 ADB 错误。

#### Scenario: ADB 拒绝截图
- **WHEN** adb screencap 失败
- **THEN** 面板显示本地化错误且保留设备选择状态
