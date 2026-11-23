// 混合设备来源：优先通过 child_process 执行 adb；失败时回退到 Orca 终端。

import type { OrcaWorkerApi } from 'orca/worker'
import type { CommandResult, DeviceInfo } from './protocol'
import { listDevicesViaAdb, parseDevicesOutput } from './adb'

export interface DeviceDiscoveryResult {
  devices: DeviceInfo[]
  source: 'primary' | 'fallback'
  error?: string
}

/** 从 workspace.list 中挑选一个可承载终端的 workspace id。 */
async function pickWorkspaceId(orca: OrcaWorkerApi): Promise<string | undefined> {
  const context = await orca.host.call('workspace.readContext', undefined)
  if (context?.workspaceId) return context.workspaceId
  const { workspaces } = await orca.host.call('workspace.list', undefined)
  return workspaces[0]?.id
}

/** 通过 Orca 终端执行 adb devices -l 作为回退路径。 */
async function listDevicesViaTerminal(
  orca: OrcaWorkerApi,
  adbPath: string,
): Promise<DeviceInfo[]> {
  const workspaceId = await pickWorkspaceId(orca)
  if (!workspaceId) throw new Error('no_workspace')
  const command = `${quoteForShell(adbPath)} devices -l`
  const { terminalId } = await orca.host.call('terminal.create', {
    workspaceId,
    title: 'ADB Helper devices',
    command,
  })
  // 给终端一点时间产出输出。
  await new Promise((resolve) => setTimeout(resolve, 1200))
  const { lines } = await orca.host.call('terminal.read', { terminalId, maxLines: 200 })
  await orca.host.call('terminal.close', { terminalId })
  return parseDevicesOutput(lines.join('\n'))
}

function quoteForShell(path: string): string {
  if (!/\s/.test(path)) return path
  return `"${path.replace(/"/g, '\\"')}"`
}

/** 主路径失败时回退到终端；两者都失败时返回带错误的结果。 */
export async function discoverDevices(
  orca: OrcaWorkerApi,
  adbPath: string,
): Promise<DeviceDiscoveryResult> {
  try {
    const devices = await listDevicesViaAdb(adbPath)
    return { devices, source: 'primary' }
  } catch (primaryError) {
    const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError)
    try {
      const devices = await listDevicesViaTerminal(orca, adbPath)
      return { devices, source: 'fallback' }
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      return {
        devices: [],
        source: 'fallback',
        error: `主路径失败: ${primaryMessage}; 回退失败: ${fallbackMessage}`,
      }
    }
  }
}

export function toCommandResult(result: DeviceDiscoveryResult): CommandResult<{
  devices: DeviceInfo[]
  source: 'primary' | 'fallback'
}> {
  if (result.error) {
    return { ok: false, code: 'adb_unavailable', message: result.error }
  }
  return {
    ok: true,
    value: { devices: result.devices, source: result.source },
  }
}
