import { toPng } from 'html-to-image'
import type { Flow } from '@scf/shared'
import type { Node, Edge } from '@xyflow/react'
import type { CustomNodeData } from '../graph/CustomNode.tsx'
import type { CustomEdgeData } from '../graph/CustomEdge.tsx'

function download(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportAsJSON(flow: Flow) {
  download(`${flow.name.replace(/\s+/g, '_')}.json`, JSON.stringify(flow, null, 2), 'application/json')
}

export async function exportAsPNG() {
  const el = document.querySelector<HTMLElement>('.react-flow__viewport')
  if (!el) return
  try {
    const dataUrl = await toPng(el, { backgroundColor: '#0f1117', pixelRatio: 2 })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'flow.png'
    a.click()
  } catch (e) {
    console.error('PNG export failed', e)
  }
}

export function exportAsMarkdown(flow: Flow, rfNodes: Node[], rfEdges: Edge[]) {
  const lines: string[] = [`# ${flow.name}`, '']
  if (flow.description) lines.push(`> ${flow.description}`, '')
  lines.push(`**Nodes:** ${rfNodes.length}  |  **Edges:** ${rfEdges.length}`, '---', '')

  rfNodes.forEach((n) => {
    const d = n.data as CustomNodeData
    lines.push(`## ${d.label || '(unlabelled)'}`, '')
    lines.push(`| Field | Value |`)
    lines.push(`|---|---|`)
    lines.push(`| Kind | \`${d.kind}\` |`)
    lines.push(`| Status | ${d.status} |`)
    lines.push(`| Language | ${d.language ?? 'unknown'} |`)
    if (d.filePath) lines.push(`| File | \`${d.filePath}${d.lineRange ? `:${d.lineRange[0]}-${d.lineRange[1]}` : ''}\` |`)
    if (d.isAsync) lines.push(`| Async | yes |`)
    if (d.tags?.length) lines.push(`| Tags | ${d.tags.map((t) => `\`${t}\``).join(', ')} |`)
    lines.push('')

    if (d.code) {
      lines.push(`\`\`\`${d.language ?? ''}`)
      lines.push(d.code)
      lines.push('```', '')
    }

    if (d.notes) lines.push(`**Notes:** ${d.notes}`, '')

    const outEdges = rfEdges.filter((e) => e.source === n.id)
    if (outEdges.length) {
      lines.push('**Calls:**')
      outEdges.forEach((e) => {
        const ed = (e.data ?? {}) as CustomEdgeData
        const target = rfNodes.find((x) => x.id === e.target)
        const tLabel = target ? (target.data as CustomNodeData).label : e.target
        lines.push(`- \`${ed.kind}\` → **${tLabel}**${ed.condition ? ` *(${ed.condition})*` : ''}`)
      })
      lines.push('')
    }

    lines.push('---', '')
  })

  download(`${flow.name.replace(/\s+/g, '_')}_report.md`, lines.join('\n'))
}

export function exportAsMermaid(flow: Flow, rfNodes: Node[], rfEdges: Edge[]) {
  const lines = ['flowchart TD']

  rfNodes.forEach((n) => {
    const d = n.data as CustomNodeData
    const label = (d.label || 'unlabelled').replace(/"/g, "'")
    if (d.kind === 'stub') {
      lines.push(`  ${n.id}["${label}"]:::stub`)
    } else {
      lines.push(`  ${n.id}["${label}"]`)
    }
  })

  lines.push('')

  rfEdges.forEach((e) => {
    const d = (e.data ?? {}) as CustomEdgeData
    const label = d.condition ?? d.label ?? d.kind ?? ''
    if (label) {
      lines.push(`  ${e.source} -->|"${label.replace(/"/g, "'")}"| ${e.target}`)
    } else {
      lines.push(`  ${e.source} --> ${e.target}`)
    }
  })

  lines.push('')
  lines.push('  classDef stub stroke-dasharray: 5 5')

  download(`${flow.name.replace(/\s+/g, '_')}.mmd`, lines.join('\n'))
}
