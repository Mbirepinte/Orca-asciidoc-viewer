// Pure helpers to read and replace a block of AsciiDoc source by 1-based line range.

function splitLines(source) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n'
  return { eol, lines: source.split(/\r?\n/) }
}

function validRange(lines, start, end) {
  return Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start && end <= lines.length
}

export function getBlockSource(source, start, end) {
  const { eol, lines } = splitLines(source)
  if (!validRange(lines, start, end)) return null
  return lines.slice(start - 1, end).join(eol)
}

// Returns the new document, or null when the range does not fit the source.
// An empty replacement removes the block and one of its surrounding blank lines.
export function replaceBlock(source, start, end, text) {
  const { eol, lines } = splitLines(source)
  if (!validRange(lines, start, end)) return null
  const replacement = text.trim() === '' ? [] : text.replace(/\s+$/, '').split(/\r?\n/)
  const next = [...lines.slice(0, start - 1), ...replacement, ...lines.slice(end)]
  if (!replacement.length && next[start - 1] === '' && (start === 1 || next[start - 2] === '')) next.splice(start - 1, 1)
  return next.join(eol)
}

const ATTRIBUTE_LINE = /^(\[.*\]|\.[^\s.].*|\/\/(?!\/).*)$/

// Block attribute lines, titles and comments directly above a block belong to it,
// but Asciidoctor reports the line of the block itself.
export function extendStartUp(lines, start, floor = 1) {
  let current = start
  while (current - 1 > floor - 1 && ATTRIBUTE_LINE.test(lines[current - 2])) current -= 1
  return current
}

// units: [{ line }] in document order. Returns [{ start, end }] with blank lines trimmed.
export function computeRanges(source, lines) {
  const sourceLines = source.split(/\r?\n/)
  const starts = []
  let floor = 1
  for (const line of lines) {
    const start = Math.max(extendStartUp(sourceLines, line, floor), floor)
    starts.push(start)
    floor = line + 1
  }
  return starts.map((start, index) => {
    let end = index + 1 < starts.length ? starts[index + 1] - 1 : sourceLines.length
    while (end > start && sourceLines[end - 1].trim() === '') end -= 1
    return { start, end }
  })
}
