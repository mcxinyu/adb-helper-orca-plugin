import { useCallback, useState } from 'react'
import type { Locale } from './i18n'
import { base64ToArrayBuffer, saveFile, screenshot, type CommandResult } from './orcaApi'

interface Strings {
  tabScreenshot: string
  takeScreenshot: string
  saveScreenshot: string
  shotPreview: string
  shotIdle: string
  shotBusy: string
  shotNoDevice: string
  shotSaved: string
  shotCancelled: string
}

interface Props {
  locale: Locale
  s: Strings
  selectedSerial: string
  deviceOnline: boolean
  onNotice: (message: string) => void
}

export default function ScreenshotTab({ s, selectedSerial, deviceOnline, onNotice }: Props) {
  const [busy, setBusy] = useState(false)
  const [base64, setBase64] = useState<string>('')
  const [error, setError] = useState<string>('')

  const take = useCallback(async () => {
    if (!selectedSerial || !deviceOnline || busy) return
    setBusy(true)
    setError('')
    setBase64('')
    try {
      const result = await screenshot(selectedSerial)
      if (result.ok) setBase64(result.value.base64)
      else setError(result.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [selectedSerial, deviceOnline, busy])

  const save = useCallback(async () => {
    if (!base64) return
    const ok = await saveFile(base64ToArrayBuffer(base64), `screenshot-${selectedSerial}.png`, 'image/png')
    onNotice(ok ? s.shotSaved : s.shotCancelled)
  }, [base64, selectedSerial, s.shotSaved, s.shotCancelled, onNotice])

  return (
    <section>
      <h2>{s.tabScreenshot}</h2>
      {!selectedSerial || !deviceOnline ? (
        <p className="muted">{s.shotNoDevice}</p>
      ) : (
        <>
          <div className="logcat-controls">
            <button onClick={() => void take()} disabled={busy}>{busy ? s.shotBusy : s.takeScreenshot}</button>
            <button onClick={() => void save()} disabled={!base64 || busy}>{s.saveScreenshot}</button>
          </div>
          {error && <p className="error">{error}</p>}
          <h3 className="sub-title">{s.shotPreview}</h3>
          {base64 ? (
            <img className="shot-preview" src={`data:image/png;base64,${base64}`} alt={s.shotPreview} />
          ) : (
            <p className="muted">{s.shotIdle}</p>
          )}
        </>
      )}
    </section>
  )
}
