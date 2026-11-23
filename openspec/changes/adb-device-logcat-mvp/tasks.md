# 任务

## 1. 工具链与 manifest 基础

- [ ] 1.1 添加 React + Vite 构建工具链，源码目录与输出到 `panel/` 的静态资源目录分离，并验证干净构建能产出预期静态文件
- [ ] 1.2 更新 `orca-plugin.json`，加入受信任 worker contribution、所需的 settings/storage/终端能力，以及声明的请求/事件，并验证 `orca plugin validate .` 通过
- [ ] 1.3 用 `orca plugin types .` 重新生成插件类型，并验证 `orca plugin check .` 不报告 manifest 或静态编辑器错误

## 2. ADB 访问层

- [ ] 2.1 实现 ADB 命令适配器，基于可配置的可执行文件路径构造命令，并兼容含空格的路径，验证单元测试覆盖 Windows 风格与 POSIX 风格路径
- [ ] 2.2 实现设备发现服务，读取 `adb devices -l`，解析序列号、状态与型号字段，返回稳定的设备模型，验证单元测试覆盖在线、离线、未授权、空输出与畸形输出
- [ ] 2.3 实现混合来源选择：本地 ADB 集成可用时优先，失败时回退到 Orca 终端，验证在本地路径不可用的测试或实际运行中仍能展示设备
- [ ] 2.4 实现对型号、Android 版本与序列号的基本设备详情查询，验证在线设备返回数据且 ADB 无法提供详情时给出清晰错误

## 3. Worker API 与状态所有权

- [ ] 3.1 添加受信任 worker，注册设备刷新、设备详情查询与 logcat 启动/停止的面板请求，并验证 `orca plugin dev request <dir> <name>` 对每个请求返回带类型结果
- [ ] 3.2 从 worker 向打开的面板发布设备与 logcat 事件，验证开发面板无需手动刷新即可用事件更新 UI
- [ ] 3.3 强制插件至多一个激活的 logcat 流，并在选中设备变化、面板关闭或 worker 停用时停止，验证每种停止条件后都不再有日志行到达
- [ ] 3.4 将 ADB 配置存入 `settings:own`、轻量状态存入 `storage:own`，验证取值在 worker 重载后保留且不持久化完整日志历史

## 4. React 面板 UI

- [ ] 4.1 构建设备列表与选择 UI，展示序列号、状态与基本详情字段，验证在 `orca plugin check .` 或开发面板中能渲染 worker 提供的设备数据
- [ ] 4.2 构建显式的 logcat 启动/停止控件、激活/停止状态与错误消息，验证每种状态在面板中可观察
- [ ] 4.3 构建对展示日志行的非破坏性文本过滤与有界日志视口，验证应用与清除过滤只改变展示内容
- [ ] 4.4 为设备发现与 logcat 添加空状态、加载中与失败状态，验证在模拟对应 worker 条件时各状态出现
- [ ] 4.5 添加简体中文与英文语言包、通过 settings 持久化的语言选择器，以及日期/时间/数字的区域格式化，验证切换语言更新所有 UI 文本与格式而不改变 ADB 原始输出
- [ ] 4.6 添加可复制的原始输出视图与“问 AI”操作，通过 `agent.launch` 将所选原始文本交给 Orca agent，验证 agent 收到逐字文本与本地化说明，且无 workspace 时出现清晰错误

## 5. 集成与文档

- [ ] 5.1 在 `README.md` 中记录 ADB 前置条件、插件审批步骤、语言选择、“问 AI”前置条件与开发命令，并验证文档命令在有 ADB 的机器上按文档运行
- [ ] 5.2 运行 `orca plugin validate .`、`orca plugin check .` 与开发加载，然后用真实 Android 设备手动验证设备列表、语言切换、“问 AI”交接与实时 logcat 闭环，并记录观察结果
- [ ] 5.3 对照 `../adb-device-logcat-mvp/specs/adb-device-management/spec.md` 与 `../adb-device-logcat-mvp/specs/adb-logcat/spec.md` 审查本变更，验证每一项需求都有对应交付任务与可观察检查

## 工作流后续

- 在审查要求满足后归档该变更。
- 验证归档结果。
