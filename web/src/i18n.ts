export type Locale = 'zh-CN' | 'en'

export interface Strings {
  appTitle: string
  settingsButton: string
  settingsTitle: string
  settingsAdbPath: string
  settingsAdbPathHint: string
  settingsLocale: string
  settingsLogcatTag: string
  settingsLogcatTagHint: string
  settingsAskAgent: string
  settingsAskAgentHint: string
  settingsSave: string
  settingsSaved: string
  refresh: string
  startLogcat: string
  stopLogcat: string
  openInTerminal: string
  openInTerminalFocused: string
  openInTerminalHint: string
  openInTerminalTooltip: string
  askAi: string
  languageLabel: string
  deviceListTitle: string
  deviceDetailTitle: string
  logcatTitle: string
  filterPlaceholder: string
  clearFilter: string
  stateDevice: string
  stateOffline: string
  stateUnauthorized: string
  stateUnknown: string
  fieldModel: string
  fieldAndroid: string
  fieldSerial: string
  noDevices: string
  loading: string
  logcatIdle: string
  logcatStarting: string
  logcatActive: string
  logcatError: string
  selectDeviceHint: string
  noWorkspaceError: string
  aiPromptHint: string
  copied: string
  rawOutputTitle: string
  sourcePrimary: string
  sourceFallback: string
  detailError: string
  jumpToLatest: string
  versionLabel: string
  buildLabel: string
  clearLogs: string
  manualCopyTitle: string
  manualCopyHint: string
  closeLabel: string
  copySelected: string
  askAiBusy: string
  askDialogTitle: string
  agentLabel: string
  sessionLabel: string
  newSession: string
  textLabel: string
  promptLabel: string
  promptTemplate: string
  sendLabel: string
  cancelLabel: string
  loadingOptions: string
  tabLog: string
  tabScreenshot: string
  tabScreenrecord: string
  tabApps: string
  tabWireless: string
  tabCommands: string
  takeScreenshot: string
  saveScreenshot: string
  shotPreview: string
  shotIdle: string
  shotBusy: string
  shotNoDevice: string
  shotSaved: string
  shotCancelled: string
  startRecord: string
  stopRecord: string
  saveRecord: string
  recordIdle: string
  recordBusy: string
  recordNoDevice: string
  recordLimitLabel: string
  recordActive: string
  recordSaved: string
  recordCancelled: string
  recordLimitReached: string
  appsNoDevice: string
  appsRefresh: string
  appsFilter: string
  appsInstall: string
  appsInstallHint: string
  appsStart: string
  appsStop: string
  appsClear: string
  appsUninstall: string
  appsResult: string
  appsBusy: string
  appsBrowse: string
  appsDropHint: string
  appsFileTooLarge: string
  appsUploading: string
  appsPermInput: string
  appsRevoke: string
  appsGrant: string
  appsPermRequired: string
  appsRevokeAll: string
  appsRevokeAllResult: string
  appsRevokeAllNone: string
  appsRevokeAllRevokedList: string
  appsRevokeAllFailedList: string
  wirelessInput: string
  wirelessConnect: string
  wirelessDisconnect: string
  wirelessHistory: string
  wirelessNoHistory: string
  wirelessCurrent: string
  wirelessNoCurrent: string
  wirelessInvalid: string
  wirelessResult: string
  wirelessBusy: string
  wirelessRowHint: string
  cmdNoDevice: string
  cmdDeviceInfo: string
  cmdModel: string
  cmdBattery: string
  cmdPackages: string
  cmdIpAddress: string
  cmdMemInfo: string
  cmdResult: string
  cmdBusy: string
}

