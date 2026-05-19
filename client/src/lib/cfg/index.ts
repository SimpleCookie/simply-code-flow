/**
 * lib/cfg/index.ts
 *
 * Control-Flow Graph (CFG) extractor for JS/TS function bodies.
 *
 * Produces a graph of CfgNode + CfgEdge objects that can be
 * rendered directly in React Flow inside the NodeCodeOverlay "Flow" tab.
 *
 * Strategy: regex + bracket-matching. No full AST parser, so it
 * works reasonably well across JS, TS, JSX, and similar C-syntax
 * languages. For complex edge cases a full parser (e.g. @typescript-eslint)
 * can replace individual extractors later.
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export type CfgNodeKind =
  | 'entry'       // function entry point
  | 'exit'        // return / throw / break / continue
  | 'branch'      // if / else-if / ternary
  | 'loop'        // for / while / forEach / map / filter / reduce
  | 'switch'      // switch statement
  | 'case'        // individual switch case
  | 'call'        // function call
  | 'trycatch'    // try/catch/finally
  | 'block'       // catch / finally / else blocks

export type CfgEdgeHandle =
  | 'true' | 'false'       // branch outcomes
  | 'body' | 'complete'    // loop: into body / after loop
  | 'try' | 'catch' | 'finally'   // try-catch edges
  | 'case' | 'default'     // switch cases
  | 'next'                 // normal sequential flow

export interface CfgNode {
  id: string
  kind: CfgNodeKind
  label: string            // short display text
  detail?: string          // e.g. full condition for branch/loop
  line?: number            // 1-based line number in source
  callTarget?: string      // for call nodes: the callee name
  isAsync?: boolean        // for call nodes with await
  isReturn?: boolean       // for exit nodes: true = return, false = throw
  cycloWeight: number      // contribution to cyclomatic complexity (0 or 1)
}

export interface CfgEdge {
  id: string
  source: string
  target: string
  handle: CfgEdgeHandle
  label?: string
}

export interface CfgGraph {
  nodes: CfgNode[]
  edges: CfgEdge[]
  cyclomaticComplexity: number   // M = E − N + 2
}

// ─── Internal counter ─────────────────────────────────────────────────────────

let _counter = 0
function uid(prefix: string) { return `cfg-${prefix}-${++_counter}` }

// ─── Bracket / paren / string helpers ────────────────────────────────────────

/** Find the matching closing bracket starting at openIdx. */
export function findClose(code: string, openIdx: number, open = '{', close = '}'): number {
  let depth = 0
  let inStr: string | null = null
  for (let i = openIdx; i < code.length; i++) {
    const ch = code[i]
    if (inStr) {
      if (ch === '\\') { i++; continue }
      if (ch === inStr) inStr = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue }
    if (ch === '/' && code[i + 1] === '/') { while (i < code.length && code[i] !== '\n') i++; continue }
    if (ch === '/' && code[i + 1] === '*') { i = code.indexOf('*/', i + 2) + 1; continue }
    if (ch === open) depth++
    if (ch === close) { if (--depth === 0) return i }
  }
  return -1
}

/** Extract the body text between the first `{` and its matching `}`. */
function extractBody(code: string): { body: string; startLine: number } {
  const braceIdx = code.indexOf('{')
  if (braceIdx === -1) return { body: code, startLine: 1 }
  const closeIdx = findClose(code, braceIdx)
  const body = closeIdx === -1 ? code.slice(braceIdx + 1) : code.slice(braceIdx + 1, closeIdx)
  const startLine = (code.slice(0, braceIdx).match(/\n/g) ?? []).length + 1
  return { body, startLine }
}

/** Count newlines up to index to get a 1-based line number. */
function lineAt(code: string, idx: number, base = 1): number {
  return base + (code.slice(0, idx).match(/\n/g) ?? []).length
}

// ─── Main extractor ───────────────────────────────────────────────────────────

