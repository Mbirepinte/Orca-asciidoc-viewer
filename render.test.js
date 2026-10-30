import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
globalThis.window = dom.window
globalThis.document = dom.window.document
const { renderAsciiDoc } = await import('./src/render.js')

function html(source) {
  const result = renderAsciiDoc(source, document)
  const container = document.createElement('div')
  container.append(result.fragment)
  return { result, container }
}

test('renders document structure', () => {
  const { container } = html('= Guide\n\n== Section\n\n* one\n* two\n\n[cols="1,1"]\n|===\n|A |B\n|===')
  assert.equal(container.querySelector('h1')?.textContent, 'Guide')
  assert.equal(container.querySelector('h2')?.textContent, 'Section')
  assert.equal(container.querySelectorAll('li').length, 2)
  assert.equal(container.querySelectorAll('td').length, 2)
})

test('marks unavailable resources without fetching them', () => {
  const { result, container } = html('= Guide\n\nimage::photo.png[]\n\ninclude::part.adoc[]')
  assert.equal(result.hasImages, true)
  assert.equal(result.hasIncludes, true)
  assert.equal(container.querySelector('img'), null)
  assert.match(container.querySelector('.unavailable')?.textContent, /Image unavailable/)
  assert.equal(container.querySelector('a[href="part.adoc"]'), null)
})

test('sanitizes passthrough HTML and unsafe URLs', () => {
  const { container } = html('= Guide\n\n++++\n<script>alert(1)</script><a href="javascript:alert(1)">bad</a>\n++++')
  assert.equal(container.querySelector('script'), null)
  assert.equal(container.querySelector('a[href^="javascript:"]'), null)
})

test('opens a document in Orca without loading external assets', async () => {
  const page = new JSDOM(await readFile('editor/index.html', 'utf8'), {
    runScripts: 'dangerously',
    beforeParse(window) {
      window.orca = {
        document: {
          onDidChange() {},
          get: async () => ({
            content: { kind: 'text', text: '= A live document\n\nHello, Orca.' },
            version: 1,
            readOnly: false
          })
        },
        on() {}
      }
    }
  })

  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(page.window.document.querySelector('link[rel="stylesheet"], script[src]'), null)
  assert.equal(page.window.getComputedStyle(page.window.document.querySelector('.layout')).display, 'grid')
  assert.match(page.window.document.querySelector('#source').value, /A live document/)
  assert.equal(page.window.document.querySelector('#preview h1')?.textContent, 'A live document')
  page.window.close()
})
