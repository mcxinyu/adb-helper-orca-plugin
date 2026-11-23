import { useCallback, useEffect, useState } from 'react'
import type { Locale } from './i18n'
import { connectDevice, connectHistory, disconnectDevice, type CommandResult } from './orcaApi'

interface Strings {
  tabWireless: string
  wirelessInput: string
  wirelessConnect: string
  wirelessDisconnect: string
  wirelessHistory: string
  wirelessNoHistory: string
  wirelessInvalid: string
  wirelessResult: string
  wirelessBusy: string
}

interface Props {
  locale: Locale
  s: Strings
  onConnected: () => void
}

export default function WirelessTab({ s, onConnected }: Props) {
  const [target, setTarget] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadHistory = useCallback(async () => {
    try { const r = await connectHistory(); setHistory(r.history) } catch { /* 忽略 */ }
  }, [])
  useEffect(() => { void loadHistory() }, [loadHistory])

  // 前端先做格式校验，与 worker 一致。
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
        if (!disconnect) { onConnected(); await loadHistory() }
      } else setError(r.message)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }, [onConnected, loadHistory])

  return (
    <section>
      <h2>{s.tabWireless}</h2>
      <label className="ask-field install-field">
        <span>{s.wirelessInput}</span>
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="192.168.1.100:5555" />
      </label>
      {target && !valid && <p className="error">{s.wirelessInvalid}</p>}
      <div className="logcat-controls">
        <button onClick={() => void doAction(false, target)} disabled={busy || !valid}>{busy ? s.wirelessBusy : s.wirelessConnect}</button>
        <button onClick={() => void doAction(true, target)} disabled={busy || !valid}>{s.wirelessDisconnect}</button>
      </div>
      <h3 className="sub-title">{s.wirelessHistory}</h3>
      {history.length === 0 ? <p className="muted">{s.wirelessNoHistory}</p> : (
        <div className="pkg-list">
          {history.map((h) => (
            <button key={h} className="pkg-item" onClick={() => setTarget(h)}>{h}</button>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {result && <pre className="output-block">{s.wirelessResult}: {result}</pre>}
    </section>
  )
}
