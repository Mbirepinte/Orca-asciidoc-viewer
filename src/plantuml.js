// Classic UMD script: bundled as ESM it falls back to defining globalThis.Viz, which the engine reads.
import '@plantuml/core/viz-global.js'
import { renderToString } from '@plantuml/core'

// ponytail: unbounded cache keyed by diagram source; bound it if long sessions grow memory.
const cache = new Map()

function draw(element, result) {
  if (result.svg) {
    const image = document.createElement('img')
    image.alt = 'PlantUML diagram'
    // An <img> never runs scripts embedded in the SVG.
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`
    element.replaceChildren(image)
  } else {
    const error = document.createElement('pre')
    error.className = 'plantuml-error'
    error.textContent = `PlantUML error: ${result.error}`
    element.replaceChildren(error)
  }
}

export function renderDiagrams(diagrams) {
  for (const { element, source } of diagrams) {
    let entry = cache.get(source)
    if (!entry) {
      entry = new Promise(resolve => renderToString(source.split('\n'), svg => resolve({ svg }), error => resolve({ error })))
        .then(result => cache.set(source, result) && result)
      cache.set(source, entry)
    }
    if (entry instanceof Promise) {
      element.textContent = 'Rendering diagram…'
      entry.then(result => element.isConnected && draw(element, result))
    } else {
      draw(element, entry)
    }
  }
}
