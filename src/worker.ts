// ADB Helper 的受信任 worker：面板请求处理、设备/详情查询、问 AI，以及基于 Orca 终端的 logcat 流。

import type { OrcaWorkerApi } from 'orca/worker'
import './protocol'
import type { CommandResult, DeviceDetail, RequestErrorCode } from './protocol'
import { getDeviceDetailViaAdb } from './adb'
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
} as const

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
