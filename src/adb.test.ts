import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAdbCommand, buildClearAppDataArgs, buildConnectArgs, buildDisconnectArgs, buildDumpPackageArgs, buildGrantPermissionArgs, buildInstallApkArgs, buildListPackagesArgs, buildPullArgs, buildRevokePermissionArgs, buildScreenrecordArgs, buildScreenshotArgs, buildStartAppArgs, buildStopAppArgs, buildUninstallArgs, getPaletteCommand, isValidConnectTarget, isValidPackageName, PALETTE_COMMANDS, parseDevicesOutput, parseGrantedRuntimePermissions } from './adb'

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

test('buildScreenshotArgs 构造 exec-out screencap 命令', () => {
  assert.deepEqual(buildScreenshotArgs('emulator-5554'), ['-s', 'emulator-5554', 'exec-out', 'screencap', '-p'])
})

test('buildScreenrecordArgs 含时限与设备路径', () => {
  assert.deepEqual(buildScreenrecordArgs('dev1', '/sdcard/a.mp4', 45), ['-s', 'dev1', 'shell', 'screenrecord', '--time-limit', '45', '/sdcard/a.mp4'])
})

test('buildPullArgs 含本地路径', () => {
  assert.deepEqual(buildPullArgs('dev1', '/sdcard/a.mp4', 'C:\\tmp\\a.mp4'), ['-s', 'dev1', 'pull', '/sdcard/a.mp4', 'C:\\tmp\\a.mp4'])
})

test('无线连接目标校验与命令', () => {
  assert.equal(isValidConnectTarget('192.168.1.100:5555'), true)
  assert.equal(isValidConnectTarget('999.1.1.1:5555'), false)
  assert.equal(isValidConnectTarget('192.168.1.100'), false)
  assert.equal(isValidConnectTarget('192.168.1.100:70000'), false)
  assert.deepEqual(buildConnectArgs('192.168.1.100:5555'), ['connect', '192.168.1.100:5555'])
  assert.deepEqual(buildDisconnectArgs('192.168.1.100:5555'), ['disconnect', '192.168.1.100:5555'])
})
test('命令面板白名单', () => {
  assert.ok(PALETTE_COMMANDS.length >= 5)
  assert.equal(getPaletteCommand('battery')?.args('dev1')[0], '-s')
  assert.equal(getPaletteCommand('battery')?.args('dev1')[1], 'dev1')
  assert.equal(getPaletteCommand('unknown'), undefined)
})
test('应用管理命令构造与包名校验', () => {
  assert.deepEqual(buildListPackagesArgs('dev1'), ['-s', 'dev1', 'shell', 'pm', 'list', 'packages'])
  assert.deepEqual(buildStartAppArgs('dev1', 'com.x.app'), ['-s', 'dev1', 'shell', 'monkey', '-p', 'com.x.app', '-c', 'android.intent.category.LAUNCHER', '1'])
  assert.deepEqual(buildStopAppArgs('dev1', 'com.x.app'), ['-s', 'dev1', 'shell', 'am', 'force-stop', 'com.x.app'])
  assert.deepEqual(buildClearAppDataArgs('dev1', 'com.x.app'), ['-s', 'dev1', 'shell', 'pm', 'clear', 'com.x.app'])
  assert.deepEqual(buildInstallApkArgs('dev1', 'C:\\my apps\\a.apk'), ['-s', 'dev1', 'install', '-r', 'C:\\my apps\\a.apk'])
  assert.deepEqual(buildUninstallArgs('dev1', 'com.x.app'), ['-s', 'dev1', 'uninstall', 'com.x.app'])
  assert.deepEqual(buildRevokePermissionArgs('dev1', 'com.x.app', 'android.permission.CAMERA'), ['-s', 'dev1', 'shell', 'pm', 'revoke', 'com.x.app', 'android.permission.CAMERA'])
  assert.deepEqual(buildGrantPermissionArgs('dev1', 'com.x.app', 'android.permission.CAMERA'), ['-s', 'dev1', 'shell', 'pm', 'grant', 'com.x.app', 'android.permission.CAMERA'])
  assert.deepEqual(buildDumpPackageArgs('dev1', 'com.x.app'), ['-s', 'dev1', 'shell', 'dumpsys', 'package', 'com.x.app'])
  assert.equal(isValidPackageName('com.x.app'), true)
  assert.equal(isValidPackageName('bad;cmd'), false)
  assert.equal(isValidPackageName(''), false)
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

test('parseGrantedRuntimePermissions 只解析 runtime 段已授予的权限', () => {
  const raw = [
    'Package [com.x.app] (1234):',
    '  requested permissions:',
    '    android.permission.INTERNET',
    '  install permissions:',
    '    android.permission.INTERNET: granted=true',
    '    android.permission.SYSTEM_ALERT_WINDOW: granted=false',
    '  runtime permissions:',
    '    android.permission.CAMERA: granted=true, flags=[ USER_SENSITIVE_WHEN_GRANTED]',
    '    android.permission.ACCESS_FINE_LOCATION: granted=true, flags=[ USER_SENSITIVE_WHEN_GRANTED]',
    '    android.permission.RECORD_AUDIO: granted=false, flags=[ USER_SENSITIVE_WHEN_GRANTED]',
    '    android.permission.READ_EXTERNAL_STORAGE: granted=false',
    '  enabledComponents:',
    '    com.x.app.MainActivity',
  ].join('\n')
  // 只取 runtime 段里 granted=true 的危险权限；install 段（INTERNET）与未授予的不算
  assert.deepEqual(parseGrantedRuntimePermissions(raw), [
    'android.permission.CAMERA',
    'android.permission.ACCESS_FINE_LOCATION',
  ])
})

test('parseGrantedRuntimePermissions 兼容旧式括号格式', () => {
  const raw = [
    '  runtime permissions:',
    '    android.permission.CAMERA (granted=true)',
    '    android.permission.RECORD_AUDIO (granted=false)',
  ].join('\n')
  assert.deepEqual(parseGrantedRuntimePermissions(raw), ['android.permission.CAMERA'])
})

test('parseGrantedRuntimePermissions 没有 runtime 段返回空数组', () => {
  const raw = [
    '  install permissions:',
    '    android.permission.INTERNET: granted=true',
  ].join('\n')
  // install 段的权限撤不掉，即便 granted=true 也不返回
  assert.deepEqual(parseGrantedRuntimePermissions(raw), [])
})

test('parseGrantedRuntimePermissions 空输出返回空数组', () => {
  assert.deepEqual(parseGrantedRuntimePermissions(''), [])
})