const zhCN: Strings = {
  appTitle: 'ADB 助手',
  settingsButton: '设置',
  settingsTitle: '插件设置',
  settingsAdbPath: 'ADB 可执行文件路径',
  settingsAdbPathHint: '可包含空格；留空使用 PATH 中的 adb。',
  settingsLocale: '界面语言',
  settingsLogcatTag: 'logcat 默认过滤标签',
  settingsLogcatTagHint: '启动 logcat 时附加的 -s 标签过滤，可留空。',
  settingsAskAgent: '“问 AI”使用的 agent',
  settingsAskAgentHint: '需为本机已安装且启用的 agent。',
  settingsSave: '保存',
  settingsSaved: '设置已保存',
  refresh: '刷新设备',
  startLogcat: '开始 logcat',
  stopLogcat: '停止 logcat',
  openInTerminal: '在终端中打开',
  openInTerminalFocused: '已在 Orca 终端中打开 logcat',
  openInTerminalHint: '已在 Orca 终端中启动 logcat，请在 Orca 中查看该终端',
  openInTerminalTooltip: '在 Orca 终端页运行 logcat（不影响面板内的日志视图）',
  askAi: '问 AI',
  languageLabel: '语言',
  deviceListTitle: '设备',
  deviceDetailTitle: '设备详情',
  logcatTitle: '实时日志',
  filterPlaceholder: '过滤日志（不改变原始内容）',
  clearFilter: '清除过滤',
  stateDevice: '在线',
  stateOffline: '离线',
  stateUnauthorized: '未授权',
  stateUnknown: '未知',
  fieldModel: '型号',
  fieldAndroid: 'Android 版本',
  fieldSerial: '序列号',
  noDevices: '未发现设备。请确认 ADB 已安装、server 已启动并已连接设备。',
  loading: '加载中…',
  logcatIdle: '未开始',
  logcatStarting: '启动中…',
  logcatActive: '运行中',
  logcatError: '出错',
  selectDeviceHint: '请先选择一台在线设备',
  noWorkspaceError: '没有可用的工作区来启动 AI agent。',
  aiPromptHint: '将所选原文发送给 Orca 中的 AI agent 进行解释。',
  copied: '已复制到剪贴板',
  rawOutputTitle: '原始输出',
  sourcePrimary: '本地 ADB',
  sourceFallback: '终端回退',
  detailError: '无法获取设备详情',
  jumpToLatest: '回到最新',
  versionLabel: '版本',
  buildLabel: '编译号',
  clearLogs: '清除日志',
  manualCopyTitle: '自动复制被阻止，请手动复制',
  manualCopyHint: '下面的文本已全部选中，按 Ctrl/Cmd + C 复制。',
  closeLabel: '关闭',
  copySelected: '复制',
  askAiBusy: '启动中…',
  askDialogTitle: '问 AI',
  agentLabel: '智能体',
  sessionLabel: '会话',
  newSession: '新会话',
  textLabel: '选中文本（可编辑）',
  promptLabel: '提示词（可编辑）',
  promptTemplate: '解释下这段信息：{selected-text}',
  sendLabel: '发送',
  cancelLabel: '取消',
  loadingOptions: '加载中…',
  tabLog: '实时日志',
  tabScreenshot: '截图',
  tabScreenrecord: '录屏',
  tabApps: '应用管理',
  tabWireless: '无线连接',
  tabCommands: '命令面板',
  takeScreenshot: '截取屏幕',
  saveScreenshot: '保存到文件',
  shotPreview: '截图预览',
  shotIdle: '尚未截图',
  shotBusy: '截图中…',
  shotNoDevice: '请先选择一台在线设备',
  shotSaved: '截图已保存',
  shotCancelled: '已取消保存',
  startRecord: '开始录屏',
  stopRecord: '停止录屏',
  saveRecord: '保存视频',
  recordIdle: '未录制',
  recordBusy: '处理中…',
  recordNoDevice: '请先选择一台在线设备',
  recordLimitLabel: '录制时长上限',
  recordActive: '录制中',
  recordSaved: '视频已保存',
  recordCancelled: '已取消保存',
  recordLimitReached: '已达到时长上限，录制自动结束',
  appsNoDevice: '请先选择一台在线设备',
  appsRefresh: '刷新应用列表',
  appsFilter: '过滤包名',
  appsInstall: '安装 APK',
  appsInstallHint: '输入本机 APK 完整路径，或选择/拖入 APK 文件',
  appsStart: '启动',
  appsStop: '停止',
  appsClear: '清除数据',
  appsUninstall: '卸载',
  appsResult: '结果',
  appsBusy: '处理中…',
  appsBrowse: '浏览 APK',
  appsDropHint: '也可把 APK 文件拖到这里',
  appsFileTooLarge: 'APK 文件过大（最多 512 MB）',
  appsUploading: '上传中…',
  appsPermInput: '权限名 (如 android.permission.CAMERA)',
  appsRevoke: '撤销权限',
  appsGrant: '授予权限',
  appsPermRequired: '请输入权限名',
  appsRevokeAll: '撤销全部权限',
  appsRevokeAllResult: '已撤销 {revoked} 项，失败 {failed} 项',
  appsRevokeAllNone: '没有可撤销的运行时权限（只针对已授予的危险权限）',
  appsRevokeAllRevokedList: '已撤销权限',
  appsRevokeAllFailedList: '撤销失败（系统权限或不可撤销）',
  wirelessInput: '设备地址 (IP:端口)',
  wirelessConnect: '连接',
  wirelessDisconnect: '断开',
  wirelessHistory: '连接历史',
  wirelessNoHistory: '暂无历史',
  wirelessCurrent: '当前无线连接设备',
  wirelessNoCurrent: '暂无无线连接设备',
  wirelessInvalid: '格式应为 IP:端口（如 192.168.1.100:5555）',
  wirelessResult: '结果',
  wirelessBusy: '处理中…',
  wirelessRowHint: '点击填入地址；点右侧按钮可直接断开该设备',
  cmdNoDevice: '请先选择一台在线设备',
  cmdDeviceInfo: 'Android 版本',
  cmdModel: '设备型号',
  cmdBattery: '电池信息',
  cmdPackages: '第三方应用',
  cmdIpAddress: 'IP 地址',
  cmdMemInfo: '内存信息',
  cmdResult: '输出',
  cmdBusy: '执行中',
}

