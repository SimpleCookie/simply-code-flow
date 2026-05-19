import type { NodeKind } from '@scf/shared'

export interface ExtractedFunction {
  label: string
  kind: NodeKind
  code: string
  lineRange: [number, number]
  isAsync: boolean
  isExported: boolean
  containerClass?: string
  callees: string[]
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Find the index of the closing brace/bracket that matches the one at `openIdx`. */
function findClosingBrace(code: string, openIdx: number, open = '{', close = '}'): number {
  let depth = 0
  for (let i = openIdx; i < code.length; i++) {
    if (code[i] === open) depth++
    else if (code[i] === close) {
      depth--
      if (depth === 0) return i
    }
  }
  return code.length - 1
}

/** Line number (1-based) of a character offset in code. */
function lineOf(code: string, offset: number): number {
  return code.slice(0, offset).split('\n').length
}

const BUILTIN_NAMES = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'try', 'function', 'class', 'return', 'throw',
  'typeof', 'instanceof', 'new', 'delete', 'void', 'console', 'Object', 'Array', 'String',
  'Number', 'Boolean', 'JSON', 'Math', 'Date', 'Promise', 'Error', 'Map', 'Set',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'require', 'import', 'export', 'super', 'this', 'null', 'undefined', 'true', 'false',
  'async', 'await', 'yield', 'get', 'set', 'of', 'in', 'from', 'as', 'let', 'const', 'var',
  'print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'tuple', 'bool',
  'System', 'List', 'HashMap', 'ArrayList', 'StringBuilder',
  'log', 'warn', 'error', 'info', 'debug', 'assert', 'self',
])

function extractCallees(body: string): string[] {
  const re = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g
  const found = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    if (!BUILTIN_NAMES.has(m[1]) && m[1].length > 2) found.add(m[1])
  }
  return Array.from(found).slice(0, 25)
}

