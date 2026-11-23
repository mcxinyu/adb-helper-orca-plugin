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
