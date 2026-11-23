import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseLogLine } from './logHighlight'

test('解析标准 threadtime 格式且拼接无损', () => {
  const line = '11-23 14:29:21.806  1598  2796 W QgdalLocator: getInterlacedFlag = 0'
  const p = parseLogLine(line)
  assert.equal(p.level, 'W')
  assert.equal(p.segments.map((s) => s.text).join(''), line)
  const kinds = p.segments.filter((s) => s.kind).map((s) => s.kind)
  assert.deepEqual(kinds, ['time', 'pid', 'tid', 'level', 'tag', 'message'])
})

test('解析 E 级别', () => {
  const line = '11-23 12:00:00.123 1234 1234 E AndroidRuntime: FATAL EXCEPTION'
  const p = parseLogLine(line)
  assert.equal(p.level, 'E')
  assert.equal(p.segments.map((s) => s.text).join(''), line)
  assert.equal(p.segments.find((s) => s.kind === 'tag')?.text, 'AndroidRuntime')
})

test('解析 brief 格式', () => {
  const line = 'D/MyTag: hello world'
  const p = parseLogLine(line)
  assert.equal(p.level, 'D')
  assert.equal(p.segments.map((s) => s.text).join(''), line)
})

test('非标准行降级为普通文本', () => {
  const line = 'some raw output without logcat format'
  const p = parseLogLine(line)
  assert.equal(p.level, 'unknown')
  assert.deepEqual(p.segments, [{ text: line }])
})
