# Spec Delta

## Purpose

把已有的实时 logcat 功能作为“实时日志”Tab 迁入 Tab 布局，保持其设备隔离、过滤、生命周期与高亮行为。

## ADDED Requirements

### Requirement: 实时日志 Tab
系统 SHALL 在 Tab 布局中提供“实时日志”Tab，承载 logcat 的启动、停止、过滤与高亮展示。

#### Scenario: 切换到实时日志 Tab
- **WHEN** 用户切换到“实时日志”Tab
- **THEN** 系统显示当前选中设备的 logcat 控件、日志区与已有日志，且不中断已运行的 logcat 流

#### Scenario: Tab 切换不中断流
- **WHEN** 用户在 logcat 运行时切换到其他 Tab 再切回
- **THEN** logcat 流继续运行且日志内容保留

### Requirement: 行为保持一致
系统 SHALL 保持 logcat 的设备隔离、单活跃流、基于终端的读取、文本过滤、优先级/字段着色与“回到最新”行为。

#### Scenario: 高亮与过滤仍可用
- **WHEN** 用户在实时日志 Tab 中应用过滤或查看不同优先级日志
- **THEN** 系统按既有规则着色并过滤展示，且不改变原始日志文本
