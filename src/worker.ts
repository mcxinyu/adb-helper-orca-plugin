// ADB Helper 的受信任 worker：面板请求处理、设备/详情查询、问 AI，以及基于 Orca 终端的 logcat 流。

import type { OrcaWorkerApi } from 'orca/worker'
import { spawn } from 'node:child_process'
import { open, readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import './protocol'
import type { CommandResult, DeviceDetail, RequestErrorCode } from './protocol'
import {
  buildClearAppDataArgs,
  buildConnectArgs,
  buildDisconnectArgs,
  buildDumpPackageArgs,
  buildGrantPermissionArgs,
  buildInstallApkArgs,
  buildListPackagesArgs,
  buildPullArgs,
  buildRevokePermissionArgs,
  buildScreenrecordArgs,
  buildScreenshotArgs,
  buildStartAppArgs,
  buildStopAppArgs,
  buildUninstallArgs,
  getDeviceDetailViaAdb,
  getPaletteCommand,
  isValidConnectTarget,
  isValidPackageName,
  PALETTE_COMMANDS,
  parseGrantedRuntimePermissions,
  runAdb,
  runAdbBuffer,
} from './adb'
import { discoverDevices, toCommandResult } from './discovery'

const SETTINGS = {
  adbPath: 'adbPath',
  locale: 'locale',
  logcatTag: 'logcatTag',
  askAgent: 'askAgent',
} as const

const DEFAULT_AGENT = 'opencode'

const STORAGE_KEYS = {
  lastSerial: 'lastSerial',
  logcatTerminalId: 'logcatTerminalId',
  logcatSerial: 'logcatSerial',
  logcatSeqBase: 'logcatSeqBase',
  logcatLastLines: 'logcatLastLines',
  screenrecordState: 'screenrecordState',
  connectHistory: 'connectHistory',
} as const

const MAX_CONNECT_HISTORY = 10

interface ScreenrecordState {
  serial: string
  devicePath: string
  process: ReturnType<typeof spawn>
  startedAt: number
}

let screenrecord: ScreenrecordState | undefined

const activeUploads = new Map<string, { tempPath: string; received: number }>()

function createUploadId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function failure<T>(code: RequestErrorCode, message: string): CommandResult<T> {
  return { ok: false, code, message }
}

function success<T>(value: T): CommandResult<T> {
  return { ok: true, value }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function getSetting(orca: OrcaWorkerApi, key: string, fallback: string): Promise<string> {
  const value = await orca.settings.get(key)
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

async function getStorageString(
  orca: OrcaWorkerApi,
  key: string,
): Promise<string | undefined> {
  const value = await orca.storage.get(key)
  return typeof value === 'string' ? value : undefined
}

function quoteForShell(path: string): string {
  if (!/[\s"]/.test(path)) return path
  return `"${path.replace(/"/g, '\\"')}"`
}

/** 选一个可承载终端的 workspace id。 */
async function pickWorkspaceId(orca: OrcaWorkerApi): Promise<string | undefined> {
  const context = await orca.host.call('workspace.readContext', undefined)
  if (context?.workspaceId) return context.workspaceId
  const { workspaces } = await orca.host.call('workspace.list', undefined)
  return workspaces.find((w) => w.hostId === null)?.id ?? workspaces[0]?.id
}

/** 关闭当前 logcat 终端（若存在）。 */
async function closeLogcatTerminal(orca: OrcaWorkerApi): Promise<void> {
  const terminalId = await getStorageString(orca, STORAGE_KEYS.logcatTerminalId)
  if (terminalId && orca.host.has('terminal.close')) {
    try {
      await orca.host.call('terminal.close', { terminalId })
    } catch {
      // 终端可能已关闭。
    }
  }
  await orca.storage.delete(STORAGE_KEYS.logcatTerminalId)
  await orca.storage.delete(STORAGE_KEYS.logcatSerial)
  await orca.storage.delete(STORAGE_KEYS.logcatSeqBase)
  await orca.storage.delete(STORAGE_KEYS.logcatLastLines)
}

export default function activate(orca: OrcaWorkerApi): void {
  // 恢复/清理上次 worker 遗留的录屏状态（worker 回收会带走子进程，仅剩设备临时文件）。
  void (async () => {
    const leftover = await orca.storage.get(STORAGE_KEYS.screenrecordState).catch(() => null)
    if (leftover && typeof leftover === 'object' && leftover !== null) {
      const rec = leftover as { serial?: string; devicePath?: string }
      if (rec.serial && rec.devicePath) {
        const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
        await runAdb(adbPath, ['-s', rec.serial, 'shell', 'rm', rec.devicePath]).catch(() => undefined)
      }
      await orca.storage.delete(STORAGE_KEYS.screenrecordState).catch(() => undefined)
      orca.log('已清理上次遗留的录屏状态')
    }
  })()

  // 配置读取与语言写入。
  orca.panels.handle('adb.getConfig', async () => ({
    locale: await getSetting(orca, SETTINGS.locale, 'zh-CN'),
    adbPath: await getSetting(orca, SETTINGS.adbPath, 'adb'),
    logcatTag: await getSetting(orca, SETTINGS.logcatTag, ''),
  }))

  orca.panels.handle('adb.setLocale', async ({ locale }) => {
    await orca.settings.set(SETTINGS.locale, locale)
    return { locale }
  })

  // 设备发现：主路径 + 终端回退，并把结果推送给所有面板。
  orca.panels.handle('adb.listDevices', async () => {
    const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
    const discovery = await discoverDevices(orca, adbPath)
    orca.panels.post('adb.devicesChanged', {
      devices: discovery.devices,
      source: discovery.source,
      ...(discovery.error ? { error: discovery.error } : {}),
    })
    return toCommandResult(discovery)
  })

  // 设备详情。
  orca.panels.handle('adb.getDetail', async ({ serial }) => {
    if (!serial) return failure<DeviceDetail>('invalid_params', 'serial 不能为空')
    const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
    try {
      return success(await getDeviceDetailViaAdb(adbPath, serial))
    } catch (error) {
      return failure<DeviceDetail>('action_failed', errorMessage(error))
    }
  })

  // 截图：adb exec-out screencap -p，返回 base64（JSON 可传），面板侧转 ArrayBuffer 保存。
  orca.panels.handle('adb.screenshot', async ({ serial }) => {
    type ShotResult = { base64: string; mimeType: string }
    if (!serial) return failure<ShotResult>('invalid_params', '请选择设备')
    const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
    try {
      const buffer = await runAdbBuffer(adbPath, buildScreenshotArgs(serial))
      return success<ShotResult>({ base64: buffer.toString('base64'), mimeType: 'image/png' })
    } catch (error) {
      return failure<ShotResult>('action_failed', `截图失败：${errorMessage(error)}`)
    }
  })

  // 列出已安装包。
  orca.panels.handle('adb.listPackages', async ({ serial }) => {
    type Result = { packages: string[] }
    if (!serial) return failure<Result>('invalid_params', '请选择设备')
    const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
    try {
      const raw = await runAdb(adbPath, buildListPackagesArgs(serial))
      const packages = raw.split(/\r?\n/)
        .map((line) => line.trim().replace(/^package:/, ''))
        .filter((line) => line.length > 0)
        .sort()
      return success<Result>({ packages })
    } catch (error) {
      return failure<Result>('action_failed', `列包失败：${errorMessage(error)}`)
    }
  })

  // 应用操作：启动/停止/清除/卸载。
  orca.panels.handle('adb.appAction', async ({ serial, action, pkg }) => {
    type Result = { output: string }
    if (!serial) return failure<Result>('invalid_params', '请选择设备')
    if (!isValidPackageName(pkg)) return failure<Result>('invalid_params', '包名不合法')
    const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
    try {
      const builders = {
        start: buildStartAppArgs, stop: buildStopAppArgs, clear: buildClearAppDataArgs, uninstall: buildUninstallArgs,
      }
      const output = await runAdb(adbPath, builders[action](serial, pkg))
      return success<Result>({ output: output.trim() })
    } catch (error) {
      return failure<Result>('action_failed', errorMessage(error))
    }
  })

  // 权限操作（撤销/授予单个权限）：与 appAction 分离，permission 为必填。
  orca.panels.handle('adb.permissionAction', async ({ serial, action, pkg, permission }) => {
    type Result = { output: string }
    if (!serial) return failure<Result>('invalid_params', '请选择设备')
    if (!isValidPackageName(pkg)) return failure<Result>('invalid_params', '包名不合法')
    if (!permission || !isValidPackageName(permission)) {
      return failure<Result>('invalid_params', '权限名不合法（如 android.permission.CAMERA）')
    }
    const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
    try {
      const args = action === 'revoke'
        ? buildRevokePermissionArgs(serial, pkg, permission)
        : buildGrantPermissionArgs(serial, pkg, permission)
      const output = await runAdb(adbPath, args)
      return success<Result>({ output: output.trim() })
    } catch (error) {
      return failure<Result>('action_failed', errorMessage(error))
    }
  })

  // 撤销全部运行时权限：先 dumpsys 拿到已授予的 dangerous 权限，再逐个 pm revoke。
  orca.panels.handle('adb.revokeAllPermissions', async ({ serial, pkg }) => {
    type Result = { revoked: string[]; failed: string[] }
    if (!serial) return failure<Result>('invalid_params', '请选择设备')
    if (!isValidPackageName(pkg)) return failure<Result>('invalid_params', '包名不合法')
    const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
    try {
      // dumpsys 输出较大，用 runAdbBuffer 承载
      const dump = await runAdbBuffer(adbPath, buildDumpPackageArgs(serial, pkg))
      const perms = parseGrantedRuntimePermissions(dump.toString())
      if (perms.length === 0) {
        return success<Result>({ revoked: [], failed: [] })
      }
      const revoked: string[] = []
      const failed: string[] = []
      for (const perm of perms) {
        try {
          await runAdb(adbPath, buildRevokePermissionArgs(serial, pkg, perm))
          revoked.push(perm)
        } catch {
          failed.push(perm)
        }
      }
      return success<Result>({ revoked, failed })
    } catch (error) {
      return failure<Result>('action_failed', errorMessage(error))
    }
  })

  // 安装 APK：用户输入路径，或 panel 选择文件后传 base64，作为单个参数传给 adb。
  orca.panels.handle('adb.installApk', async ({ serial, apkPath }) => {
    type Result = { output: string }
    if (!serial) return failure<Result>('invalid_params', '请选择设备')
    if (!apkPath || !apkPath.trim()) return failure<Result>('invalid_params', '请输入 APK 路径')
    const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
    try {
      const output = await runAdb(adbPath, buildInstallApkArgs(serial, apkPath.trim()))
      return success<Result>({ output: output.trim() })
    } catch (error) {
      return failure<Result>('action_failed', `安装失败：${errorMessage(error)}`)
    }
  })

  orca.panels.handle('adb.installApkUploadStart', async ({ fileName }) => {
    const safeName = typeof fileName === 'string' && fileName.trim() ? fileName.trim() : 'app.apk'
    const uploadId = createUploadId()
    activeUploads.set(uploadId, {
      tempPath: join(tmpdir(), `adb-helper-${uploadId}-${safeName}`),
      received: 0,
    })
    return { uploadId }
  })

  orca.panels.handle('adb.installApkUploadChunk', async ({ uploadId, base64 }) => {
    const upload = activeUploads.get(uploadId)
    if (!upload) throw new Error('upload expired')
    if (!base64 || typeof base64 !== 'string') throw new Error('empty chunk')
    const bytes = Buffer.from(base64, 'base64')
    const handle = await open(upload.tempPath, 'a')
    try {
      await handle.write(bytes)
    } finally {
      await handle.close()
    }
    upload.received += bytes.length
    return { received: upload.received }
  })

  orca.panels.handle('adb.installApkUploadFinish', async ({ uploadId, serial }) => {
    type Result = { output: string }
    const upload = activeUploads.get(uploadId)
    if (!upload) return failure<Result>('invalid_params', '上传会话已过期')
    if (!serial) return failure<Result>('invalid_params', '请选择设备')
    try {
      const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
      const output = await runAdb(adbPath, buildInstallApkArgs(serial, upload.tempPath))
      return success<Result>({ output: output.trim() })
    } catch (error) {
      return failure<Result>('action_failed', `安装失败：${errorMessage(error)}`)
    } finally {
      activeUploads.delete(uploadId)
      await unlink(upload.tempPath).catch(() => undefined)
    }
  })

  orca.panels.handle('adb.installApkUploadCancel', async ({ uploadId }) => {
    const upload = activeUploads.get(uploadId)
    if (upload) {
      activeUploads.delete(uploadId)
      await unlink(upload.tempPath).catch(() => undefined)
    }
    return { cancelled: true as const }
  })

  // 无线连接历史读取。
  orca.panels.handle('adb.connectHistory', async () => {
    const value = await orca.storage.get(STORAGE_KEYS.connectHistory)
    const history = Array.isArray(value) ? (value as string[]).filter((x) => typeof x === 'string') : []
    return { history }
  })

  async function addToConnectHistory(orca: OrcaWorkerApi, target: string): Promise<void> {
    const value = await orca.storage.get(STORAGE_KEYS.connectHistory)
    const history = Array.isArray(value) ? (value as string[]).filter((x) => typeof x === 'string') : []
    const next = [target, ...history.filter((x) => x !== target)].slice(0, MAX_CONNECT_HISTORY)
    await orca.storage.set(STORAGE_KEYS.connectHistory, next).catch(() => undefined)
  }

  orca.panels.handle('adb.connect', async ({ target }) => {
    type Result = { output: string }
    if (!isValidConnectTarget(target)) return failure<Result>('invalid_params', '目标格式应为 IP:端口')
    const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
    try {
      const output = await runAdb(adbPath, buildConnectArgs(target))
      await addToConnectHistory(orca, target)
      return success<Result>({ output: output.trim() })
    } catch (error) {
      return failure<Result>('action_failed', `连接失败：${errorMessage(error)}`)
    }
  })

  orca.panels.handle('adb.disconnect', async ({ target }) => {
    type Result = { output: string }
    if (!isValidConnectTarget(target)) return failure<Result>('invalid_params', '目标格式应为 IP:端口')
    const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
    try {
      const output = await runAdb(adbPath, buildDisconnectArgs(target))
      return success<Result>({ output: output.trim() })
    } catch (error) {
      return failure<Result>('action_failed', `断开失败：${errorMessage(error)}`)
    }
  })

  orca.panels.handle('adb.listPaletteCommands', async () => ({
    commands: PALETTE_COMMANDS.map((c) => c.id),
  }))

  orca.panels.handle('adb.runPaletteCommand', async ({ serial, commandId }) => {
    type Result = { output: string }
    if (!serial) return failure<Result>('invalid_params', '请选择设备')
    const cmd = getPaletteCommand(commandId)
    if (!cmd) return failure<Result>('invalid_params', '命令不在白名单中')
    const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
    try {
      const output = await runAdb(adbPath, cmd.args(serial))
      return success<Result>({ output: output.trim() })
    } catch (error) {
      return failure<Result>('action_failed', errorMessage(error))
    }
  })

  // 录屏：开始（spawn screenrecord 写设备临时文件）。
  orca.panels.handle('adb.startScreenrecord', async ({ serial, maxSeconds }) => {
    type StartResult = { started: true; devicePath: string }
    if (!serial) return failure<StartResult>('invalid_params', '请选择设备')
    if (screenrecord) return failure<StartResult>('conflict', '已有录屏正在进行')
    const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
    const limit = Math.min(Math.max(maxSeconds ?? 30, 1), 180)
    const devicePath = `/sdcard/adb-helper-${Date.now()}.mp4`
    try {
      const child = spawn(adbPath, buildScreenrecordArgs(serial, devicePath, limit), { windowsHide: true })
      screenrecord = { serial, devicePath, process: child, startedAt: Date.now() }
      await orca.storage.set(STORAGE_KEYS.screenrecordState, {
        serial, devicePath, startedAt: screenrecord.startedAt,
      }).catch(() => undefined)
      child.on('close', () => {
        // 到达时限自然结束时保留 state，让 stop/status 仍能拉取文件。
      })
      child.on('error', () => {
        // 错误在 stop/status 时通过文件是否存在体现。
      })
      return success<StartResult>({ started: true as const, devicePath })
    } catch (error) {
      return failure<StartResult>('action_failed', `无法开始录屏：${errorMessage(error)}`)
    }
  })

  // 录屏：停止、拉取文件并返回 base64。
  orca.panels.handle('adb.stopScreenrecord', async () => {
    type StopResult = { base64: string; mimeType: string; devicePath: string }
    if (!screenrecord) return failure<StopResult>('conflict', '当前没有录屏')
    const current = screenrecord
    screenrecord = undefined
    await orca.storage.delete(STORAGE_KEYS.screenrecordState).catch(() => undefined)
    try {
      if (!current.process.killed) current.process.kill()
    } catch {
      // 进程可能已退出。
    }
    // 等待进程完全退出后文件才完整。
    await new Promise((resolve) => setTimeout(resolve, 600))
    const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
    const localPath = join(tmpdir(), `adb-helper-${Date.now()}.mp4`)
    try {
      await runAdb(adbPath, buildPullArgs(current.serial, current.devicePath, localPath), 30_000)
      const buffer = await readFile(localPath)
      await unlink(localPath).catch(() => undefined)
      // 清理设备上的临时文件。
      await runAdb(adbPath, ['-s', current.serial, 'shell', 'rm', current.devicePath]).catch(() => undefined)
      return success<StopResult>({ base64: buffer.toString('base64'), mimeType: 'video/mp4', devicePath: current.devicePath })
    } catch (error) {
      await unlink(localPath).catch(() => undefined)
      return failure<StopResult>('action_failed', `录屏保存失败：${errorMessage(error)}`)
    }
  })

  orca.panels.handle('adb.screenrecordStatus', async () => ({
    recording: !!screenrecord,
    ...(screenrecord ? { serial: screenrecord.serial, devicePath: screenrecord.devicePath } : {}),
  }))

  // 启动 logcat：在 Orca 终端中运行 adb logcat，不受 worker 回收影响。
  orca.panels.handle('adb.startLogcat', async ({ serial }) => {
    if (!serial) return failure<{ started: true }>('invalid_params', 'serial 不能为空')
    if (!orca.host.has('terminal.create')) {
      return failure<{ started: true }>('action_failed', '当前 Orca 不支持终端创建')
    }
    const workspaceId = await pickWorkspaceId(orca)
    if (!workspaceId) {
      return failure<{ started: true }>('no_workspace', '没有可用于运行 logcat 的 workspace')
    }
    await closeLogcatTerminal(orca)

    const adbPath = await getSetting(orca, SETTINGS.adbPath, 'adb')
    const tag = await getSetting(orca, SETTINGS.logcatTag, '')
    const args = ['-s', serial, 'logcat']
    if (tag.trim()) args.push('-s', tag.trim())
    const command = `${quoteForShell(adbPath)} ${args.join(' ')}`

    try {
      const { terminalId } = await orca.host.call('terminal.create', {
        workspaceId,
        title: `ADB logcat · ${serial}`,
        command,
      })
      await orca.storage.set(STORAGE_KEYS.logcatTerminalId, terminalId)
      await orca.storage.set(STORAGE_KEYS.logcatSerial, serial)
      await orca.storage.set(STORAGE_KEYS.logcatSeqBase, 0)
      await orca.storage.set(STORAGE_KEYS.logcatLastLines, [])
      await orca.storage.set(STORAGE_KEYS.lastSerial, serial)
      orca.panels.post('adb.logcatState', { state: 'active', serial })
      return success({ started: true as const })
    } catch (error) {
      const message = errorMessage(error)
      orca.panels.post('adb.logcatState', { state: 'error', serial, error: message })
      return failure<{ started: true }>('action_failed', message)
    }
  })

  // 轮询 logcat 输出：terminal.read 返回最新若干行，worker 去重后按 seq 返回新增行。
  // worker 被回收重启后能从 storage 恢复 lastLines 与 seqBase，避免重复或漏行。
  orca.panels.handle('adb.pollLogcat', async (input) => {
    const since = input?.since
    const terminalId = await getStorageString(orca, STORAGE_KEYS.logcatTerminalId)
    const serial = await getStorageString(orca, STORAGE_KEYS.logcatSerial)
    const empty = (state: 'stopped' | 'active' | 'error') => ({
      lines: [] as { seq: number; line: string }[],
      nextSeq: since ?? 0,
      state,
      serial: serial ?? '',
    })
    if (!terminalId) return success(empty('stopped'))
    if (!orca.host.has('terminal.read')) {
      return failure<ReturnType<typeof empty>>('action_failed', '当前 Orca 不支持终端读取')
    }

    let current: string[]
    try {
      const result = await orca.host.call('terminal.read', { terminalId, maxLines: 2000 })
      current = result.lines.map((line) => line.replace(/\r$/, '')).filter((line) => line.trim().length > 0)
    } catch (error) {
      await closeLogcatTerminal(orca)
      const message = errorMessage(error)
      orca.panels.post('adb.logcatState', { state: 'error', serial, error: message })
      return success(empty('error'))
    }

    const storedLast = await orca.storage.get(STORAGE_KEYS.logcatLastLines)
    const lastLines: string[] = Array.isArray(storedLast) ? (storedLast as string[]).filter((x) => typeof x === 'string') : []

    // 找 lastLines 的尾部在当前窗口中的最长匹配，其后即为新增行。
    let added: string[]
    if (lastLines.length === 0) {
      added = current
    } else {
      // 用 lastLines 的最后一行作锚点，在 current 中找它最后出现的位置，
      // 其后的行即为新增。找不到则视为窗口已滚动过旧内容，全量重发。
      const anchor = lastLines[lastLines.length - 1]
      let anchorIdx = -1
      for (let i = current.length - 1; i >= 0; i--) {
        if (current[i] === anchor) { anchorIdx = i; break }
      }
      added = anchorIdx >= 0 ? current.slice(anchorIdx + 1) : current
    }

    const seqBaseValue = await orca.storage.get(STORAGE_KEYS.logcatSeqBase)
    let seqBase = typeof seqBaseValue === 'number' ? seqBaseValue : 0
    const newEntries = added.map((line) => ({ seq: ++seqBase, line }))
    await orca.storage.set(STORAGE_KEYS.logcatSeqBase, seqBase)
    await orca.storage.set(STORAGE_KEYS.logcatLastLines, current.slice(-200))

    const visible = newEntries.filter((entry) => entry.seq > (since ?? 0))
    return success({
      lines: visible,
      nextSeq: seqBase,
      state: 'active' as const,
      serial: serial ?? '',
    })
  })

  orca.panels.handle('adb.stopLogcat', async () => {
    await closeLogcatTerminal(orca)
    orca.panels.post('adb.logcatState', { state: 'stopped' })
    return success({ stopped: true as const })
  })

  // 列出可选 agent：优先用历史会话里实际出现过的 agent，再补一组常见候选，去重。
  // 不调用 CLI：worker 的 Node 环境里 `orca` 解析到 Electron 入口，无法可靠执行子命令。
  orca.panels.handle('adb.listAgents', async () => {
    type AgentItem = { id: string; name: string; isDefault: boolean }
    const knownNames: Record<string, string> = {
      opencode: 'OpenCode', opencode2: 'OpenCode 2', codex: 'Codex', claude: 'Claude',
      gemini: 'Gemini', codebuddy: 'CodeBuddy', 'qoder-cn': 'Qoder CLI China',
      qoder: 'Qoder', pi: 'Pi', copilot: 'Copilot', cursor: 'Cursor', kimi: 'Kimi',
      grok: 'Grok', aider: 'Aider', hermes: 'Hermes',
    }
    const ids = new Set<string>(Object.keys(knownNames))
    let defaultId = DEFAULT_AGENT

    if (orca.host.has('agent.listSessions')) {
      try {
        const { sessions } = await orca.host.call('agent.listSessions', { limit: 100 })
        for (const sess of sessions) if (sess.agent) ids.add(sess.agent)
      } catch {
        // 忽略，使用固定候选。
      }
    }

    const configured = await getSetting(orca, SETTINGS.askAgent, defaultId)
    if (configured) { ids.add(configured); defaultId = configured }

    const agents: AgentItem[] = [...ids].sort().map((id) => ({
      id,
      name: knownNames[id] ?? id,
      isDefault: id === defaultId,
    }))
    return success({ agents })
  })

  // 列出历史会话（含“新会话”选项由 UI 提供）。
  orca.panels.handle('adb.listSessions', async () => {
    type SessionItem = { sessionId: string; agent: string; title: string; updatedAt: number; running: boolean }
    if (!orca.host.has('agent.listSessions')) {
      return success<{ sessions: SessionItem[] }>({ sessions: [] })
    }
    try {
      const { sessions } = await orca.host.call('agent.listSessions', { limit: 30 })
      return success({
        sessions: sessions.map((s) => ({
          sessionId: s.sessionId,
          agent: s.agent,
          title: s.title || s.sessionId.slice(0, 8),
          updatedAt: s.updatedAt,
          running: s.running,
        })),
      })
    } catch (error) {
      return failure<{ sessions: SessionItem[] }>('action_failed', `无法列出会话：${errorMessage(error)}`)
    }
  })

  // 问 AI：按用户选择的 agent / 会话 / 提示词发起对话；新会话用 agent.launch，已有会话用 resume + sendText。
  orca.panels.handle('adb.askAi', async ({ agent, prompt, sessionId }) => {
    type AskAiResult = { terminalId: string; focused: boolean; message: string }
    if (!agent || !agent.trim()) return failure<AskAiResult>('invalid_params', '请选择智能体')
    if (!prompt || !prompt.trim()) return failure<AskAiResult>('invalid_params', '提示词不能为空')
    if (!orca.host.has('agent.launch')) {
      return failure<AskAiResult>('action_failed', '当前 Orca 不支持 agent.launch')
    }

    const workspaceId = await pickWorkspaceId(orca)
    if (!workspaceId) {
      return failure<AskAiResult>('no_workspace', '没有可用于启动 agent 的 workspace')
    }

    let terminalId: string
    try {
      if (sessionId && orca.host.has('agent.resume')) {
        // 恢复已有会话：resume 不带 prompt，恢复后用 sendText 发送。
        const resumed = await orca.host.call('agent.resume', {
          workspaceId,
          agent: agent as never,
          sessionId,
        })
        terminalId = resumed.terminalId
        if (prompt.trim()) {
          await orca.host.call('terminal.sendText', { terminalId, text: prompt, enter: true })
        }
      } else {
        const launched = await orca.host.call('agent.launch', { workspaceId, agent, prompt })
        terminalId = launched.terminalId
      }
    } catch (error) {
      return failure<AskAiResult>(
        'action_failed',
        `无法启动 agent「${agent}」：${errorMessage(error)}。请确认该 agent 已安装启用，或更换 agent/会话。`,
      )
    }

    let focused = false
    if (orca.host.has('terminal.focus')) {
      try {
        const r = await orca.host.call('terminal.focus', { terminalId })
        focused = r.focused
      } catch {
        focused = false
      }
    }

    const message = focused
      ? `已启动 ${agent}${sessionId ? '（恢复会话）' : ''} 并打开终端；提示词已发送。`
      : `已在后台启动 ${agent}${sessionId ? '（恢复会话）' : ''}；请在 Orca 中查看对应终端。`

    if (orca.host.has('notifications.show')) {
      await orca.host.call('notifications.show', {
        title: 'ADB Helper: 已启动 AI',
        body: message,
      }).catch(() => undefined)
    }

    return success<AskAiResult>({ terminalId, focused, message })
  })

  orca.commands.register('adb.stopLogcat', async () => {
    await closeLogcatTerminal(orca)
    return '已停止 logcat'
  })

  orca.log('ADB Helper worker 已启动（终端 logcat 模式）')
}
