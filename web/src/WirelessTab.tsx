import { useCallback, useEffect, useState } from 'react'
import type { Locale } from './i18n'
import { connectDevice, connectHistory, disconnectDevice, type CommandResult } from './orcaApi'
import type { DeviceInfo } from './orcaApi'

interface Strings {
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
  wirelessDisconnectRow: string
}

interface Props {
  locale: Locale
  s: Strings
  devices: DeviceInfo[]
  onConnected: () => void
}

export default function WirelessTab({ s, devices, onConnected }: Props) {
  const [target, setTarget] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // 正在执行断开的无线设备 serial（行内“断开”按钮单独置灰，避免与顶部按钮共用 busy）。
  const [disconnecting, setDisconnecting] = useState('')

  const loadHistory = useCallback(async () => {
    try { const r = await connectHistory(); setHistory(r.history) } catch { /* 忽略 */ }
  }, [])
  useEffect(() => { void loadHistory() }, [loadHistory])

  const valid = /^(\d{1,3}\.){3}\d{1,3}:\d{1,5}$/.test(target) &&
    target.split(':')[0].split('.').every((p) => Number(p) <= 255) &&
    Number(target.split(':')[1]) > 0 && Number(target.split(':')[1]) <= 65535

  const doAction = useCallback(async (disconnect: boolean, t: string) => {
    if (!t) return
    setBusy(true); setError(''); setResult('')
    try {
      const r: CommandResult<{ output: string }> = disconnect ? await disconnectDevice(t) : await connectDevice(t)
      if (r.ok) {
        setResult(r.value.output || (disconnect ? 'disconnected' : 'connected'))
        onConnected()
        if (!disconnect) await loadHistory()
      } else setError(r.message)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }, [onConnected, loadHistory])

  // 行内“断开”：直接对当前设备断开，不受顶部输入框格式校验限制。
  const disconnectRow = useCallback(async (serial: string) => {
    setTarget(serial)
    setDisconnecting(serial)
    setError('')
    try {
      const r = await disconnectDevice(serial)
      setResult(r.ok ? (r.value.output || 'disconnected') : '')
      if (!r.ok) setError(r.message)
      onConnected()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setDisconnecting('') }
  }, [onConnected])

  // 无线设备：serial 含 IP:端口 形式。
  const wirelessDevices = devices.filter((d) => d.serial.includes(':'))

  return (
    <div className="wireless-panel">
      <label className="ask-field install-field">
        <span>{s.wirelessInput}</span>
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="192.168.1.100:5555" />
      </label>
      {target && !valid && <p className="error">{s.wirelessInvalid}</p>}
      <div className="logcat-controls">
        <button onClick={() => void doAction(false, target)} disabled={busy || !valid}>{busy ? s.wirelessBusy : s.wirelessConnect}</button>
        <button onClick={() => void doAction(true, target)} disabled={busy || !valid}>{s.wirelessDisconnect}</button>
      </div>

      <h4 className="sub-title">{s.wirelessCurrent}</h4>
      {wirelessDevices.length === 0 ? <p className="muted">{s.wirelessNoCurrent}</p> : (
        <div className="pkg-list">
          {wirelessDevices.map((d) => (
            // 行本身可点（填入输入框），右侧“断开”按钮用 stopPropagation 避免触发填充。
            // 这里刻意不用 <button> 包 <button>，避免产生非法嵌套 HTML。
            <div
              key={d.serial}
              className="pkg-item wireless-device-row"
              onClick={() => setTarget(d.serial)}
              title={s.wirelessRowHint}
            >
              <span className="serial">{d.serial}</span>
              <span className={`state state-${d.state}`}>{d.state}</span>
              <span className="model">{d.model ?? ''}</span>
              <button
                className="icon-btn small"
                title={s.wirelessDisconnectRow}
                aria-label={s.wirelessDisconnectRow}
                disabled={busy || disconnecting === d.serial}
                onClick={(e) => { e.stopPropagation(); void disconnectRow(d.serial) }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <h4 className="sub-title">{s.wirelessHistory}</h4>
      {history.length === 0 ? <p className="muted">{s.wirelessNoHistory}</p> : (
        <div className="pkg-list">
          {history.map((h) => (
            <button key={h} className="pkg-item" onClick={() => setTarget(h)}>{h}</button>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {result && <pre className="output-block">{s.wirelessResult}: {result}</pre>}
    </div>
  )
}
