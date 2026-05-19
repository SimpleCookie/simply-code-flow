import hljs from 'highlight.js'
import type { NodeKind } from '@scf/shared'

export interface DetectedBranch {
  condition: string
  lineRange: [number, number]
  hasElse: boolean
  thenCallees: string[]
  elseCallees: string[]
}

export interface DetectionResult {
  language: string
  confidence: number
  suggestedLabel: string
  suggestedKind: NodeKind
  detectedCallees: string[]
  detectedBranches: DetectedBranch[]
  isAsync: boolean
  hasSQL: boolean
  hasHTTP: boolean
  hasEvents: boolean
  filePath?: string
  lineRange?: [number, number]
}

const BUILTIN_NAMES = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'try', 'function', 'class', 'return', 'throw',
  'typeof', 'instanceof', 'new', 'delete', 'void', 'console', 'Object', 'Array', 'String',
  'Number', 'Boolean', 'JSON', 'Math', 'Date', 'Promise', 'Error', 'Map', 'Set', 'WeakMap',
  'WeakSet', 'Symbol', 'BigInt', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame',
  'require', 'import', 'export', 'super', 'this', 'null', 'undefined', 'true', 'false',
  'async', 'await', 'yield', 'get', 'set', 'of', 'in', 'from', 'as', 'let', 'const', 'var',
  'describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach', 'jest', 'vi',
  'print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'tuple', 'bool',
  'System', 'List', 'Map', 'HashMap', 'ArrayList', 'StringBuilder',
  'log', 'warn', 'error', 'info', 'debug', 'assert',
])

const NAME_PATTERNS = [
  // JS/TS function declaration
  /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
  // arrow / const fn
  /(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[:=][^=]/,
  // class
  /class\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
  // Python def
  /def\s+([A-Za-z_][A-Za-z0-9_]*)/,
  // Java/C#/Go method: "public/private/protected ReturnType Name("
  /(?:public|private|protected|internal|static|virtual|override|async|\s)+\s+\w+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
  // Go func
  /func\s+(?:\([^)]*\)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
]

function extractName(code: string): string {
  for (const pattern of NAME_PATTERNS) {
    const m = code.match(pattern)
    if (m?.[1] && m[1].length > 1) return m[1]
  }
  return ''
}

function detectKind(code: string): NodeKind {
  if (/^\s*class\s+/m.test(code)) return 'class'
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|DROP TABLE|ALTER TABLE)\b/i.test(code)) return 'sql'
  if (
    /@(Get|Post|Put|Delete|Patch|RestController|RequestMapping|Controller|Route)\b/.test(code) ||
    /\bapp\.(get|post|put|delete|patch)\s*\(/.test(code) ||
    /\brouter\.(get|post|put|delete|patch)\s*\(/.test(code) ||
    /\[Http(Get|Post|Put|Delete|Patch)\]/.test(code) ||
    /@app\.route/.test(code)
  )
    return 'endpoint'
  if (/\b(emit|dispatch|publish|trigger|broadcast)\s*\(/.test(code)) return 'event'
  if (
    /\b(fetch|axios|HttpClient|WebClient|RestTemplate|http\.get|http\.post|XMLHttpRequest|requests\.(get|post))\b/.test(
      code,
    )
  )
    return 'external-api'
  if (/\b(useState|useEffect|useRef|JSX|render\s*\(|<[A-Z][A-Za-z]+)/.test(code)) return 'ui'
  if (/\b(@Scheduled|@Cron|setInterval|cron\.schedule|BackgroundJob|IHostedService)\b/.test(code))
    return 'job'
  if (/\b(config|Config|appsettings|settings|IOptions)\b/.test(code)) return 'config'
  return 'function'
}

function extractCallees(code: string): string[] {
  const calleeRe = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g
  const found = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = calleeRe.exec(code)) !== null) {
    const name = m[1]
    if (!BUILTIN_NAMES.has(name) && name.length > 2) {
      found.add(name)
    }
  }
  return Array.from(found).slice(0, 25)
}

/** Bracket-match from openIdx to find the closing brace. */
function findClose(code: string, openIdx: number): number {
  let depth = 0
  for (let i = openIdx; i < code.length; i++) {
    if (code[i] === '{') depth++
    else if (code[i] === '}') { depth--; if (depth === 0) return i }
  }
  return code.length - 1
}

function detectBranches(code: string): DetectedBranch[] {
  const results: DetectedBranch[] = []
  // Match: if (condition) { — single-line conditions only (covers most real code)
  const re = /\bif\s*\(([^)]+)\)\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    const condition = m[1].trim()
    const thenOpen = code.indexOf('{', m.index)
    if (thenOpen === -1) continue
    const thenClose = findClose(code, thenOpen)
    const thenBody = code.slice(thenOpen + 1, thenClose)
    const startLine = code.slice(0, m.index).split('\n').length
    let endLine = code.slice(0, thenClose).split('\n').length
    let hasElse = false
    let elseBody = ''
    // Check for else / else if immediately after
    const afterThen = code.slice(thenClose + 1).trimStart()
    if (afterThen.startsWith('else')) {
      hasElse = true
      const elseOpen = code.indexOf('{', thenClose + 1)
      if (elseOpen !== -1) {
        const elseClose = findClose(code, elseOpen)
        elseBody = code.slice(elseOpen + 1, elseClose)
        endLine = code.slice(0, elseClose).split('\n').length
      }
    }
    results.push({
      condition,
      lineRange: [startLine, endLine],
      hasElse,
      thenCallees: extractCallees(thenBody),
      elseCallees: extractCallees(elseBody),
    })
  }
  return results.slice(0, 10) // cap
}

