# Spec Delta

## Purpose

为 Android 开发者提供一种可靠的方式，在 ADB Helper Orca 面板中查看已连接设备及其当前状态，包括本地 ADB 集成不可用时的情形。

## ADDED Requirements

### Requirement: 已连接设备列表
系统 SHALL 展示本地 ADB server 已知的 Android 设备，并且 MUST 在用户刷新或检测到设备状态变化时更新列表。

#### Scenario: 设备可用
- **WHEN** 本地 ADB server 报告一台或多台设备
- **THEN** 面板展示每台设备的序列号与当前状态

#### Scenario: 无可用设备
- **WHEN** 本地 ADB server 报告没有设备
- **THEN** 面板显示空状态提示，而不是陈旧列表

### Requirement: 混合设备发现来源
系统 SHALL 在本地 ADB 集成可用时使用它，并且 MUST 在本地集成不可用时回退到基于 Orca 终端的 `adb devices -l` 发现方式。

#### Scenario: 本地 ADB 集成不可用
- **WHEN** 用户刷新设备且本地 ADB 集成无法访问
- **THEN** 系统使用 Orca 终端获取设备输出，并仍然向用户展示设备

#### Scenario: 两种发现来源均失败
- **WHEN** 本地 ADB 集成与基于 Orca 终端的发现均失败
- **THEN** 面板显示可操作错误，说明两处失败

### Requirement: 基本设备详情
系统 SHALL 在 ADB 能够提供时，展示选中设备的基本详情。

#### Scenario: 设备在线
- **WHEN** 用户选中一台在线设备且 ADB 返回详情属性
- **THEN** 面板至少展示型号、Android 版本与设备序列号

#### Scenario: 详情获取失败
- **WHEN** ADB 无法返回选中设备的详情
- **THEN** 面板显示详情错误，并保持设备列表可用

### Requirement: 设备状态呈现
系统 SHALL 区分在线、离线、未授权与未知设备状态。

#### Scenario: 设备未授权
- **WHEN** ADB 报告设备为未授权
- **THEN** 面板以当前语言将设备标记为未授权，并阻止需要授权的细节操作

### Requirement: 本地化呈现
系统 SHALL 使用用户所选语言展示设备状态、详情标签与 ADB 错误消息，同时 MUST 保留 ADB 原始输出不变。

#### Scenario: 语言切换
- **WHEN** 用户在简体中文与英文之间切换插件语言
- **THEN** 设备状态、详情标签与错误消息更新为所选语言，而 ADB 原始输出不变

#### Scenario: 缺少翻译
- **WHEN** 某个标签在所选语言中缺失
- **THEN** 系统显示对应的英文，而不是空值
