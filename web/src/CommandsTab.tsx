import { useCallback, useState } from 'react'
import type { Locale } from './i18n'
import { runPaletteCommand, type CommandResult } from './orcaApi'

interface Strings {
  tabCommands: string
  cmdNoDevice: string
  cmdDeviceInfo: string
  cmdModel: string
  cmdBattery: string
  cmdPackages: string
  cmdIpAddress: string
  cmdMemInfo: string
  cmdResult: string
  cmdBusy: string
}

interface Props {
  locale: Locale
  s: Strings
  selectedSerial: string
  deviceOnline: boolean
}

const LABEL_KEYS: Record<string, keyof Strings> = {
  deviceInfo: 'cmdDeviceInfo', model: 'cmdModel', battery: 'cmdBattery',
  packages: 'cmdPackages', ipAddress: 'cmdIpAddress', memInfo: 'cmdMemInfo',
}
const COMMAND_IDS = Object.keys(LABEL_KEYS)

export default function CommandsTab({ s, selectedSerial, deviceOnline }: Props) {
  const [output, setOutput] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = useCallback(async (id: string) => {
    if (!selectedSerial || busy) return
    setBusy(true); setError(''); setOutput('')
    setLabel(String(s[LABEL_KEYS[id]] ?? id))
    try {
      const r: CommandResult<{ output: string }> = await runPaletteCommand(selectedSerial, id)
      if (r.ok) setOutput(r.value.output || '(empty)')
      else setError(r.message)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }, [selectedSerial, busy, s])

  if (!selectedSerial || !deviceOnline) return <section><h2>{s.tabCommands}</h2><p className="muted">{s.cmdNoDevice}</p></section>

  return (
    <section>
      <h2>{s.tabCommands}</h2>
      <div className="cmd-grid">
        {COMMAND_IDS.map((id) => (
          <button key={id} onClick={() => void run(id)} disabled={busy}>{String(s[LABEL_KEYS[id]] ?? id)}</button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {output && <pre className="output-block">{label} ({busy ? s.cmdBusy : s.cmdResult}):\n{output}</pre>}
    </section>
  )
}
