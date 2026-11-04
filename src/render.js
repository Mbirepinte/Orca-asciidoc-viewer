import Asciidoctor from '@asciidoctor/core'
import DOMPurify from 'dompurify'
import { computeRanges } from './blockEdit.js'

const asciidoctor = Asciidoctor()

const RANGE_CLASS = /^adoc-src-(\d+)-(\d+)$/

// Editable units in document order: the document header, then every block that is
// not itself a container of editable blocks. Sections contribute their heading only.
function collectUnits(doc) {
  const units = []
  const visit = blocks => {
    for (const block of blocks) {
      const context = block.getContext()
      const line = block.getSourceLocation()?.getLineNumber()
      if (context === 'preamble') {
        visit(block.getBlocks())
        continue
      }
      if (!line) continue
      units.push({ block, line })
      if (context === 'section') visit(block.getBlocks())
    }
  }
  visit(doc.getBlocks())
  return units
}

// Tags every editable unit with an `adoc-src-<start>-<end>` role (1-based source
// lines). Returns the header range, which has no block to carry a role.
function annotate(doc, source) {
  const units = collectUnits(doc)
  const hasHeader = doc.hasHeader() && Boolean(doc.getDocumentTitle())
  const ranges = computeRanges(source, [...(hasHeader ? [1] : []), ...units.map(unit => unit.line)])
  const header = hasHeader ? ranges.shift() : null
  units.forEach((unit, index) => {
    unit.block.addRole(`adoc-src-${ranges[index].start}-${ranges[index].end}`)
  })
  return header
}

function setRange(element, start, end) {
  element.dataset.lineStart = start
  element.dataset.lineEnd = end
}

// Roles are the only channel Asciidoctor gives us to mark blocks; turn them into
// data attributes and drop the class. A section's range belongs to its heading.
function applyRanges(root, header) {
  for (const element of root.querySelectorAll('[class*="adoc-src-"]')) {
    const names = [...element.classList]
    const match = names.map(name => RANGE_CLASS.exec(name)).find(Boolean)
    if (!match) continue
    element.classList.remove(match[0])
    if (!element.classList.length) element.removeAttribute('class')
    const target = /\bsect\d\b/.test(element.className) ? [...element.children].find(child => /^H[2-6]$/.test(child.tagName)) : element
    if (target) setRange(target, match[1], match[2])
  }
  const title = [...root.children].find(child => child.tagName === 'H1')
  if (header && title) setRange(title, header.start, header.end)
}

export function renderAsciiDoc(source, document) {
  // SECURE keeps passthrough HTML and includes from reaching the preview.
  const doc = asciidoctor.load(source, {
    safe: 'secure',
    sourcemap: true,
    standalone: false,
    attributes: { showtitle: true, 'allow-uri-read': false }
  })
  const header = annotate(doc, source)
  const html = doc.convert()
  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'srcset']
  })
  const template = document.createElement('template')
  template.innerHTML = clean
  applyRanges(template.content, header)

  // The frame has no file path and cannot read adjacent files. Do not request
  // images from a path relative to the plugin or from an external host.
  for (const img of template.content.querySelectorAll('img')) {
    const replacement = document.createElement('span')
    replacement.className = 'unavailable'
    replacement.textContent = `Image unavailable: ${img.getAttribute('alt') || img.getAttribute('src') || 'unknown'}`
    img.replaceWith(replacement)
  }
  for (const link of template.content.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href') || ''
    if (/^https?:\/\//i.test(href)) {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
    } else if (!href.startsWith('#') && !href.startsWith('mailto:')) {
      link.removeAttribute('href')
      link.title = 'Relative target unavailable in the plugin preview'
    }
  }
  return {
    fragment: template.content,
    hasIncludes: /^include::/m.test(source),
    hasImages: /(?:^|\s)image::?[^\s\[]+\[/m.test(source)
  }
}
