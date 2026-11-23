import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAdbCommand, parseDevicesOutput } from './adb'

test('buildAdbCommand 保留含空格路径为单个命令', () => {
  const result = buildAdbCommand('C:\\Program Files\\Android\\adb.exe', ['devices', '-l'])
  assert.equal(result.command, 'C:\\Program Files\\Android\\adb.exe')
  assert.deepEqual(result.args, ['devices', '-l'])
})

test('buildAdbCommand 支持 POSIX 路径', () => {
  const result = buildAdbCommand('/opt/android sdk/adb', ['shell', 'getprop', 'ro.product.model'])
  assert.equal(result.command, '/opt/android sdk/adb')
  assert.deepEqual(result.args, ['shell', 'getprop', 'ro.product.model'])
})

test('parseDevicesOutput 解析在线设备与型号', () => {
  const raw = [
    'List of devices attached',
    'emulator-5554\tdevice product:sdk_gphone model:Pixel_7 device:sdk',
    '',
  ].join('\n')
  assert.deepEqual(parseDevicesOutput(raw), [
    { serial: 'emulator-5554', state: 'device', model: 'Pixel_7' },
  ])
})

test('parseDevicesOutput 解析离线与未授权状态', () => {
  const raw = [
    'List of devices attached',
    'abc123 offline',
    'def456 unauthorized',
  ].join('\n')
  assert.deepEqual(parseDevicesOutput(raw), [
    { serial: 'abc123', state: 'offline' },
    { serial: 'def456', state: 'unauthorized' },
  ])
})

test('parseDevicesOutput 空输出返回空数组', () => {
  assert.deepEqual(parseDevicesOutput('List of devices attached\n\n'), [])
})

test('parseDevicesOutput 跳过畸形行与 daemon 提示', () => {
  const raw = [
    '* daemon started successfully *',
    'List of devices attached',
    '   ',
    'ghi789 weirdstate',
  ].join('\n')
  assert.deepEqual(parseDevicesOutput(raw), [
    { serial: 'ghi789', state: 'unknown' },
  ])
})
