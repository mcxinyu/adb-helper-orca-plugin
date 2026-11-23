export type Locale = 'zh-CN' | 'en'

export interface Strings {
  appTitle: string
  refresh: string
  startLogcat: string
  stopLogcat: string
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
}

const zhCN: Strings = {
  appTitle: 'ADB 助手',
  refresh: '刷新设备',
  startLogcat: '开始 logcat',
  stopLogcat: '停止 logcat',
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
}

const en: Strings = {
  appTitle: 'ADB Helper',
  refresh: 'Refresh devices',
  startLogcat: 'Start logcat',
  stopLogcat: 'Stop logcat',
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
