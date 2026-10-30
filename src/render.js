import Asciidoctor from '@asciidoctor/core'
import DOMPurify from 'dompurify'

const asciidoctor = Asciidoctor()

export function renderAsciiDoc(source, document) {
  // SECURE keeps passthrough HTML and includes from reaching the preview.
  const html = asciidoctor.convert(source, {
    safe: 'secure',
    standalone: false,
    attributes: { showtitle: true, 'allow-uri-read': false }
  })
  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'srcset']
  })
  const template = document.createElement('template')
  template.innerHTML = clean

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
