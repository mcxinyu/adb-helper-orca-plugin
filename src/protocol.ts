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
  | 'conflict'

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
    'adb.openLogcatTerminal': {
      input: { serial: string }
      output: CommandResult<{ terminalId: string; focused: boolean }>
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
    'adb.screenshot': {
      input: { serial: string }
      output: CommandResult<{ base64: string; mimeType: string }>
    }
    'adb.startScreenrecord': {
      input: { serial: string; maxSeconds?: number }
      output: CommandResult<{ started: true; devicePath: string }>
    }
    'adb.stopScreenrecord': {
      output: CommandResult<{ base64: string; mimeType: string; devicePath: string }>
    }
    'adb.screenrecordStatus': {
      output: { recording: boolean; serial?: string; devicePath?: string }
    }
    'adb.listPackages': {
      input: { serial: string }
      output: CommandResult<{ packages: string[] }>
    }
    'adb.appAction': {
      input: { serial: string; action: 'start' | 'stop' | 'clear' | 'uninstall'; pkg: string }
      output: CommandResult<{ output: string }>
    }
    // 权限操作单列一个请求：permission 必填，避免可选字段影响 start/stop 等的输入校验。
    'adb.permissionAction': {
      input: { serial: string; action: 'revoke' | 'grant'; pkg: string; permission: string }
      output: CommandResult<{ output: string }>
    }
    'adb.revokeAllPermissions': {
      input: { serial: string; pkg: string }
      output: CommandResult<{ revoked: string[]; failed: string[] }>
    }
    'adb.installApk': {
      input: { serial: string; apkPath: string }
      output: CommandResult<{ output: string }>
    }
    'adb.installApkUploadStart': {
      input: { fileName: string }
      output: { uploadId: string }
    }
    'adb.installApkUploadChunk': {
      input: { uploadId: string; base64: string }
      output: { received: number }
    }
    'adb.installApkUploadFinish': {
      input: { uploadId: string; serial: string }
      output: CommandResult<{ output: string }>
    }
    'adb.installApkUploadCancel': {
      input: { uploadId: string }
      output: { cancelled: true }
    }
    'adb.connect': {
      input: { target: string }
      output: CommandResult<{ output: string }>
    }
    'adb.disconnect': {
      input: { target: string }
      output: CommandResult<{ output: string }>
    }
    'adb.connectHistory': {
      output: { history: string[] }
    }
    'adb.runPaletteCommand': {
      input: { serial: string; commandId: string }
      output: CommandResult<{ output: string }>
    }
    'adb.listPaletteCommands': {
      output: { commands: string[] }
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
