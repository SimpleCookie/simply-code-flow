export function normalizeCode(code: string): string {
  return code
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/#[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function hashCode(code: string): string {
  const normalized = normalizeCode(code)
  let h = 0
  for (let i = 0; i < normalized.length; i++) {
    h = Math.imul(31, h) + normalized.charCodeAt(i) | 0
  }
  return Math.abs(h).toString(36)
}
