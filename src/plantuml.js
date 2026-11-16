// Classic UMD script: bundled as ESM it falls back to defining globalThis.Viz, which the engine reads.
import '@plantuml/core/viz-global.js'
import { renderToString } from '@plantuml/core'
// C4 stdlib bundle from plantuml.github.io/plantuml/js-plantuml/, so `!include <C4/...>` works offline.
import '../vendor/plantuml-stdlib-c4.min.js'
// tupadr3 icons (20 MB raw), gzipped as { files, json, info } and only inflated when a diagram includes them.
import tupadr3 from '../vendor/plantuml-stdlib-tupadr3.json.gz'

async function inflate(base64) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json()
}

const bundled = { tupadr3 }

globalThis.PLANTUML_STDLIB_LOADER = (url, ok, fail) => {
  const lib = url.replace(/\.min\.js$/, '')
  if (globalThis.PLANTUML_STDLIB?.[lib]) return ok()
  if (!bundled[lib]) return fail(`${url} is not bundled in this preview`)
  inflate(bundled[lib]).then(({ files, json, info }) => {
    for (const [key, value] of [['PLANTUML_STDLIB', files], ['PLANTUML_STDLIB_JSON', json], ['PLANTUML_STDLIB_INFO', info]]) {
      globalThis[key] = globalThis[key] || {}
      globalThis[key][lib] = value || {}
    }
    ok()
  }, error => fail(String(error)))
}

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
  for (const diagram of diagrams) {
    const { element } = diagram
    // C4-PlantUML URL includes point at the same files as the bundled C4 stdlib.
    const source = diagram.source.replace(/^(\s*)!include(?:url)?\s+https:\/\/raw\.githubusercontent\.com\/plantuml-stdlib\/C4-PlantUML\/[^/\s]+\/([\w-]+)\.puml\s*$/gm, '$1!include <C4/$2>')
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
