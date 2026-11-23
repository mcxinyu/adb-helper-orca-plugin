// panel 侧 window.orca 的最小类型声明（HTML panel 的 frame facade）。
// 完整定义在 .orca/types/orca-frame，这里只声明本插件使用的子集。

import type {
  CommandResult,
  DeviceDetail,
  DeviceInfo,
  RequestErrorCode,
} from '../../src/protocol'

export interface AskAiResult {
  terminalId: string
  focused: boolean
  message: string
}

export interface AgentOption {
  id: string
  name: string
  isDefault: boolean
}

export interface SessionOption {
  sessionId: string
  agent: string
  title: string
  updatedAt: number
  running: boolean
}

interface PluginBridge {
  request<K extends string>(name: K, input?: unknown): Promise<unknown>
  on(event: string, handler: (payload: unknown) => void): { dispose(): void }
}

interface FrameApi {
  plugin: PluginBridge
  host: {
    call(method: string, params?: unknown): Promise<unknown>
  }
}

declare global {
  interface Window {
    orca: FrameApi
  }
}

function bridge(): PluginBridge {
  if (!window.orca?.plugin) {
    throw new Error('Orca panel bridge 不可用：请在 Orca 面板中打开此插件。')
  }
  return window.orca.plugin
}

export async function getConfig(): Promise<{ locale: string; adbPath: string; logcatTag: string }> {
  return (await bridge().request('adb.getConfig')) as {
    locale: string
    adbPath: string
    logcatTag: string
  }
}

export async function setLocale(locale: string): Promise<void> {
  await bridge().request('adb.setLocale', { locale })
}

export async function listDevices(): Promise<
  CommandResult<{ devices: DeviceInfo[]; source: 'primary' | 'fallback' }>
> {
  return (await bridge().request('adb.listDevices')) as CommandResult<{
    devices: DeviceInfo[]
    source: 'primary' | 'fallback'
  }>
}

export async function getDetail(serial: string): Promise<CommandResult<DeviceDetail>> {
  return (await bridge().request('adb.getDetail', { serial })) as CommandResult<DeviceDetail>
}

export async function startLogcat(serial: string): Promise<CommandResult<{ started: true }>> {
  return (await bridge().request('adb.startLogcat', { serial })) as CommandResult<{ started: true }>
}

export async function stopLogcat(): Promise<CommandResult<{ stopped: true }>> {
  return (await bridge().request('adb.stopLogcat')) as CommandResult<{ stopped: true }>
}

export interface LogcatPollEntry {
  seq: number
  line: string
}

export interface LogcatPollResult {
  lines: LogcatPollEntry[]
  nextSeq: number
  state: 'stopped' | 'active' | 'error'
  serial?: string
}

export async function pollLogcat(since: number): Promise<CommandResult<LogcatPollResult>> {
  return (await bridge().request('adb.pollLogcat', { since })) as CommandResult<LogcatPollResult>
}

export async function listAgents(): Promise<CommandResult<{ agents: AgentOption[] }>> {
  return (await bridge().request('adb.listAgents')) as CommandResult<{ agents: AgentOption[] }>
}

export async function listSessions(): Promise<CommandResult<{ sessions: SessionOption[] }>> {
  return (await bridge().request('adb.listSessions')) as CommandResult<{ sessions: SessionOption[] }>
}

export async function askAi(agent: string, prompt: string, sessionId?: string): Promise<CommandResult<AskAiResult>> {
  return (await bridge().request('adb.askAi', { agent, prompt, sessionId })) as CommandResult<AskAiResult>
}

export async function screenshot(serial: string): Promise<CommandResult<{ base64: string; mimeType: string }>> {
  return (await bridge().request('adb.screenshot', { serial })) as CommandResult<{ base64: string; mimeType: string }>
}

export async function startScreenrecord(serial: string, maxSeconds?: number): Promise<CommandResult<{ started: true; devicePath: string }>> {
  return (await bridge().request('adb.startScreenrecord', { serial, maxSeconds })) as CommandResult<{ started: true; devicePath: string }>
}

export async function stopScreenrecord(): Promise<CommandResult<{ base64: string; mimeType: string; devicePath: string }>> {
  return (await bridge().request('adb.stopScreenrecord')) as CommandResult<{ base64: string; mimeType: string; devicePath: string }>
}

export async function screenrecordStatus(): Promise<{ recording: boolean; serial?: string; devicePath?: string }> {
  return (await bridge().request('adb.screenrecordStatus')) as { recording: boolean; serial?: string; devicePath?: string }
}

export async function listPackages(serial: string): Promise<CommandResult<{ packages: string[] }>> {
  return (await bridge().request('adb.listPackages', { serial })) as CommandResult<{ packages: string[] }>
}

export async function appAction(serial: string, action: 'start' | 'stop' | 'clear' | 'uninstall', pkg: string): Promise<CommandResult<{ output: string }>> {
  return (await bridge().request('adb.appAction', { serial, action, pkg })) as CommandResult<{ output: string }>
}

export async function installApk(serial: string, apkPath: string): Promise<CommandResult<{ output: string }>> {
  return (await bridge().request('adb.installApk', { serial, apkPath })) as CommandResult<{ output: string }>
}

export async function connectDevice(target: string): Promise<CommandResult<{ output: string }>> {
  return (await bridge().request('adb.connect', { target })) as CommandResult<{ output: string }>
}

export async function disconnectDevice(target: string): Promise<CommandResult<{ output: string }>> {
  return (await bridge().request('adb.disconnect', { target })) as CommandResult<{ output: string }>
}

export async function connectHistory(): Promise<{ history: string[] }> {
  return (await bridge().request('adb.connectHistory')) as { history: string[] }
}

export async function listPaletteCommands(): Promise<{ commands: string[] }> {
  return (await bridge().request('adb.listPaletteCommands')) as { commands: string[] }
}

export async function runPaletteCommand(serial: string, commandId: string): Promise<CommandResult<{ output: string }>> {
  return (await bridge().request('adb.runPaletteCommand', { serial, commandId })) as CommandResult<{ output: string }>
}

/** base64 转 ArrayBuffer，供 files.saveAs 使用。 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/** 通过 Orca 文件保存对话框保存二进制数据；需用户点击触发。 */
export async function saveFile(data: ArrayBuffer, suggestedName: string, mimeType: string): Promise<boolean> {
  const result = await window.orca.host.call('files.saveAs', { data, suggestedName, mimeType }) as { status: string }
  return result.status === 'saved'
}

export interface DeviceChangedPayload {
  devices: DeviceInfo[]
  source: 'primary' | 'fallback'
  error?: string
}

export interface LogcatStatePayload {
  state: 'stopped' | 'starting' | 'active' | 'error'
  serial?: string
  error?: string
}

export function onDevicesChanged(handler: (payload: DeviceChangedPayload) => void): { dispose(): void } {
  return bridge().on('adb.devicesChanged', (payload) => handler(payload as DeviceChangedPayload))
}

export function onLogcatState(handler: (payload: LogcatStatePayload) => void): { dispose(): void } {
  return bridge().on('adb.logcatState', (payload) => handler(payload as LogcatStatePayload))
}

export type { CommandResult, DeviceInfo, DeviceDetail, RequestErrorCode }
