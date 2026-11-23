# Spec Delta

## Purpose

让用户能在 ADB Helper 面板中管理选中设备上的应用：查看包列表、安装、卸载、启动、停止和清除数据。

## ADDED Requirements

### Requirement: 查看已安装包
系统 SHALL 列出选中设备上已安装的包，并支持按文本过滤。

#### Scenario: 列包成功
- **WHEN** 用户选中在线设备并请求列出包
- **THEN** 面板显示包名列表并可按输入过滤

### Requirement: 应用操作
系统 SHALL 支持对指定包执行启动、停止、清除数据操作。

#### Scenario: 启动应用
- **WHEN** 用户选择一个包并点击启动
- **THEN** 系统通过 adb 启动该应用并展示原始输出或错误

#### Scenario: 清除数据失败
- **WHEN** adb 无法清除所选包的数据
- **THEN** 面板显示本地化错误且保持包列表可用

### Requirement: 安装与卸载应用
系统 SHALL 允许用户通过输入本机 APK 路径安装应用，并卸载指定包。

#### Scenario: 安装 APK
- **WHEN** 用户提供本机 APK 路径并确认安装
- **THEN** 系统通过 adb 安装到选中设备并展示结果

#### Scenario: 卸载应用
- **WHEN** 用户选择包并确认卸载
- **THEN** 系统卸载该包并展示结果

### Requirement: APK 路径来源说明
系统 SHALL 明确说明 APK 路径需要用户手动输入，因为插件无法打开文件选择器。

#### Scenario: 用户查看安装说明
- **WHEN** 用户进入安装操作
- **THEN** 面板显示路径输入提示且界面不声称可以浏览文件
