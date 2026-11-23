export type LogLevel = 'V' | 'D' | 'I' | 'W' | 'E' | 'F' | 'unknown'
export type FieldKind = 'time' | 'pid' | 'tid' | 'level' | 'tag' | 'message'

export interface StyledSegment {
  text: string
  kind?: FieldKind
  level?: LogLevel
}

export interface ParsedLogLine {
  level: LogLevel
  segments: StyledSegment[]
}

// 标准 logcat threadtime：MM-DD HH:MM:SS.mmm  PID  TID  L  TAG: message
const THREAD_TIME = /^(\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})(\s+)(\d+)(\s+)(\d+)(\s+)([VDIWEF])(\s+)([^:]+)(:.*)$/
// 简洁格式：L/TAG: message
const BRIEF = /^([VDIWEF])(\/)([^:]+)(:.*)$/

function seg(text: string, kind?: FieldKind, level?: LogLevel): StyledSegment {
  return { text, ...(kind ? { kind } : {}), ...(level ? { level } : {}) }
}

export function parseLogLine(line: string): ParsedLogLine {
  const m = THREAD_TIME.exec(line)
  if (m) {
    const level = m[7] as LogLevel
    return {
      level,
      segments: [
        seg(m[1], 'time'),
        seg(m[2]),
        seg(m[3], 'pid'),
        seg(m[4]),
        seg(m[5], 'tid'),
        seg(m[6]),
        seg(m[7], 'level', level),
        seg(m[8]),
        seg(m[9], 'tag'),
        seg(m[10], 'message'),
      ],
    }
  }
  const b = BRIEF.exec(line)
  if (b) {
    const level = b[1] as LogLevel
    return {
      level,
      segments: [
        seg(b[1], 'level', level),
        seg(b[2]),
        seg(b[3], 'tag'),
        seg(b[4], 'message'),
      ],
    }
  }
  return { level: 'unknown', segments: [seg(line)] }
}
