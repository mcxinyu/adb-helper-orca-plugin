import { useCallback, useEffect, useRef, useState } from 'react'
import type { Locale } from './i18n'
import { base64ToArrayBuffer, saveFile, screenrecordStatus, startScreenrecord, stopScreenrecord, type CommandResult } from './orcaApi'

interface Strings {
  tabScreenrecord: string
  startRecord: string
  stopRecord: string
  saveRecord: string
  recordIdle: string
  recordBusy: string
  recordNoDevice: string
  recordLimitLabel: string
  recordActive: string
  recordSaved: string
  recordCancelled: string
  recordLimitReached: string
}

interface Props {
  locale: Locale
  s: Strings
  selectedSerial: string
  deviceOnline: boolean
  onNotice: (message: string) => void
}

export default function ScreenrecordTab({ s, selectedSerial, deviceOnline, onNotice }: Props) {
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [startedAt, setStartedAt] = useState<number>(0)
  const [seconds, setSeconds] = useState(30)
  const [base64, setBase64] = useState<string>('')
  const [error, setError] = useState<string>('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 轮询 worker 状态，检测录制是否在时限到达后自动结束。
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const status = await screenrecordStatus()
        if (!cancelled) setRecording(status.recording)
      } catch { /* 忽略 */ }
    }
    const id = setInterval(() => { void check() }, 1500)
    void check()
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => setStartedAt((v) => v), 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [recording])

  const start = useCallback(async () => {
    if (!selectedSerial || !deviceOnline || busy || recording) return
    setBusy(true); setError(''); setBase64('')
    try {
      const result = await startScreenrecord(selectedSerial, seconds)
      if (result.ok) { setRecording(true); setStartedAt(Date.now()) }
      else setError(result.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }, [selectedSerial, deviceOnline, busy, recording, seconds])

  const stop = useCallback(async () => {
    if (busy || !recording) return
    setBusy(true); setError('')
    try {
      const result = await stopScreenrecord()
      setRecording(false)
      if (result.ok) setBase64(result.value.base64)
      else setError(result.message)
    } catch (e) {
      setRecording(false)
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }, [busy, recording])

  const save = useCallback(async () => {
    if (!base64) return
    const ok = await saveFile(base64ToArrayBuffer(base64), `record-${selectedSerial}.mp4`, 'video/mp4')
    onNotice(ok ? s.recordSaved : s.recordCancelled)
  }, [base64, selectedSerial, s.recordSaved, s.recordCancelled, onNotice])

  const elapsed = recording && startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0

  return (
    <section>
      <h2>{s.tabScreenrecord}</h2>
      {!selectedSerial || !deviceOnline ? (
        <p className="muted">{s.recordNoDevice}</p>
      ) : (
        <>
          <div className="logcat-controls">
            <button onClick={() => void start()} disabled={busy || recording}>{busy ? s.recordBusy : s.startRecord}</button>
            <button onClick={() => void stop()} disabled={busy || !recording}>{s.stopRecord}</button>
            <button onClick={() => void save()} disabled={!base64 || busy}>{s.saveRecord}</button>
          </div>
          <label className="ask-field record-limit">
            <span>{s.recordLimitLabel}</span>
            <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} disabled={recording || busy}>
              {[15, 30, 60, 120, 180].map((n) => <option key={n} value={n}>{n}s</option>)}
            </select>
          </label>
          {recording && <p className="notice">{s.recordActive} · {elapsed}s / {seconds}s</p>}
          {error && <p className="error">{error}</p>}
        </>
      )}
    </section>
  )
}
