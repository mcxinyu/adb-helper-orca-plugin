import { useCallback, useState } from 'react'
import type { Locale } from './i18n'
import { appAction, installApk, listPackages, type CommandResult } from './orcaApi'

interface Strings {
  tabApps: string
  appsNoDevice: string
  appsRefresh: string
  appsFilter: string
  appsInstall: string
  appsInstallHint: string
  appsStart: string
  appsStop: string
  appsClear: string
  appsUninstall: string
  appsResult: string
  appsBusy: string
}

interface Props {
  locale: Locale
  s: Strings
  selectedSerial: string
  deviceOnline: boolean
}

export default function AppsTab({ s, selectedSerial, deviceOnline }: Props) {
  const [packages, setPackages] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [selectedPkg, setSelectedPkg] = useState('')
  const [apkPath, setApkPath] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!selectedSerial || !deviceOnline) return
    setBusy(true); setError('')
    try {
      const r = await listPackages(selectedSerial)
      if (r.ok) setPackages(r.value.packages)
      else setError(r.message)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }, [selectedSerial, deviceOnline])

  const act = useCallback(async (action: 'start' | 'stop' | 'clear' | 'uninstall') => {
    if (!selectedSerial || !selectedPkg || busy) return
    setBusy(true); setError(''); setResult('')
    try {
      const r: CommandResult<{ output: string }> = await appAction(selectedSerial, action, selectedPkg)
      if (r.ok) { setResult(r.value.output || `${action} ok`); if (action === 'uninstall') void refresh() }
      else setError(r.message)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }, [selectedSerial, selectedPkg, busy, refresh])

  const install = useCallback(async () => {
    if (!selectedSerial || !apkPath.trim() || busy) return
    setBusy(true); setError(''); setResult('')
    try {
      const r = await installApk(selectedSerial, apkPath)
      if (r.ok) { setResult(r.value.output || 'install ok'); void refresh() }
      else setError(r.message)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }, [selectedSerial, apkPath, busy, refresh])

  const visible = packages.filter((p) => !filter.trim() || p.toLowerCase().includes(filter.trim().toLowerCase()))

  if (!selectedSerial || !deviceOnline) return <section><h2>{s.tabApps}</h2><p className="muted">{s.appsNoDevice}</p></section>

  return (
    <section>
      <h2>{s.tabApps}</h2>
      <div className="logcat-controls">
        <button onClick={() => void refresh()} disabled={busy}>{busy ? s.appsBusy : s.appsRefresh}</button>
      </div>
      <input className="filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={s.appsFilter} />
      <div className="pkg-list">
        {visible.map((pkg) => (
          <button key={pkg} className={`pkg-item ${selectedPkg === pkg ? 'selected' : ''}`} onClick={() => setSelectedPkg(pkg)}>
            {pkg}
          </button>
        ))}
      </div>
      {selectedPkg && (
        <div className="logcat-controls">
          <button onClick={() => void act('start')} disabled={busy}>{s.appsStart}</button>
          <button onClick={() => void act('stop')} disabled={busy}>{s.appsStop}</button>
          <button onClick={() => void act('clear')} disabled={busy}>{s.appsClear}</button>
          <button onClick={() => void act('uninstall')} disabled={busy}>{s.appsUninstall}</button>
        </div>
      )}
      <label className="ask-field install-field">
        <span>{s.appsInstall}</span>
        <input value={apkPath} onChange={(e) => setApkPath(e.target.value)} placeholder={s.appsInstallHint} />
      </label>
      <button onClick={() => void install()} disabled={busy || !apkPath.trim()}>{s.appsInstall}</button>
      {error && <p className="error">{error}</p>}
      {result && <pre className="output-block">{s.appsResult}: {result}</pre>}
    </section>
  )
}