/**
 * Extract a CFG from a JS/TS function definition string.
 * Returns a CfgGraph with nodes, edges, and cyclomatic complexity.
 */
export function extractCfg(code: string): CfgGraph {
  _counter = 0   // reset for deterministic IDs per call
  const nodes: CfgNode[] = []
  const edges: CfgEdge[] = []

  const { body, startLine } = extractBody(code)

  // Entry node
  const entryId = uid('entry')
  nodes.push({ id: entryId, kind: 'entry', label: 'START', cycloWeight: 0 })

  const lastId = walkBody(body, entryId, startLine, nodes, edges)

  // Exit node (implicit return at end of body)
  if (lastId) {
    const exitId = uid('exit')
    nodes.push({ id: exitId, kind: 'exit', label: 'END', isReturn: true, cycloWeight: 0 })
    edges.push({ id: uid('e'), source: lastId, target: exitId, handle: 'next' })
  }

  // Cyclomatic complexity: count decision nodes + 1
  const decisionCount = nodes.filter((n) => n.cycloWeight > 0).reduce((s, n) => s + n.cycloWeight, 0)
  const complexity = decisionCount + 1

  return { nodes, edges, cyclomaticComplexity: complexity }
}

/**
 * Walk through a code body, emitting CFG nodes and edges.
 * Returns the id of the last node emitted (to connect subsequent statements).
 */