function guessKind(code: string): NodeKind {
  if (/^\s*class\s+/m.test(code)) return 'class'
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/i.test(code)) return 'sql'
  if (/@(Get|Post|Put|Delete|Patch|RestController|RequestMapping|Controller|Route)\b/.test(code) ||
      /\bapp\.(get|post|put|delete|patch)\s*\(/.test(code) ||
      /\brouter\.(get|post|put|delete|patch)\s*\(/.test(code)) return 'endpoint'
  if (/\b(emit|dispatch|publish|trigger|broadcast)\s*\(/.test(code)) return 'event'
  if (/\b(useState|useEffect|render\s*\(|<[A-Z][A-Za-z]+)/.test(code)) return 'ui'
  return 'function'
}

// ─── language strategies ─────────────────────────────────────────────────────

/**
 * Extract JS/TS top-level function declarations, arrow functions assigned to
 * const/let/var, and class methods.
 */
function extractJsTs(code: string): ExtractedFunction[] {
  const results: ExtractedFunction[] = []

  // Patterns for the START of a function/method definition
  const patterns: RegExp[] = [
    // export default async function name(
    /(?:export\s+default\s+)?(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm,
    // const/let/var name = (async) (...) => {
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?\(?[^)]*\)?\s*=>\s*\{/gm,
    // class Name {
    /(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm,
  ]

  const seen = new Set<number>() // avoid duplicates by open-brace index

  for (const pattern of patterns) {
    let m: RegExpExecArray | null
    pattern.lastIndex = 0
    while ((m = pattern.exec(code)) !== null) {
      const label = m[1]
      // Find the opening brace
      const braceIdx = code.indexOf('{', m.index)
      if (braceIdx === -1 || seen.has(braceIdx)) continue
      seen.add(braceIdx)

      const closeIdx = findClosingBrace(code, braceIdx)
      const body = code.slice(m.index, closeIdx + 1)
      const startLine = lineOf(code, m.index)
      const endLine = lineOf(code, closeIdx)
      const isAsync = /\basync\b/.test(m[0])
      const isExported = /\bexport\b/.test(m[0])

      results.push({
        label,
        kind: guessKind(body),
        code: body,
        lineRange: [startLine, endLine],
        isAsync,
        isExported,
        callees: extractCallees(body),
      })
    }
  }

  // Sort by appearance order
  results.sort((a, b) => a.lineRange[0] - b.lineRange[0])
  return results
}

/**
 * Extract Python top-level def / async def / class definitions.
 * Uses indentation to slice bodies.
 */
function extractPython(code: string): ExtractedFunction[] {
  const results: ExtractedFunction[] = []
  const lines = code.split('\n')
  const topLevel = /^(async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(|^class\s+([A-Za-z_][A-Za-z0-9_]*)/

  let i = 0
  while (i < lines.length) {
    const m = lines[i].match(topLevel)
    if (m) {
      const label = m[3] ?? m[2]
      const isAsync = !!m[1]
      const startLine = i + 1
      // Collect body: all lines with indentation > 0 (or blank) following the header
      let j = i + 1
      while (j < lines.length && (lines[j].match(/^[ \t]/) || lines[j].trim() === '')) j++
      const endLine = j   // exclusive
      const body = lines.slice(i, endLine).join('\n')
      results.push({
        label,
        kind: m[3] ? 'class' : 'function',
        code: body,
        lineRange: [startLine, endLine],
        isAsync,
        isExported: false,
        callees: extractCallees(body),
      })
      i = j
    } else {
      i++
    }
  }
  return results
}

/**
 * Extract Java / C# / Kotlin / Go method / function declarations.
 * Matches: (optional modifiers) ReturnType Name(... ) {
 */
function extractJvmStyle(code: string): ExtractedFunction[] {
  const results: ExtractedFunction[] = []

  // Java/C#/Kotlin
  const javaRe = /(?:(?:public|private|protected|internal|static|virtual|override|abstract|async|final|synchronized|sealed|partial)\s+)+\w[\w<>\[\],\s]*\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*(?:throws\s+\S+\s*)?\{/gm
  // Go
  const goRe = /func\s+(?:\([^)]*\)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*(?:[^{]*)?\{/gm

  const seen = new Set<number>()

  for (const re of [javaRe, goRe]) {
    let m: RegExpExecArray | null
    re.lastIndex = 0
    while ((m = re.exec(code)) !== null) {
      const label = m[1]
      const braceIdx = code.indexOf('{', m.index + m[0].length - 1)
      if (braceIdx === -1 || seen.has(braceIdx)) continue
      seen.add(braceIdx)

      const closeIdx = findClosingBrace(code, braceIdx)
      const body = code.slice(m.index, closeIdx + 1)
      const startLine = lineOf(code, m.index)
      const endLine = lineOf(code, closeIdx)

      results.push({
        label,
        kind: guessKind(body),
        code: body,
        lineRange: [startLine, endLine],
        isAsync: /\basync\b/.test(m[0]),
        isExported: /\bpublic\b/.test(m[0]),
        callees: extractCallees(body),
      })
    }
  }

  results.sort((a, b) => a.lineRange[0] - b.lineRange[0])
  return results
}

// ─── public API ──────────────────────────────────────────────────────────────

export function extractFunctions(code: string, language: string): ExtractedFunction[] {
  const trimmed = code.trim()
  if (!trimmed) return []

  let results: ExtractedFunction[] = []

  const lang = language.toLowerCase()
  if (lang === 'typescript' || lang === 'javascript' || lang === 'tsx' || lang === 'jsx') {
    results = extractJsTs(trimmed)
  } else if (lang === 'python') {
    results = extractPython(trimmed)
  } else if (lang === 'java' || lang === 'csharp' || lang === 'kotlin' || lang === 'go' || lang === 'cpp' || lang === 'c') {
    results = extractJvmStyle(trimmed)
  }

  // Fallback: treat entire paste as a single function
  if (results.length === 0) {
    return [{
      label: '',
      kind: guessKind(trimmed),
      code: trimmed,
      lineRange: [1, trimmed.split('\n').length],
      isAsync: /\basync\b|\bawait\b/.test(trimmed),
      isExported: false,
      callees: extractCallees(trimmed),
    }]
  }

  return results
}

/** Deduplicate internal call edges between extracted functions */
export function buildInternalEdges(functions: ExtractedFunction[]): Array<{ source: string; target: string }> {
  const nameToIndex = new Map(functions.map((f, i) => [f.label, i]))
  const edges: Array<{ source: string; target: string }> = []
  const seen = new Set<string>()

  for (const fn of functions) {
    for (const callee of fn.callees) {
      if (nameToIndex.has(callee) && callee !== fn.label) {
        const key = `${fn.label}→${callee}`
        if (!seen.has(key)) {
          seen.add(key)
          edges.push({ source: fn.label, target: callee })
        }
      }
    }
  }
  return edges
}