function parseHeaderComment(code: string): { filePath?: string; lineRange?: [number, number] } {
  // Match: // path/to/file.ts:10-50  or  # path/to/file.py:10-50
  const m = code.match(/^(?:\/\/|#)\s*([\w/\\.\-:]+):(\d+)(?:-(\d+))?/m)
  if (!m) return {}
  return {
    filePath: m[1],
    lineRange: m[3] ? [parseInt(m[2], 10), parseInt(m[3], 10)] : [parseInt(m[2], 10), parseInt(m[2], 10)],
  }
}

export function detectCode(code: string): DetectionResult {
  const trimmed = code.trim()
  if (!trimmed) {
    return {
      language: 'plaintext',
      confidence: 0,
      suggestedLabel: '',
      suggestedKind: 'unknown',
      detectedCallees: [],
      detectedBranches: [],
      isAsync: false,
      hasSQL: false,
      hasHTTP: false,
      hasEvents: false,
    }
  }

  let language = 'plaintext'
  let confidence = 0
  try {
    const result = hljs.highlightAuto(trimmed)
    language = result.language ?? 'plaintext'
    confidence = result.relevance ?? 0
  } catch {
    // ignore
  }

  const header = parseHeaderComment(trimmed)

  return {
    language,
    confidence,
    suggestedLabel: extractName(trimmed),
    suggestedKind: detectKind(trimmed),
    detectedCallees: extractCallees(trimmed),
    detectedBranches: detectBranches(trimmed),
    isAsync: /\basync\b|\bawait\b/.test(trimmed),
    hasSQL: /\b(SELECT|INSERT|UPDATE|DELETE)\b/i.test(trimmed),
    hasHTTP: /\b(fetch|axios|http\.|HttpClient|WebClient|requests\.)\b/.test(trimmed),
    hasEvents: /\b(emit|dispatch|publish|addEventListener)\s*\(/.test(trimmed),
    ...header,
  }
}

export const SUPPORTED_LANGUAGES = [
  'plaintext', 'typescript', 'javascript', 'python', 'java', 'csharp',
  'go', 'rust', 'php', 'ruby', 'kotlin', 'swift', 'cpp', 'c', 'sql',
  'xml', 'json', 'yaml', 'bash', 'html', 'css',
]