function walkBody(
  body: string,
  predecessorId: string,
  baseLine: number,
  nodes: CfgNode[],
  edges: CfgEdge[],
): string {
  let prev = predecessorId
  let pos = 0

  while (pos < body.length) {
    // Skip leading whitespace
    const wsMatch = body.slice(pos).match(/^[\s\n]+/)
    if (wsMatch) { pos += wsMatch[0].length; continue }

    const rest = body.slice(pos)
    const line = lineAt(body, pos, baseLine)

    // ── if / else-if ─────────────────────────────────────────────────────────
    const ifMatch = rest.match(/^(else\s+)?if\s*\(/)
    if (ifMatch) {
      const isElseIf = ifMatch[1] !== undefined
      const parenOpen = rest.indexOf('(')
      const parenClose = findClose(rest, parenOpen, '(', ')')
      const condition = parenClose > 0 ? rest.slice(parenOpen + 1, parenClose) : '...'

      const branchId = uid('branch')
      nodes.push({
        id: branchId, kind: 'branch',
        label: isElseIf ? `else if (${condition})` : `if (${condition})`,
        detail: condition, line, cycloWeight: 1,
      })
      edges.push({ id: uid('e'), source: prev, target: branchId, handle: 'next' })

      // True branch body
      let afterParen = parenClose + 1
      const trueBodyStart = rest.slice(afterParen).match(/^\s*\{/) ? afterParen + rest.slice(afterParen).indexOf('{') : afterParen
      const trueClose = findClose(rest, trueBodyStart)
      const trueBody = trueClose > 0 ? rest.slice(trueBodyStart + 1, trueClose) : ''
      const trueTail = uid('join-t')
      nodes.push({ id: trueTail, kind: 'block', label: '(true branch)', cycloWeight: 0 })
      edges.push({ id: uid('e'), source: branchId, target: trueTail, handle: 'true', label: 'true' })
      const trueLast = walkBody(trueBody, trueTail, lineAt(rest, trueBodyStart, baseLine), nodes, edges)

      // Else branch (if present)
      let joinId: string
      const afterTrue = trueClose > 0 ? trueClose + 1 : trueBodyStart + trueBody.length
      const elseMatch = rest.slice(afterTrue).match(/^\s*else\s*(\{|if\s*\()/)
      if (elseMatch && !elseMatch[1].startsWith('if')) {
        const elseBodyStart = afterTrue + rest.slice(afterTrue).indexOf('{')
        const elseClose = findClose(rest, elseBodyStart)
        const elseBody = elseClose > 0 ? rest.slice(elseBodyStart + 1, elseClose) : ''
        const falseTail = uid('join-f')
        nodes.push({ id: falseTail, kind: 'block', label: '(false branch)', cycloWeight: 0 })
        edges.push({ id: uid('e'), source: branchId, target: falseTail, handle: 'false', label: 'false' })
        const elseLast = walkBody(elseBody, falseTail, lineAt(rest, elseBodyStart, baseLine), nodes, edges)
        joinId = uid('join')
        nodes.push({ id: joinId, kind: 'block', label: '(join)', cycloWeight: 0 })
        if (trueLast) edges.push({ id: uid('e'), source: trueLast, target: joinId, handle: 'next' })
        if (elseLast) edges.push({ id: uid('e'), source: elseLast, target: joinId, handle: 'next' })
        pos += elseClose > 0 ? elseClose + 1 : afterTrue + elseBody.length
      } else {
        // no else — false goes to join immediately
        joinId = uid('join')
        nodes.push({ id: joinId, kind: 'block', label: '(join)', cycloWeight: 0 })
        edges.push({ id: uid('e'), source: branchId, target: joinId, handle: 'false', label: 'false' })
        if (trueLast) edges.push({ id: uid('e'), source: trueLast, target: joinId, handle: 'next' })
        pos += trueClose > 0 ? trueClose + 1 : trueBodyStart + trueBody.length
      }
      prev = joinId
      continue
    }

    // ── switch ───────────────────────────────────────────────────────────────
    const switchMatch = rest.match(/^switch\s*\(/)
    if (switchMatch) {
      const parenOpen = rest.indexOf('(')
      const parenClose = findClose(rest, parenOpen, '(', ')')
      const expr = parenClose > 0 ? rest.slice(parenOpen + 1, parenClose) : '...'
      const braceStart = parenClose > 0 ? rest.indexOf('{', parenClose) : -1
      const braceEnd = braceStart > 0 ? findClose(rest, braceStart) : -1
      const switchBody = braceEnd > 0 ? rest.slice(braceStart + 1, braceEnd) : ''

      const switchId = uid('switch')
      nodes.push({ id: switchId, kind: 'switch', label: `switch (${expr})`, detail: expr, line, cycloWeight: 1 })
      edges.push({ id: uid('e'), source: prev, target: switchId, handle: 'next' })

      const joinId = uid('join')
      nodes.push({ id: joinId, kind: 'block', label: '(after switch)', cycloWeight: 0 })

      // Extract case blocks
      const caseRe = /\b(case\s+[^:]+|default)\s*:/g
      let cm: RegExpExecArray | null
      const casePositions: { label: string; start: number }[] = []
      while ((cm = caseRe.exec(switchBody)) !== null) {
        casePositions.push({ label: cm[0].replace(/:$/, '').trim(), start: cm.index + cm[0].length })
      }
      casePositions.forEach((cp, i) => {
        const end = i + 1 < casePositions.length ? casePositions[i + 1].start - casePositions[i].label.length - 1 : switchBody.length
        const caseBody = switchBody.slice(cp.start, end)
        const isDefault = cp.label === 'default'
        const caseId = uid('case')
        nodes.push({ id: caseId, kind: 'case', label: cp.label, cycloWeight: isDefault ? 0 : 1 })
        edges.push({ id: uid('e'), source: switchId, target: caseId, handle: isDefault ? 'default' : 'case', label: cp.label })
        const caseLast = walkBody(caseBody, caseId, baseLine, nodes, edges)
        if (caseLast) edges.push({ id: uid('e'), source: caseLast, target: joinId, handle: 'next' })
      })
      if (casePositions.length === 0) {
        edges.push({ id: uid('e'), source: switchId, target: joinId, handle: 'default' })
      }

      pos += braceEnd > 0 ? braceEnd + 1 : switchBody.length
      prev = joinId
      continue
    }

    // ── for / while / do-while ───────────────────────────────────────────────
    const loopMatch = rest.match(/^(for\s+(?:await\s+)?\(.*?(?:\{|;)|(while|do)\s*(\(|\{))/)
    if (loopMatch) {
      const isForOf = /^for\s+(await\s+)?of\b/.test(rest.slice(4))
      const headerEnd = rest.indexOf('{')
      const header = headerEnd > 0 ? rest.slice(0, headerEnd).replace(/\s+/g, ' ').trim() : loopMatch[0].trim()
      const loopId = uid('loop')
      nodes.push({ id: loopId, kind: 'loop', label: header.length > 40 ? header.slice(0, 40) + '…' : header, detail: header, line, cycloWeight: 1, isAsync: isForOf })
      edges.push({ id: uid('e'), source: prev, target: loopId, handle: 'next' })

      const bodyStart = rest.indexOf('{')
      const bodyEnd = bodyStart > 0 ? findClose(rest, bodyStart) : -1
      const loopBody = bodyEnd > 0 ? rest.slice(bodyStart + 1, bodyEnd) : ''

      const bodyEntryId = uid('loop-body')
      nodes.push({ id: bodyEntryId, kind: 'block', label: '(loop body)', cycloWeight: 0 })
      edges.push({ id: uid('e'), source: loopId, target: bodyEntryId, handle: 'body', label: 'body' })
      walkBody(loopBody, bodyEntryId, lineAt(rest, bodyStart, baseLine), nodes, edges)

      const afterId = uid('loop-after')
      nodes.push({ id: afterId, kind: 'block', label: '(after loop)', cycloWeight: 0 })
      edges.push({ id: uid('e'), source: loopId, target: afterId, handle: 'complete', label: 'done' })

      pos += bodyEnd > 0 ? bodyEnd + 1 : (bodyStart > 0 ? bodyStart + loopBody.length : loopMatch[0].length)
      prev = afterId
      continue
    }

    // ── .forEach / .map / .filter / .reduce / .find / .some / .every ─────────
    const chainMatch = rest.match(/^\w[\w.]*\.(forEach|map|filter|reduce|find|findIndex|some|every|flatMap)\s*\(/)
    if (chainMatch) {
      const method = chainMatch[1]
      const callLabel = rest.slice(0, rest.indexOf('(')).trim() + `.${method}(...)`
      const loopId = uid('loop')
      nodes.push({ id: loopId, kind: 'loop', label: callLabel.length > 40 ? callLabel.slice(0, 40) + '…' : callLabel, detail: callLabel, line, cycloWeight: 1 })
      edges.push({ id: uid('e'), source: prev, target: loopId, handle: 'next' })

      // Find the callback body
      const openParen = rest.indexOf('(')
      const closeParen = findClose(rest, openParen, '(', ')')
      const callbackStr = closeParen > 0 ? rest.slice(openParen + 1, closeParen) : ''
      const callbackBrace = callbackStr.indexOf('{')
      if (callbackBrace > 0) {
        const callbackEnd = findClose(callbackStr, callbackBrace)
        const callbackBody = callbackEnd > 0 ? callbackStr.slice(callbackBrace + 1, callbackEnd) : ''
        const bodyEntryId = uid('cb-body')
        nodes.push({ id: bodyEntryId, kind: 'block', label: '(callback body)', cycloWeight: 0 })
        edges.push({ id: uid('e'), source: loopId, target: bodyEntryId, handle: 'body', label: 'each' })
        walkBody(callbackBody, bodyEntryId, baseLine, nodes, edges)
      }
      const afterId = uid('loop-after')
      nodes.push({ id: afterId, kind: 'block', label: `(after ${method})`, cycloWeight: 0 })
      edges.push({ id: uid('e'), source: loopId, target: afterId, handle: 'complete', label: 'done' })

      pos += closeParen > 0 ? closeParen + 1 : chainMatch[0].length
      prev = afterId
      continue
    }

    // ── try/catch/finally ────────────────────────────────────────────────────
    const tryMatch = rest.match(/^try\s*\{/)
    if (tryMatch) {
      const tryBrace = rest.indexOf('{')
      const tryEnd = findClose(rest, tryBrace)
      const tryBody = tryEnd > 0 ? rest.slice(tryBrace + 1, tryEnd) : ''

      const tryId = uid('try')
      nodes.push({ id: tryId, kind: 'trycatch', label: 'try', cycloWeight: 1 })
      edges.push({ id: uid('e'), source: prev, target: tryId, handle: 'next' })

      const tryBodyEntry = uid('try-body')
      nodes.push({ id: tryBodyEntry, kind: 'block', label: '(try body)', cycloWeight: 0 })
      edges.push({ id: uid('e'), source: tryId, target: tryBodyEntry, handle: 'try', label: 'try' })
      const tryLast = walkBody(tryBody, tryBodyEntry, lineAt(rest, tryBrace, baseLine), nodes, edges)

      const joinId = uid('join')
      nodes.push({ id: joinId, kind: 'block', label: '(after try)', cycloWeight: 0 })
      if (tryLast) edges.push({ id: uid('e'), source: tryLast, target: joinId, handle: 'next' })

      let searchFrom = tryEnd + 1
      const catchMatch = rest.slice(searchFrom).match(/^\s*catch\s*(\([^)]*\))?\s*\{/)
      if (catchMatch) {
        const catchParam = catchMatch[1] ?? ''
        const catchBrace = searchFrom + rest.slice(searchFrom).indexOf('{')
        const catchEnd = findClose(rest, catchBrace)
        const catchBody = catchEnd > 0 ? rest.slice(catchBrace + 1, catchEnd) : ''
        const catchEntry = uid('catch-body')
        nodes.push({ id: catchEntry, kind: 'block', label: `catch ${catchParam}`, cycloWeight: 0 })
        edges.push({ id: uid('e'), source: tryId, target: catchEntry, handle: 'catch', label: 'catch' })
        const catchLast = walkBody(catchBody, catchEntry, lineAt(rest, catchBrace, baseLine), nodes, edges)
        if (catchLast) edges.push({ id: uid('e'), source: catchLast, target: joinId, handle: 'next' })
        searchFrom = catchEnd + 1
      }
      const finallyMatch = rest.slice(searchFrom).match(/^\s*finally\s*\{/)
      if (finallyMatch) {
        const finallyBrace = searchFrom + rest.slice(searchFrom).indexOf('{')
        const finallyEnd = findClose(rest, finallyBrace)
        const finallyBody = finallyEnd > 0 ? rest.slice(finallyBrace + 1, finallyEnd) : ''
        const finallyEntry = uid('finally-body')
        nodes.push({ id: finallyEntry, kind: 'block', label: 'finally', cycloWeight: 0 })
        edges.push({ id: uid('e'), source: tryId, target: finallyEntry, handle: 'finally', label: 'finally' })
        const finallyLast = walkBody(finallyBody, finallyEntry, lineAt(rest, finallyBrace, baseLine), nodes, edges)
        if (finallyLast) edges.push({ id: uid('e'), source: finallyLast, target: joinId, handle: 'next' })
        searchFrom = finallyEnd + 1
      }

      pos += searchFrom
      prev = joinId
      continue
    }

    // ── return / throw / break / continue ────────────────────────────────────
    const exitMatch = rest.match(/^(return|throw|break|continue)\b/)
    if (exitMatch) {
      const keyword = exitMatch[1] as 'return' | 'throw' | 'break' | 'continue'
      const lineEnd = rest.indexOf('\n')
      const stmt = lineEnd > 0 ? rest.slice(0, lineEnd).trim() : rest.trim()
      const exitId = uid('exit')
      nodes.push({
        id: exitId, kind: 'exit',
        label: stmt.length > 40 ? stmt.slice(0, 40) + '…' : stmt,
        detail: stmt, line,
        isReturn: keyword === 'return',
        cycloWeight: 0,
      })
      edges.push({ id: uid('e'), source: prev, target: exitId, handle: 'next' })
      pos += lineEnd > 0 ? lineEnd + 1 : rest.length
      prev = exitId
      continue
    }

    // ── await function call ───────────────────────────────────────────────────
    const awaitCallMatch = rest.match(/^(?:(?:const|let|var)\s+\w+\s*=\s*)?await\s+([\w.]+)\s*\(/)
    if (awaitCallMatch) {
      const callee = awaitCallMatch[1]
      const openParen = rest.indexOf('(')
      const closeParen = findClose(rest, openParen, '(', ')')
      const callId = uid('call')
      nodes.push({ id: callId, kind: 'call', label: `await ${callee}()`, callTarget: callee, isAsync: true, line, cycloWeight: 0 })
      edges.push({ id: uid('e'), source: prev, target: callId, handle: 'next' })
      pos += closeParen > 0 ? closeParen + 1 : awaitCallMatch[0].length
      prev = callId
      continue
    }

    // ── regular function call (assignment or standalone) ──────────────────────
    const callMatch = rest.match(/^(?:(?:const|let|var)\s+[\w,\s{}]+\s*=\s*)?([\w.]+)\s*\(/)
    if (callMatch && !['if', 'for', 'while', 'switch', 'catch', 'function', 'class'].includes(callMatch[1])) {
      const callee = callMatch[1]
      const openParen = rest.indexOf('(')
      const closeParen = openParen > 0 ? findClose(rest, openParen, '(', ')') : -1
      const callId = uid('call')
      nodes.push({ id: callId, kind: 'call', label: `${callee}()`, callTarget: callee, line, cycloWeight: 0 })
      edges.push({ id: uid('e'), source: prev, target: callId, handle: 'next' })
      pos += closeParen > 0 ? closeParen + 1 : callMatch[0].length
      prev = callId
      continue
    }

    // ── default: skip to next newline or semicolon ────────────────────────────
    const skip = rest.match(/^[^{}\n;]+[;\n]?/)
    if (skip) { pos += skip[0].length } else { pos++ }
  }

  return prev
}

// ─── Complexity helper ────────────────────────────────────────────────────────

/** Compute cyclomatic complexity from code without building a full CfgGraph. */
export function computeComplexity(code: string): number {
  try {
    return extractCfg(code).cyclomaticComplexity
  } catch {
    return 1
  }
}

// ─── dagre layout helper ──────────────────────────────────────────────────────

import dagre from 'dagre'

export interface LayoutedCfgNode extends CfgNode {
  position: { x: number; y: number }
  width: number
  height: number
}

const NODE_WIDTH = 200
const NODE_HEIGHT = 50

/** Apply dagre top-down layout to a CfgGraph and return positioned nodes. */
export function layoutCfg(graph: CfgGraph): { nodes: LayoutedCfgNode[]; edges: CfgEdge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 60, nodesep: 40, marginx: 20, marginy: 20 })

  graph.nodes.forEach((n) => {
    const h = n.kind === 'entry' || n.kind === 'exit' ? 36 : NODE_HEIGHT
    g.setNode(n.id, { width: NODE_WIDTH, height: h })
  })
  graph.edges.forEach((e) => g.setEdge(e.source, e.target))

  dagre.layout(g)

  const positioned: LayoutedCfgNode[] = graph.nodes.map((n) => {
    const pos = g.node(n.id)
    return {
      ...n,
      position: { x: pos ? pos.x - NODE_WIDTH / 2 : 0, y: pos ? pos.y - NODE_HEIGHT / 2 : 0 },
      width: NODE_WIDTH,
      height: n.kind === 'entry' || n.kind === 'exit' ? 36 : NODE_HEIGHT,
    }
  })

  return { nodes: positioned, edges: graph.edges }
}
