# Spec Delta

## Purpose

让设备列表与当前选中的设备在面板的所有 Tab 之间共享，保证用户切换工具时无需重新选择设备。

## ADDED Requirements

### Requirement: 常驻设备区
系统 SHALL 在面板顶部常驻显示设备列表与当前选中设备，且在切换 Tab 时保持不变。

#### Scenario: 切换 Tab 保留设备选择
- **WHEN** 用户选中一台设备后切换到另一个 Tab
- **THEN** 系统保持该设备为选中设备并在顶部区域显示

#### Scenario: 设备离线
- **WHEN** 当前选中设备变为离线或断开
- **THEN** 所有 Tab 都基于该状态禁止需要在线设备的操作并显示本地化提示

### Requirement: 统一的设备变化通知
系统 SHALL 在设备列表或选中设备变化时通知所有打开的 Tab。

#### Scenario: 刷新后设备变化
- **WHEN** 刷新设备后设备列表发生变化
- **THEN** 每个 Tab 视图都反映最新设备列表与状态
