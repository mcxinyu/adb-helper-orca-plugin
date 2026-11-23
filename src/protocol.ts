// ADB Helper 的面板 <-> worker 类型契约。
// panel 与 worker 都依赖这份声明合并，无需在 manifest 中声明 requests/events。

export {}

export type DeviceState = 'device' | 'offline' | 'unauthorized' | 'unknown'

export interface DeviceInfo {
  serial: string
  state: DeviceState
  model?: string
}

export interface DeviceDetail {
  serial: string
  model: string
  androidVersion: string
}

export type RequestErrorCode =
  | 'invalid_params'
  | 'action_failed'
  | 'adb_unavailable'
  | 'no_workspace'
  | 'cancelled'

export interface CommandFailure {
  ok: false
  code: RequestErrorCode
  message: string
}

export interface CommandSuccess<T> {
  ok: true
  value: T
}

export type CommandResult<T> = CommandSuccess<T> | CommandFailure

declare module 'orca' {
  interface PluginRequests {
    'adb.listDevices': {
      output: CommandResult<{ devices: DeviceInfo[]; source: 'primary' | 'fallback' }>
    }
    'adb.getDetail': {
      input: { serial: string }
      output: CommandResult<DeviceDetail>
    }
    'adb.startLogcat': {
      input: { serial: string }
      output: CommandResult<{ started: true }>
    }
    'adb.stopLogcat': {
      output: CommandResult<{ stopped: true }>
    }
    'adb.pollLogcat': {
      input: { since?: number }
      output: CommandResult<{
        lines: { seq: number; line: string }[]
        nextSeq: number
        state: 'stopped' | 'active' | 'error'
        serial?: string
      }>
    }
    'adb.listAgents': {
      output: CommandResult<{ agents: { id: string; name: string; isDefault: boolean }[] }>
    }
    'adb.listSessions': {
      output: CommandResult<{
        sessions: { sessionId: string; agent: string; title: string; updatedAt: number; running: boolean }[]
      }>
    }
    'adb.askAi': {
      input: { agent: string; prompt: string; sessionId?: string }
      output: CommandResult<{ terminalId: string; focused: boolean; message: string }>
    }
    'adb.getConfig': {
      output: { locale: string; adbPath: string; logcatTag: string }
    }
    'adb.setLocale': {
      input: { locale: string }
      output: { locale: string }
    }
  }

  interface PluginPanelEvents {
    'adb.devicesChanged': {
      devices: DeviceInfo[]
      source: 'primary' | 'fallback'
      error?: string
    }
    'adb.logLine': { serial: string; line: string }
    'adb.logBatch': { serial: string; lines: string[] }
    'adb.logcatState': {
      state: 'stopped' | 'starting' | 'active' | 'error'
      serial?: string
      error?: string
    }
  }
}