const en: Strings = {
  appTitle: 'ADB Helper',
  settingsButton: 'Settings',
  settingsTitle: 'Plugin Settings',
  settingsAdbPath: 'ADB executable path',
  settingsAdbPathHint: 'May contain spaces; leave empty to use adb from PATH.',
  settingsLocale: 'UI language',
  settingsLogcatTag: 'Default logcat filter tag',
  settingsLogcatTagHint: 'A -s tag filter appended when starting logcat; may be empty.',
  settingsAskAgent: 'Agent for "Ask AI"',
  settingsAskAgentHint: 'Must be an agent installed and enabled on this machine.',
  settingsSave: 'Save',
  settingsSaved: 'Settings saved',
  refresh: 'Refresh devices',
  startLogcat: 'Start logcat',
  stopLogcat: 'Stop logcat',
  openInTerminal: 'Open in terminal',
  openInTerminalFocused: 'logcat is running in an Orca terminal',
  openInTerminalHint: 'logcat started in an Orca terminal; open it in Orca to read the output',
  openInTerminalTooltip: 'Run logcat in an Orca terminal (the panel log view is unaffected)',
  askAi: 'Ask AI',
  languageLabel: 'Language',
  deviceListTitle: 'Devices',
  deviceDetailTitle: 'Device detail',
  logcatTitle: 'Live logs',
  filterPlaceholder: 'Filter logs (does not change raw content)',
  clearFilter: 'Clear filter',
  stateDevice: 'online',
  stateOffline: 'offline',
  stateUnauthorized: 'unauthorized',
  stateUnknown: 'unknown',
  fieldModel: 'Model',
  fieldAndroid: 'Android version',
  fieldSerial: 'Serial',
  noDevices: 'No devices found. Make sure ADB is installed, its server is running, and a device is connected.',
  loading: 'Loading…',
  logcatIdle: 'Stopped',
  logcatStarting: 'Starting…',
  logcatActive: 'Active',
  logcatError: 'Error',
  selectDeviceHint: 'Select an online device first',
  noWorkspaceError: 'No workspace available to launch an AI agent.',
  aiPromptHint: 'Send the selected raw text to an AI agent in Orca for explanation.',
  copied: 'Copied to clipboard',
  rawOutputTitle: 'Raw output',
  sourcePrimary: 'Local ADB',
  sourceFallback: 'Terminal fallback',
  detailError: 'Could not load device detail',
  jumpToLatest: 'Jump to latest',
  versionLabel: 'Version',
  buildLabel: 'Build',
  clearLogs: 'Clear logs',
  manualCopyTitle: 'Auto-copy blocked, please copy manually',
  manualCopyHint: 'The text below is selected. Press Ctrl/Cmd + C to copy.',
  closeLabel: 'Close',
  copySelected: 'Copy',
  askAiBusy: 'Starting…',
  askDialogTitle: 'Ask AI',
  agentLabel: 'Agent',
  sessionLabel: 'Session',
  newSession: 'New session',
  textLabel: 'Selected text (editable)',
  promptLabel: 'Prompt (editable)',
  promptTemplate: 'Explain this information: {selected-text}',
  sendLabel: 'Send',
  cancelLabel: 'Cancel',
  loadingOptions: 'Loading…',
  tabLog: 'Live logs',
  tabScreenshot: 'Screenshot',
  tabScreenrecord: 'Screen record',
  tabApps: 'Apps',
  tabWireless: 'Wireless',
  tabCommands: 'Commands',
  takeScreenshot: 'Take screenshot',
  saveScreenshot: 'Save to file',
  shotPreview: 'Screenshot preview',
  shotIdle: 'No screenshot yet',
  shotBusy: 'Capturing…',
  shotNoDevice: 'Select an online device first',
  shotSaved: 'Screenshot saved',
  shotCancelled: 'Save cancelled',
  startRecord: 'Start recording',
  stopRecord: 'Stop recording',
  saveRecord: 'Save video',
  recordIdle: 'Not recording',
  recordBusy: 'Working…',
  recordNoDevice: 'Select an online device first',
  recordLimitLabel: 'Time limit',
  recordActive: 'Recording',
  recordSaved: 'Video saved',
  recordCancelled: 'Save cancelled',
  recordLimitReached: 'Time limit reached, recording stopped',
  appsNoDevice: 'Select an online device first',
  appsRefresh: 'Refresh apps',
  appsFilter: 'Filter packages',
  appsInstall: 'Install APK',
  appsInstallHint: 'Enter full local APK path, or choose/drop an APK file',
  appsStart: 'Start',
  appsStop: 'Stop',
  appsClear: 'Clear data',
  appsUninstall: 'Uninstall',
  appsResult: 'Result',
  appsBusy: 'Working…',
  appsBrowse: 'Browse APK',
  appsDropHint: 'You can also drop an APK file here',
  appsFileTooLarge: 'APK file is too large (max 512 MB)',
  appsUploading: 'Uploading…',
  appsPermInput: 'Permission (e.g. android.permission.CAMERA)',
  appsRevoke: 'Revoke Permission',
  appsGrant: 'Grant Permission',
  appsPermRequired: 'Please enter a permission name',
  appsRevokeAll: 'Revoke All Permissions',
  appsRevokeAllResult: 'Revoked {revoked}, failed {failed}',
  appsRevokeAllNone: 'No revocable runtime permissions (only granted dangerous permissions)',
  appsRevokeAllRevokedList: 'Revoked permissions',
  appsRevokeAllFailedList: 'Failed to revoke (system or non-revocable)',
  wirelessInput: 'Device address (IP:port)',
  wirelessConnect: 'Connect',
  wirelessDisconnect: 'Disconnect',
  wirelessHistory: 'Connection history',
  wirelessNoHistory: 'No history',
  wirelessCurrent: 'Current wireless devices',
  wirelessNoCurrent: 'No wireless devices connected',
  wirelessInvalid: 'Format should be IP:port (e.g. 192.168.1.100:5555)',
  wirelessResult: 'Result',
  wirelessBusy: 'Working…',
  wirelessRowHint: 'Click to fill the address; the right-hand button disconnects this device',
  cmdNoDevice: 'Select an online device first',
  cmdDeviceInfo: 'Android version',
  cmdModel: 'Device model',
  cmdBattery: 'Battery info',
  cmdPackages: 'Third-party apps',
  cmdIpAddress: 'IP address',
  cmdMemInfo: 'Memory info',
  cmdResult: 'Output',
  cmdBusy: 'Running',
}

const bundles: Record<Locale, Strings> = { 'zh-CN': zhCN, en }

/** 缺失键回退到英文，再回退到键名。 */
export function getStrings(locale: string): Strings {
  const canonical: Locale = locale === 'zh-CN' ? 'zh-CN' : 'en'
  return bundles[canonical] ?? en
}

export function formatLocale(locale: string): string {
  return locale === 'zh-CN' ? 'zh-CN' : 'en-US'
}
