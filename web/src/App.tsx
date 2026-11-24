import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getStrings, type Locale } from './i18n'
import { parseLogLine } from './logHighlight'
import ScreenshotTab from './ScreenshotTab'
import ScreenrecordTab from './ScreenrecordTab'
import AppsTab from './AppsTab'
import WirelessTab from './WirelessTab'
import CommandsTab from './CommandsTab'
import {
  askAi,
  getConfig,
  getDetail,
  listAgents,
  listDevices,
  listSessions,
  onDevicesChanged,
  onLogcatState,
  openLogcatTerminal,
  pollLogcat,
  setLocale,
  startLogcat,
  stopLogcat,
  updateSettings,
  type AgentOption,
  type SessionOption,
  type CommandResult,
  type PluginConfig,
  type DeviceChangedPayload,
  type DeviceDetail,
  type DeviceInfo,
  type LogcatStatePayload,
} from './orcaApi'

type TabId = 'log' | 'screenshot' | 'screenrecord' | 'apps' | 'commands'

interface LogEntry {
  seq: number
  line: string
  receivedAt: number
}

function failureMessage(result: CommandResult<unknown>, fallback: string): string {
  return !result.ok ? result.message : fallback
}

export default function App() {
  const [locale, setLocaleState] = useState<Locale>('zh-CN')
  const [activeTab, setActiveTab] = useState<TabId>('log')
  const [wirelessOpen, setWirelessOpen] = useState<boolean>(false)
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [source, setSource] = useState<'primary' | 'fallback'>('primary')
  const [selectedSerial, setSelectedSerial] = useState<string>('')
  const [detail, setDetail] = useState<DeviceDetail | null>(null)
  const [loadingDevices, setLoadingDevices] = useState<boolean>(true)
  const [deviceError, setDeviceError] = useState<string>('')
  const [detailError, setDetailError] = useState<string>('')
  const [logcatState, setLogcatState] = useState<LogcatStatePayload['state']>('stopped')
  const [logcatError, setLogcatError] = useState<string>('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<string>('')
  const [notice, setNotice] = useState<string>('')
  const [selectedText, setSelectedText] = useState<string>('')
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null)
  const [askOpen, setAskOpen] = useState<boolean>(false)
  const [askAgents, setAskAgents] = useState<AgentOption[]>([])
  const [askSessions, setAskSessions] = useState<SessionOption[]>([])
  const [askAgentId, setAskAgentId] = useState<string>('opencode')
  const [askSessionId, setAskSessionId] = useState<string>('')
  const [askText, setAskText] = useState<string>('')
  const [askPrompt, setAskPrompt] = useState<string>('')
  const [askBusy, setAskBusy] = useState<boolean>(false)
  const [manualCopyText, setManualCopyText] = useState<string>('')
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false)
  const [settingsBusy, setSettingsBusy] = useState<boolean>(false)
  const [settingsError, setSettingsError] = useState<string>('')
  const [settingsDraft, setSettingsDraft] = useState<PluginConfig>({
    locale: 'zh-CN',
    adbPath: 'adb',
    logcatTag: '',
    askAgent: 'opencode',
  })
  const logViewportRef = useRef<HTMLDivElement | null>(null)
  const autoScrollRef = useRef<boolean>(true)
  const [atBottom, setAtBottom] = useState<boolean>(true)
  const seqRef = useRef<number>(0)
  const pollingRef = useRef<boolean>(false)

  const s = getStrings(locale)

  const refreshDevices = useCallback(async () => {
    setLoadingDevices(true)
    setDeviceError('')
    try {
      const result = await listDevices()
      if (result.ok) {
        setDevices(result.value.devices)
        setSource(result.value.source)
      } else {
        setDeviceError(result.message)
      }
    } catch (error) {
      setDeviceError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoadingDevices(false)
    }
  }, [])

  // 初始化：读取配置、订阅事件、首次加载设备。
  useEffect(() => {
    let cancelled = false
    let disposers: { dispose(): void }[] = []
    void (async () => {
      try {
        const config = await getConfig()
        if (cancelled) return
        const initialLocale = config.locale === 'zh-CN' ? 'zh-CN' : 'en'
        setLocaleState(initialLocale)
      } catch {
        // 使用默认语言。
      }
      if (cancelled) return
      disposers = [
        onDevicesChanged((payload: DeviceChangedPayload) => {
          setDevices(payload.devices)
          setSource(payload.source)
          if (payload.error) setDeviceError(payload.error)
        }),
        onLogcatState((payload: LogcatStatePayload) => {
          setLogcatState(payload.state)
          setLogcatError(payload.error ?? '')
        }),
      ]
      await refreshDevices()
    })()
    return () => {
      cancelled = true
      for (const d of disposers) d.dispose()
      void stopLogcat()
    }
  }, [refreshDevices])

  // 选区被取消（点击别处、折叠等）时，隐藏浮动工具。
  useEffect(() => {
    const onChange = () => {
      const selection = window.getSelection()
      const el = logViewportRef.current
      const text = selection?.toString() ?? ''
      if (!text.trim() || !el || !selection || selection.rangeCount === 0 || !el.contains(selection.anchorNode)) {
        setSelectedText((prev) => (prev ? '' : prev))
        setSelectionPos((prev) => (prev ? null : prev))
      }
    }
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
  }, [])

  const handleSelectDevice = useCallback(
    async (serial: string) => {
      if (serial === selectedSerial) return
      // 切换设备前先停止旧流（满足"设备变化先停旧流"）。
      if (logcatState === 'active' || logcatState === 'starting') {
        await stopLogcat()
        setLogs([])
        seqRef.current = 0
      }
      setSelectedSerial(serial)
      setDetail(null)
      setDetailError('')
      try {
        const result = await getDetail(serial)
        if (result.ok) setDetail(result.value)
        else setDetailError(result.message)
      } catch (error) {
        setDetailError(error instanceof Error ? error.message : String(error))
      }
    },
    [selectedSerial, logcatState],
  )

  const handleStart = useCallback(async () => {
    if (!selectedSerial) {
      setNotice(s.selectDeviceHint)
      return
    }
    setLogcatState('starting')
    setLogcatError('')
    setLogs([])
    seqRef.current = 0
    autoScrollRef.current = true
    setAtBottom(true)
    try {
      const result = await startLogcat(selectedSerial)
      if (!result.ok) {
        setLogcatState('error')
        setLogcatError(result.message)
      }
    } catch (error) {
      setLogcatState('error')
      setLogcatError(error instanceof Error ? error.message : String(error))
    }
  }, [selectedSerial, s.selectDeviceHint])

  const handleStop = useCallback(async () => {
    try {
      const result = await stopLogcat()
      if (!result.ok) setLogcatError(result.message)
      setLogcatState('stopped')
    } catch (error) {
      setLogcatError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  // 在 Orca 中打开一个独立终端运行 logcat 并聚焦该 Tab；与面板内轮询视图互不影响。
  const handleOpenInTerminal = useCallback(async () => {
    if (!selectedSerial) {
      setNotice(s.selectDeviceHint)
      return
    }
    try {
      const result = await openLogcatTerminal(selectedSerial)
      if (result.ok) {
        setLogcatError('')
        setNotice(result.value.focused
          ? s.openInTerminalFocused
          : s.openInTerminalHint)
      } else {
        setLogcatError(result.message)
      }
    } catch (error) {
      setLogcatError(error instanceof Error ? error.message : String(error))
    }
  }, [selectedSerial, s.selectDeviceHint, s.openInTerminalFocused, s.openInTerminalHint])

  const handleLocaleChange = useCallback(async (next: Locale) => {
    setLocaleState(next)
    try {
      await setLocale(next)
    } catch {
      // 即使持久化失败也立即生效。
    }
  }, [])

  // 打开设置对话框：先显示，再读取当前配置作为草稿（与 Orca 设置页同一份配置）。
  // 读取失败也打开，用默认草稿并把错误显示在对话框内。
  const openSettings = useCallback(async () => {
    setSettingsOpen(true)
    setSettingsError('')
    try {
      const config = await getConfig()
      setSettingsDraft(config)
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  // 保存设置：写入草稿值；locale 变化时同步更新面板语言。
  const saveSettings = useCallback(async () => {
    if (settingsBusy) return
    setSettingsBusy(true)
    setSettingsError('')
    try {
      const updated = await updateSettings({
        adbPath: settingsDraft.adbPath.trim(),
        locale: settingsDraft.locale,
        logcatTag: settingsDraft.logcatTag.trim(),
        askAgent: settingsDraft.askAgent.trim(),
      })
      setSettingsDraft(updated)
      // 语言变化时立即让整个面板切换语言（持久化已在 updateSettings 完成）。
      if (updated.locale === 'zh-CN' || updated.locale === 'en') {
        setLocaleState(updated.locale as Locale)
      }
      setSettingsOpen(false)
      setNotice(s.settingsSaved)
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : String(error))
    } finally {
      setSettingsBusy(false)
    }
  }, [settingsBusy, settingsDraft, s.settingsSaved])

  const visibleLogs = useMemo(() => {
    if (!filter.trim()) return logs
    const query = filter.trim().toLowerCase()
    return logs.filter((entry) => entry.line.toLowerCase().includes(query))
  }, [logs, filter])

  // active 时定时轮询终端输出；与新 worker 无关，终端由 Orca 管理，稳定输出。
  useEffect(() => {
    if (logcatState !== 'active') return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      if (pollingRef.current) return
      pollingRef.current = true
      try {
        const result = await pollLogcat(seqRef.current)
        if (cancelled) return
        if (result.ok) {
          const { lines, nextSeq, state } = result.value
          if (state !== 'active') {
            setLogcatState(state)
            if (state === 'error') setLogcatError('logcat 终端已结束')
          }
          if (lines.length) {
            const now = Date.now()
            setLogs((prev) => {
              // 仅追加比当前最后一行更新的条目；不再裁剪旧行。
              const lastSeq = prev.length > 0 ? prev[prev.length - 1].seq : 0
              const additions = lines
                .filter((entry) => entry.seq > lastSeq)
                .map((entry) => ({ seq: entry.seq, line: entry.line, receivedAt: now }))
              return additions.length ? [...prev, ...additions] : prev
            })
            seqRef.current = nextSeq
          }
        }
      } catch {
        // 轮询失败保留状态，下次再试。
      } finally {
        pollingRef.current = false
      }
      if (!cancelled) timer = setTimeout(tick, 700)
    }
    void tick()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [logcatState])

  const lastAutoTopRef = useRef<number | null>(null)

  // 有新日志时滚到末尾。仅在“跟随最新”模式下滚动，并记录程序化目标以区分用户滚动。
  useLayoutEffect(() => {
    const el = logViewportRef.current
    if (!el || !autoScrollRef.current) return
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
      lastAutoTopRef.current = el.scrollTop
    })
    return () => cancelAnimationFrame(id)
  }, [logs, visibleLogs])

  const handleLogViewportScroll = useCallback(() => {
    const el = logViewportRef.current
    if (!el) return
    // 若当前位置就是程序化滚动设定值，说明是自动跟随触发的，忽略。
    if (lastAutoTopRef.current !== null && Math.abs(el.scrollTop - lastAutoTopRef.current) < 1) return
    // 其余情况均为用户主动滚动：停止跟随，直到用户点“回到最新”。
    if (autoScrollRef.current) {
      autoScrollRef.current = false
      setAtBottom(false)
      lastAutoTopRef.current = null
    }
  }, [])

  /** 用户明确的滚动意图（滚轮/触摸/方向键）：立即停止跟随。 */
  const handleUserScrollIntent = useCallback(() => {
    if (autoScrollRef.current) {
      autoScrollRef.current = false
      setAtBottom(false)
      lastAutoTopRef.current = null
    }
  }, [])

  const handleJumpToLatest = useCallback(() => {
    autoScrollRef.current = true
    setAtBottom(true)
    const el = logViewportRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
      lastAutoTopRef.current = el.scrollTop
    }
  }, [])

  // 复制文本：Clipboard API -> execCommand -> 手动复制弹层。返回是否静默成功。
  const copyText = useCallback(async (text: string): Promise<void> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setNotice(s.copied)
        return
      }
    } catch {
      // 继续回退。
    }
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.top = '-1000px'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      if (ok) {
        setNotice(s.copied)
        return
      }
    } catch {
      // 继续回退到手动复制。
    }
    setManualCopyText(text)
  }, [s.copied])

  const handleCopySelection = useCallback(() => {
    if (!selectedText.trim()) return
    void copyText(selectedText)
    setSelectedText('')
    setSelectionPos(null)
    window.getSelection()?.removeAllRanges()
  }, [copyText, selectedText])

  // 只清空面板显示，不改变终端里的原始输出；seq 继续递增，避免清空后重复拉到旧行。
  const handleClearLogs = useCallback(() => {
    setLogs([])
    setSelectedText('')
    setSelectionPos(null)
    setManualCopyText('')
    window.getSelection()?.removeAllRanges()
    autoScrollRef.current = true
    setAtBottom(true)
  }, [])

  const handleCaptureSelection = useCallback(() => {
    const selection = window.getSelection()
    const el = logViewportRef.current
    const text = selection?.toString() ?? ''
    const valid = text.trim() && el && selection && selection.rangeCount > 0 && el.contains(selection.anchorNode)
    if (valid && selection) {
      setSelectedText(text)
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      // 菜单显示在选区上方，水平居中于选区；限制在视口内。
      const menuWidth = 190
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - menuWidth / 2, window.innerWidth - menuWidth - 8))
      const top = Math.max(8, rect.top - 42)
      setSelectionPos({ top, left })
    } else {
      setSelectedText('')
      setSelectionPos(null)
    }
  }, [])

  // 打开“问 AI”弹窗：动态加载 agent 与历史会话，预填选中文本与默认提示词。
  const openAskDialog = useCallback(async () => {
    if (!selectedText.trim() || askBusy) return
    setAskOpen(true)
    setAskText(selectedText)
    setAskPrompt(s.promptTemplate.replace('{selected-text}', selectedText))
    setAskSessionId('')
    setNotice('')
    // 异步加载选项，失败时保留空列表并在弹窗内提示。
    try {
      const [agentsResult, sessionsResult] = await Promise.all([listAgents(), listSessions()])
      if (agentsResult.ok && agentsResult.value.agents.length) {
        setAskAgents(agentsResult.value.agents)
        const def = agentsResult.value.agents.find((a) => a.isDefault) ?? agentsResult.value.agents[0]
        setAskAgentId(def.id)
      }
      if (sessionsResult.ok) setAskSessions(sessionsResult.value.sessions)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    }
  }, [selectedText, askBusy, s.promptTemplate])

  const closeAskDialog = useCallback(() => {
    if (askBusy) return
    setAskOpen(false)
  }, [askBusy])

  const submitAsk = useCallback(async () => {
    if (!askAgentId || !askPrompt.trim() || askBusy) return
    setAskBusy(true)
    // 若用户编辑了文本但提示词里仍是原选中文本，则同步替换为编辑后的文本。
    const finalPrompt = askPrompt.includes(selectedText) && askText !== selectedText
      ? askPrompt.replace(selectedText, askText)
      : askPrompt
    try {
      const result = await askAi(askAgentId, finalPrompt, askSessionId || undefined)
      if (!result.ok) {
        setNotice(result.code === 'no_workspace' ? s.noWorkspaceError : result.message)
      } else {
        setNotice(result.value.message)
        setAskOpen(false)
        setSelectedText('')
        setSelectionPos(null)
        window.getSelection()?.removeAllRanges()
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setAskBusy(false)
    }
  }, [askAgentId, askPrompt, askText, selectedText, askSessionId, askBusy, s.noWorkspaceError])

  const stateLabel = (state: DeviceInfo['state']): string => {
    switch (state) {
      case 'device': return s.stateDevice
      case 'offline': return s.stateOffline
      case 'unauthorized': return s.stateUnauthorized
      default: return s.stateUnknown
    }
  }

  const selectedDeviceOnline = devices.some((d) => d.serial === selectedSerial && d.state === 'device')

  return (
    <div className="adb-helper">
      <header className="header">
        <div className="header-left">
          <h1>{s.appTitle}</h1>
          <button
            className="icon-btn settings-btn"
            onClick={() => void openSettings()}
            title={s.settingsButton}
            aria-label={s.settingsButton}
          >
            ⚙
          </button>
        </div>
        <label className="lang">
          {s.languageLabel}
          <select value={locale} onChange={(e) => void handleLocaleChange(e.target.value as Locale)}>
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>

      <div className="panel-scroll">
        {notice && <div className="notice">{notice}</div>}

      <section>
        <div className="section-header">
          <h2>{s.deviceListTitle}</h2>
          <div className="device-header-actions">
            <button onClick={() => setWirelessOpen((v) => !v)} aria-expanded={wirelessOpen}>{s.tabWireless}</button>
            <button onClick={() => void refreshDevices()}>{s.refresh}</button>
          </div>
        </div>
        {wirelessOpen && (
          <WirelessTab s={s} locale={locale} devices={devices} onConnected={() => void refreshDevices()} />
        )}
        <div className="source-badge">
          {source === 'primary' ? s.sourcePrimary : s.sourceFallback}
        </div>
        {loadingDevices ? (
          <p className="muted">{s.loading}</p>
        ) : deviceError ? (
          <p className="error">{deviceError}</p>
        ) : devices.length === 0 ? (
          <p className="muted">{s.noDevices}</p>
        ) : (
          <ul className="device-list">
            {devices.map((device) => (
              <li key={device.serial}>
                <button
                  className={`device-item ${selectedSerial === device.serial ? 'selected' : ''}`}
                  onClick={() => void handleSelectDevice(device.serial)}
                  disabled={device.state === 'unauthorized'}
                >
                  <span className="serial">{device.serial}</span>
                  <span className={`state state-${device.state}`}>{stateLabel(device.state)}</span>
                  {device.model && <span className="model">{device.model}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedSerial && (
        <section>
          <h2>{s.deviceDetailTitle}</h2>
          {detailError ? (
            <p className="error">{detailError}</p>
          ) : detail ? (
            <dl className="detail">
              <dt>{s.fieldSerial}</dt><dd>{detail.serial}</dd>
              <dt>{s.fieldModel}</dt><dd>{detail.model}</dd>
              <dt>{s.fieldAndroid}</dt><dd>{detail.androidVersion}</dd>
            </dl>
          ) : (
            <p className="muted">{s.loading}</p>
          )}
        </section>
      )}

      <nav className="tab-bar" role="tablist" aria-label={s.appTitle}>
        {([
          ['log', s.tabLog],
          ['screenshot', s.tabScreenshot],
          ['screenrecord', s.tabScreenrecord],
          ['apps', s.tabApps],
          ['commands', s.tabCommands],
        ] as [TabId, string][]).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={`tab-btn ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="tab-content" style={{ display: activeTab === 'log' ? undefined : 'none' }}>
      <section className="logcat-section">
        <div className="section-header">
          <h2>{s.logcatTitle}</h2>
          <span className={`state state-logcat-${logcatState}`}>
            {!selectedSerial ? s.selectDeviceHint
              : logcatState === 'active' ? s.logcatActive
              : logcatState === 'starting' ? s.logcatStarting
              : logcatState === 'error' ? s.logcatError
              : s.logcatIdle}
          </span>
        </div>
        <div className="logcat-controls">
          <button onClick={() => void handleStart()} disabled={!selectedSerial || logcatState === 'active' || logcatState === 'starting'}>
            {s.startLogcat}
          </button>
          <button onClick={() => void handleStop()} disabled={logcatState !== 'active' && logcatState !== 'starting'}>
            {s.stopLogcat}
          </button>
          <button className="muted-btn" onClick={handleClearLogs} disabled={logs.length === 0} title={s.clearLogs}>
            {s.clearLogs}
          </button>
          <button className="push-right" onClick={() => void handleOpenInTerminal()} disabled={!selectedSerial} title={s.openInTerminalTooltip}>
            {s.openInTerminal}
          </button>
        </div>
        {logcatError && <p className="error">{logcatError}</p>}
        <input
          className="filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={s.filterPlaceholder}
        />
        {filter && <button className="link" onClick={() => setFilter('')}>{s.clearFilter}</button>}
        <div className="raw-header">
          <span>{s.rawOutputTitle} ({visibleLogs.length})</span>
        </div>
        <div className="log-viewport-wrap">
          <div
            className="log-viewport"
            ref={logViewportRef}
            onScroll={handleLogViewportScroll}
            onWheel={handleUserScrollIntent}
            onTouchMove={handleUserScrollIntent}
            onKeyDown={(e) => {
              if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
                handleUserScrollIntent()
              }
            }}
            onMouseUp={handleCaptureSelection}
            onKeyUp={handleCaptureSelection}
          >
            {!selectedSerial ? (
              <p className="hint">{s.selectDeviceHint}</p>
            ) : visibleLogs.length === 0 ? (
              <p className="muted">{s.logcatIdle}</p>
            ) : (
              visibleLogs.map((entry, index) => {
                const parsed = parseLogLine(entry.line)
                return (
                  <div className={`log-line log-lv-${parsed.level}`} key={`${entry.receivedAt}-${index}`}>
                    <code>{parsed.segments.map((seg, i) => (
                      <span className={seg.kind ? `log-f-${seg.kind}` : undefined} key={i}>{seg.text}</span>
                    ))}</code>
                  </div>
                )
              })
            )}
          </div>
          {!atBottom && (
            <button className="jump-latest" onClick={handleJumpToLatest}>↓ {s.jumpToLatest}</button>
          )}
        </div>
      </section>
      </div>

      <div className="tab-content" style={{ display: activeTab === 'screenshot' ? undefined : 'none' }}>
        <ScreenshotTab s={s} locale={locale} selectedSerial={selectedSerial} deviceOnline={selectedDeviceOnline} onNotice={setNotice} />
      </div>
      <div className="tab-content" style={{ display: activeTab === 'screenrecord' ? undefined : 'none' }}>
        <ScreenrecordTab s={s} locale={locale} selectedSerial={selectedSerial} deviceOnline={selectedDeviceOnline} onNotice={setNotice} />
      </div>
      <div className="tab-content" style={{ display: activeTab === 'apps' ? undefined : 'none' }}>
        <AppsTab s={s} locale={locale} selectedSerial={selectedSerial} deviceOnline={selectedDeviceOnline} />
      </div>
      <div className="tab-content" style={{ display: activeTab === 'commands' ? undefined : 'none' }}>
        <CommandsTab s={s} locale={locale} selectedSerial={selectedSerial} deviceOnline={selectedDeviceOnline} />
      </div>
      </div>

      {selectedText.trim() && selectionPos && (
        <div
          className="selection-menu"
          style={{ top: selectionPos.top, left: selectionPos.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button onClick={handleCopySelection} title={s.copySelected}>
            ⧉ {s.copySelected}
          </button>
          <button onClick={() => void openAskDialog()} disabled={askBusy} title={s.aiPromptHint}>
            ✨ {s.askAi}
          </button>
        </div>
      )}

      <footer className="app-footer">
        {s.versionLabel} {__APP_VERSION__} · {s.buildLabel} {__BUILD_NO__}
      </footer>

      {manualCopyText && (
        <div className="modal-backdrop" onClick={() => setManualCopyText('')}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong>{s.manualCopyTitle}</strong>
              <button className="icon-btn" onClick={() => setManualCopyText('')} aria-label={s.closeLabel}>✕</button>
            </div>
            <p className="muted">{s.manualCopyHint}</p>
            <textarea
              className="manual-copy"
              readOnly
              value={manualCopyText}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        </div>
      )}

      {askOpen && (
        <div className="modal-backdrop" onClick={closeAskDialog}>
          <div className="modal ask-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong>✨ {s.askDialogTitle}</strong>
              <button className="icon-btn" onClick={closeAskDialog} aria-label={s.closeLabel}>✕</button>
            </div>

            <label className="ask-field">
              <span>{s.agentLabel}</span>
              <select value={askAgentId} onChange={(e) => setAskAgentId(e.target.value)} disabled={askBusy}>
                {askAgents.length === 0 && <option value="">{s.loadingOptions}</option>}
                {askAgents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}{a.isDefault ? ' (default)' : ''}</option>
                ))}
              </select>
            </label>

            <label className="ask-field">
              <span>{s.sessionLabel}</span>
              <select value={askSessionId} onChange={(e) => setAskSessionId(e.target.value)} disabled={askBusy}>
                <option value="">{s.newSession}</option>
                {askSessions.map((sess) => (
                  <option key={sess.sessionId} value={sess.sessionId}>
                    {sess.agent}: {sess.title}{sess.running ? ' ●' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="ask-field">
              <span>{s.textLabel}</span>
              <textarea className="ask-text" value={askText} onChange={(e) => setAskText(e.target.value)} disabled={askBusy} />
            </label>

            <label className="ask-field">
              <span>{s.promptLabel}</span>
              <textarea className="ask-prompt" value={askPrompt} onChange={(e) => setAskPrompt(e.target.value)} disabled={askBusy} />
            </label>

            <div className="ask-actions">
              <button onClick={closeAskDialog} disabled={askBusy}>{s.cancelLabel}</button>
              <button className="primary" onClick={() => void submitAsk()} disabled={askBusy || !askAgentId || !askPrompt.trim()}>
                {askBusy ? s.askAiBusy : s.sendLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onClick={() => !settingsBusy && setSettingsOpen(false)}>
          <div className="modal settings-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong>⚙ {s.settingsTitle}</strong>
              <button className="icon-btn" onClick={() => !settingsBusy && setSettingsOpen(false)} aria-label={s.closeLabel}>✕</button>
            </div>

            <label className="ask-field">
              <span>{s.settingsAdbPath}</span>
              <input
                type="text"
                value={settingsDraft.adbPath}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, adbPath: e.target.value })}
                disabled={settingsBusy}
                spellCheck={false}
              />
              <span className="field-hint">{s.settingsAdbPathHint}</span>
            </label>

            <label className="ask-field">
              <span>{s.settingsLocale}</span>
              <select
                value={settingsDraft.locale}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, locale: e.target.value })}
                disabled={settingsBusy}
              >
                <option value="zh-CN">简体中文</option>
                <option value="en">English</option>
              </select>
            </label>

            <label className="ask-field">
              <span>{s.settingsLogcatTag}</span>
              <input
                type="text"
                value={settingsDraft.logcatTag}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, logcatTag: e.target.value })}
                disabled={settingsBusy}
                spellCheck={false}
              />
              <span className="field-hint">{s.settingsLogcatTagHint}</span>
            </label>

            <label className="ask-field">
              <span>{s.settingsAskAgent}</span>
              <input
                type="text"
                value={settingsDraft.askAgent}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, askAgent: e.target.value })}
                disabled={settingsBusy}
                spellCheck={false}
              />
              <span className="field-hint">{s.settingsAskAgentHint}</span>
            </label>

            {settingsError && <p className="error">{settingsError}</p>}

            <div className="ask-actions">
              <button onClick={() => setSettingsOpen(false)} disabled={settingsBusy}>{s.cancelLabel}</button>
              <button className="primary" onClick={() => void saveSettings()} disabled={settingsBusy}>
                {s.settingsSave}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
