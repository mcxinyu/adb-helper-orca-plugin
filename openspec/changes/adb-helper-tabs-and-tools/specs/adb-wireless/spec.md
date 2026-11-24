# Spec Delta

## Purpose

让用户能在 ADB Helper 面板中通过 IP 和端口连接或断开 Android 设备，并复用之前的连接。

## ADDED Requirements

### Requirement: 无线连接与断开
系统 SHALL 允许用户输入 `IP:端口` 连接设备，并断开已连接的设备。

#### Scenario: 连接成功
- **WHEN** 用户输入有效的 IP 与端口并连接成功
- **THEN** 系统把该设备加入连接历史并刷新设备列表

#### Scenario: 连接失败
- **WHEN** adb connect 失败
- **THEN** 面板显示本地化错误并保留输入内容

### Requirement: 连接历史
系统 SHALL 保存最近的无线连接目标并允许用户点击重用。

#### Scenario: 从历史重连
- **WHEN** 用户点击连接历史中的一项
- **THEN** 系统用该目标执行连接并更新设备列表

### Requirement: 当前无线设备列表
系统 SHALL 在连接面板中显示当前已连接的无线设备（serial 为 `IP:端口` 形式的设备），并提供断开入口。

#### Scenario: 连接后显示无线设备
- **WHEN** 用户成功连接一台无线设备并刷新设备列表
- **THEN** 连接面板的“当前无线连接设备”中显示该设备，且可点击进行断开

### Requirement: 输入校验
系统 SHALL 校验连接目标格式，避免无效或危险输入。

#### Scenario: 非法目标
- **WHEN** 用户输入非 `IP:端口` 格式
- **THEN** 面板阻止连接并显示本地化格式提示
