import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
globalThis.window = dom.window
globalThis.document = dom.window.document
const { renderAsciiDoc } = await import('./src/render.js')
const { getBlockSource, replaceBlock } = await import('./src/blockEdit.js')

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

test('tags editable blocks with their source line range', () => {
  const source = '= T\n:toc:\n\nIntro\n\n[source,js]\n.Title\n----\ncode\n----\n\n== Sub\n\n* a\n* b\n\nlast'
  const { container } = html(source)
  const ranges = [...container.querySelectorAll('[data-line-start]')]
    .map(element => `${element.tagName.toLowerCase()}:${element.dataset.lineStart}-${element.dataset.lineEnd}`)
  assert.deepEqual(ranges, ['h1:1-2', 'div:4-4', 'div:6-10', 'h2:12-12', 'div:14-15', 'div:17-17'])
  assert.equal(container.innerHTML.includes('adoc-src-'), false)
})

test('block ranges do not weaken sanitizing', () => {
  const { container } = html('= T\n\n++++\n<script>alert(1)</script>\n++++\n\nimage::a.png[]')
  assert.equal(container.querySelector('script'), null)
  assert.equal(container.querySelector('img'), null)
})

test('replaces and reads blocks by line range', () => {
  const source = 'a\n\nb\nc\n\nd'
  assert.equal(getBlockSource(source, 3, 4), 'b\nc')
  assert.equal(replaceBlock(source, 3, 4, 'x\ny\nz\n'), 'a\n\nx\ny\nz\n\nd')
  assert.equal(replaceBlock(source, 3, 4, ''), 'a\n\nd')
  assert.equal(replaceBlock('a\r\n\r\nb', 3, 3, 'c'), 'a\r\n\r\nc')
  assert.equal(replaceBlock(source, 5, 9, 'x'), null)
})

test('edits a block from the preview mode', async () => {
  const sent = []
  const page = new JSDOM(await readFile('editor/index.html', 'utf8'), {
    runScripts: 'dangerously',
    beforeParse(window) {
      window.orca = {
        document: {
          onDidChange() {},
          applyEdit: async edit => { sent.push(edit.content.text) },
          get: async () => ({ content: { kind: 'text', text: '= A\n\nHello.\n\nBye.' }, version: 1, readOnly: false })
        },
        on() {}
      }
    }
  })
  await new Promise(resolve => setTimeout(resolve, 0))
  const doc = page.window.document
  doc.querySelector('[data-mode-button="preview"]').click()
  assert.equal(doc.querySelector('.layout').dataset.mode, 'preview')
  doc.querySelector('#preview .paragraph').click()
  const area = doc.querySelector('.block-editor')
  assert.equal(area.value, 'Hello.')
  area.value = 'Hello, world.'
  area.dispatchEvent(new page.window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }))
  assert.equal(doc.querySelector('#source').value, '= A\n\nHello, world.\n\nBye.')
  assert.match(doc.querySelector('#preview').textContent, /Hello, world\./)
  await new Promise(resolve => setTimeout(resolve, 300))
  assert.deepEqual(sent, ['= A\n\nHello, world.\n\nBye.'])
  page.window.close()
})
