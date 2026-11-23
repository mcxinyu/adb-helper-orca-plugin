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
