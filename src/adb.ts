// ADB 命令适配器：构造命令、执行、解析设备输出。
// 使用 node:child_process 直接调用 adb 客户端（自动连接本地 adb server）。

import { spawn } from 'node:child_process'
import type { CommandResult, DeviceDetail, DeviceInfo, DeviceState } from './protocol'

/** 将 adb 路径和参数构造为 spawn 可用的 { command, args }，兼容含空格的路径。 */
export function buildAdbCommand(adbPath: string, args: string[]): { command: string; args: string[] } {
  return { command: adbPath, args }
}

/** 执行一次 adb 命令，返回合并的 stdout；失败时抛出可识别错误。 */
export async function runAdb(
  adbPath: string,
  args: string[],
  timeoutMs = 10_000,
): Promise<string> {
  const { command, args: spawnArgs } = buildAdbCommand(adbPath, args)
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, spawnArgs, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`adb command timed out: ${args.join(' ')}`))
    }, timeoutMs)
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code: number | null) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr.trim() || `adb exited with code ${code}`))
      }
    })
  })
}

/** 执行一次 adb 命令并返回原始 Buffer（用于 screencap 等二进制输出）。 */
export async function runAdbBuffer(
  adbPath: string,
  args: string[],
  timeoutMs = 20_000,
): Promise<Buffer> {
  const { command, args: spawnArgs } = buildAdbCommand(adbPath, args)
  return await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(command, spawnArgs, { windowsHide: true })
    const chunks: Buffer[] = []
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`adb command timed out: ${args.join(' ')}`))
    }, timeoutMs)
    child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('error', (error) => { clearTimeout(timer); reject(error) })
    child.on('close', (code: number | null) => {
      clearTimeout(timer)
      if (code === 0) resolve(Buffer.concat(chunks))
      else reject(new Error(stderr.trim() || `adb exited with code ${code}`))
    })
  })
}

/** 构造截图命令参数。 */
export function buildScreenshotArgs(serial: string): string[] {
  return ['-s', serial, 'exec-out', 'screencap', '-p']
}

/** 构造录屏命令参数（写到设备上的临时路径）。 */
export function buildScreenrecordArgs(serial: string, devicePath: string, maxSeconds = 30): string[] {
  return ['-s', serial, 'shell', 'screenrecord', '--time-limit', String(maxSeconds), devicePath]
}

/** 构造从设备拉取文件到本地路径的命令参数。 */
export function buildPullArgs(serial: string, devicePath: string, localPath: string): string[] {
  return ['-s', serial, 'pull', devicePath, localPath]
}

/** 应用管理命令构造。 */
export function buildListPackagesArgs(serial: string): string[] {
  return ['-s', serial, 'shell', 'pm', 'list', 'packages']
}
export function buildStartAppArgs(serial: string, pkg: string): string[] {
  return ['-s', serial, 'shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1']
}
export function buildStopAppArgs(serial: string, pkg: string): string[] {
  return ['-s', serial, 'shell', 'am', 'force-stop', pkg]
}
export function buildClearAppDataArgs(serial: string, pkg: string): string[] {
  return ['-s', serial, 'shell', 'pm', 'clear', pkg]
}
export function buildInstallApkArgs(serial: string, apkPath: string): string[] {
  return ['-s', serial, 'install', '-r', apkPath]
}
export function buildUninstallArgs(serial: string, pkg: string): string[] {
  return ['-s', serial, 'uninstall', pkg]
}
/** 校验包名：仅允许字母数字、点、下划线。 */
export function isValidPackageName(pkg: string): boolean {
  return /^[A-Za-z0-9._]+$/.test(pkg) && pkg.length > 0
}

/** 校验无线连接目标 IP:端口。 */
export function isValidConnectTarget(target: string): boolean {
  const m = /^(\d{1,3}\.){3}\d{1,3}:\d{1,5}$/.exec(target)
  if (!m) return false
  const [ip, port] = target.split(':')
  if (ip.split('.').some((part) => Number(part) > 255)) return false
  const n = Number(port)
  return n > 0 && n <= 65535
}

export function buildConnectArgs(target: string): string[] {
  return ['connect', target]
}
export function buildDisconnectArgs(target: string): string[] {
  return ['disconnect', target]
}

/** 命令面板：白名单命令定义（label key 与参数构造）。 */
export interface PaletteCommand {
  id: string
  args: (serial: string) => string[]
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
  { id: 'deviceInfo', args: (s) => ['-s', s, 'shell', 'getprop', 'ro.build.version.release'] },
  { id: 'model', args: (s) => ['-s', s, 'shell', 'getprop', 'ro.product.model'] },
  { id: 'battery', args: (s) => ['-s', s, 'shell', 'dumpsys', 'battery'] },
  { id: 'packages', args: (s) => ['-s', s, 'shell', 'pm', 'list', 'packages', '-3'] },
  { id: 'ipAddress', args: (s) => ['-s', s, 'shell', 'ip', 'addr', 'show', 'wlan0'] },
  { id: 'memInfo', args: (s) => ['-s', s, 'shell', 'cat', '/proc/meminfo'] },
]

export function getPaletteCommand(id: string): PaletteCommand | undefined {
  return PALETTE_COMMANDS.find((c) => c.id === id)
}

/** 将 adb devices -l 的原始输出解析为稳定的设备模型。 */
export function parseDevicesOutput(raw: string): DeviceInfo[] {
  const devices: DeviceInfo[] = []
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('List of devices')) continue
    if (/^\* daemon started successfully/i.test(trimmed)) continue
    const parts = trimmed.split(/\s+/)
    const serial = parts[0]
    if (!serial) continue
    const state = normalizeState(parts[1])
    const model = findField(parts, 'model:')
    devices.push({ serial, state, ...(model ? { model } : {}) })
  }
  return devices
}

function normalizeState(value: string | undefined): DeviceState {
  switch (value) {
    case 'device':
      return 'device'
    case 'offline':
      return 'offline'
    case 'unauthorized':
      return 'unauthorized'
    default:
      return 'unknown'
  }
}

function findField(parts: string[], prefix: string): string | undefined {
  for (const part of parts) {
    if (part.startsWith(prefix)) return part.slice(prefix.length)
  }
  return undefined
}

/** 列出设备，使用主路径（child_process 调 adb）。 */
export async function listDevicesViaAdb(adbPath: string): Promise<DeviceInfo[]> {
  const raw = await runAdb(adbPath, ['devices', '-l'])
  return parseDevicesOutput(raw)
}

/** 查询设备基本详情：型号、Android 版本、序列号。 */
export async function getDeviceDetailViaAdb(adbPath: string, serial: string): Promise<DeviceDetail> {
  const target = ['-s', serial]
  const [modelRaw, versionRaw] = await Promise.all([
    runAdb(adbPath, [...target, 'shell', 'getprop', 'ro.product.model']).catch(() => ''),
    runAdb(adbPath, [...target, 'shell', 'getprop', 'ro.build.version.release']).catch(() => ''),
  ])
  return {
    serial,
    model: modelRaw.trim() || 'unknown',
    androidVersion: versionRaw.trim() || 'unknown',
  }
}
