import { useCallback, useRef, useState } from 'react'
import type { Locale } from './i18n'
import {
  appAction,
  installApk,
  installApkUploadCancel,
  installApkUploadChunk,
  installApkUploadFinish,
  installApkUploadStart,
  listPackages,
  permissionAction,
  revokeAllPermissions,
  type CommandResult,
} from './orcaApi'

const MAX_APK_BYTES = 512 * 1024 * 1024
const CHUNK_BYTES = 45 * 1024

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
  appsBrowse: string
  appsDropHint: string
  appsFileTooLarge: string
  appsUploading: string
  appsPermInput: string
  appsRevoke: string
  appsGrant: string
  appsPermRequired: string
  appsRevokeAll: string
  appsRevokeAllResult: string
  appsRevokeAllNone: string
  appsRevokeAllRevokedList: string
  appsRevokeAllFailedList: string
}

interface Props {
  locale: Locale
  s: Strings
  selectedSerial: string
  deviceOnline: boolean
}

function chunkToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + 0x8000)))
  }
  return btoa(binary)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function AppsTab({ s, selectedSerial, deviceOnline }: Props) {
  const [packages, setPackages] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [selectedPkg, setSelectedPkg] = useState('')
  const [apkPath, setApkPath] = useState('')
  const [selectedApk, setSelectedApk] = useState<File | null>(null)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [permission, setPermission] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // 撤销/授予单个权限：走独立的 permissionAction 请求，permission 必填。
  const permAct = useCallback(async (action: 'revoke' | 'grant') => {
    if (!selectedSerial || !selectedPkg || busy) return
    if (!permission.trim()) {
      setError(s.appsPermRequired)
      return
    }
    setBusy(true); setError(''); setResult('')
    try {
      const r = await permissionAction(selectedSerial, action, selectedPkg, permission.trim())
      if (r.ok) { setResult(r.value.output || `${action} ok`) }
      else setError(r.message)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }, [selectedSerial, selectedPkg, busy, permission, s.appsPermRequired])

  // 撤销该应用全部已授予的运行时权限
  const revokeAll = useCallback(async () => {
    if (!selectedSerial || !selectedPkg || busy) return
    setBusy(true); setError(''); setResult('')
    try {
      const r = await revokeAllPermissions(selectedSerial, selectedPkg)
      if (r.ok) {
        const { revoked, failed } = r.value
        if (revoked.length === 0 && failed.length === 0) {
          setResult(s.appsRevokeAllNone)
        } else {
          // 汇总数量，并列出已撤销与失败的具体权限便于核对
          const summary = s.appsRevokeAllResult
            .replace('{revoked}', String(revoked.length))
            .replace('{failed}', String(failed.length))
          const parts: string[] = [summary]
          if (revoked.length) {
            parts.push(`【${s.appsRevokeAllRevokedList}】\n${revoked.join('\n')}`)
          }
          if (failed.length) {
            parts.push(`【${s.appsRevokeAllFailedList}】\n${failed.join('\n')}`)
          }
          setResult(parts.join('\n\n'))
        }
      } else setError(r.message)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }, [selectedSerial, selectedPkg, busy, s.appsRevokeAllResult, s.appsRevokeAllNone, s.appsRevokeAllRevokedList, s.appsRevokeAllFailedList])

  const acceptApk = useCallback((file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_APK_BYTES) {
      setError(s.appsFileTooLarge)
      return
    }
    setError('')
    setResult('')
    setSelectedApk(file)
    setApkPath(file.name)
  }, [s.appsFileTooLarge])

  const install = useCallback(async () => {
    if (!selectedSerial || busy) return
    if (!selectedApk && !apkPath.trim()) return
    setBusy(true); setUploading(false); setError(''); setResult('')
    let uploadId: string | undefined
    try {
      if (selectedApk) {
        setUploading(true)
        const started = await installApkUploadStart(selectedApk.name)
        uploadId = started.uploadId
        const buffer = new Uint8Array(await selectedApk.arrayBuffer())
        let sentInWindow = 1
        let windowStart = Date.now()
        for (let offset = 0; offset < buffer.length; offset += CHUNK_BYTES) {
          const now = Date.now()
          if (now - windowStart >= 10_000) { windowStart = now; sentInWindow = 0 }
          if (sentInWindow >= 100) {
            await sleep(windowStart + 10_000 - now + 250)
            windowStart = Date.now(); sentInWindow = 0
          }
          await installApkUploadChunk(uploadId, chunkToBase64(buffer.subarray(offset, offset + CHUNK_BYTES)))
          sentInWindow += 1
        }
        const r = await installApkUploadFinish(uploadId, selectedSerial)
        uploadId = undefined
        if (r.ok) { setResult(r.value.output || 'install ok'); void refresh() }
        else setError(r.message)
      } else {
        const r = await installApk(selectedSerial, apkPath)
        if (r.ok) { setResult(r.value.output || 'install ok'); void refresh() }
        else setError(r.message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (uploadId) await installApkUploadCancel(uploadId).catch(() => undefined)
      setUploading(false)
      setBusy(false)
    }
  }, [selectedSerial, selectedApk, apkPath, busy, refresh])

  const visible = packages.filter((p) => !filter.trim() || p.toLowerCase().includes(filter.trim().toLowerCase()))

  if (!selectedSerial || !deviceOnline) return <section><h2>{s.tabApps}</h2><p className="muted">{s.appsNoDevice}</p></section>

  return (
    <section>
      <h2>{s.tabApps}</h2>
      <div
        className={`apk-dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          acceptApk(e.dataTransfer.files?.[0])
        }}
      >
        <label className="ask-field install-field">
          <span>{s.appsInstall}</span>
          <input
            value={apkPath}
            onChange={(e) => { setSelectedApk(null); setApkPath(e.target.value) }}
            placeholder={s.appsInstallHint}
          />
        </label>
        <div className="apk-picker-row">
          <input
            ref={fileInputRef}
            className="apk-file-input"
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={(e) => acceptApk(e.target.files?.[0])}
          />
          <button className="small" onClick={() => fileInputRef.current?.click()} disabled={busy}>{s.appsBrowse}</button>
          <span className="muted">{s.appsDropHint}</span>
        </div>
      </div>
      <button onClick={() => void install()} disabled={busy || (!selectedApk && !apkPath.trim())}>{uploading ? s.appsUploading : s.appsInstall}</button>
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
      {selectedPkg && (
        <div className="perm-row">
          <input
            className="filter"
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
            placeholder={s.appsPermInput}
          />
          <div className="logcat-controls">
            <button onClick={() => void permAct('revoke')} disabled={busy || !permission.trim()}>{s.appsRevoke}</button>
            <button onClick={() => void permAct('grant')} disabled={busy || !permission.trim()}>{s.appsGrant}</button>
            <button onClick={() => void revokeAll()} disabled={busy}>{s.appsRevokeAll}</button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {result && <pre className="output-block">{s.appsResult}: {result}</pre>}
    </section>
  )
}
