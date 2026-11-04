import { renderAsciiDoc } from './render.js'
import { getBlockSource, replaceBlock } from './blockEdit.js'

const source = document.querySelector('#source')
const preview = document.querySelector('#preview')
const notice = document.querySelector('#notice')
const status = document.querySelector('#status')
const layout = document.querySelector('.layout')
const modeButtons = document.querySelectorAll('[data-mode-button]')

let version
let readOnly = false
let lastApplied = ''
let pendingTimer
let sending = false
let sendPromise = Promise.resolve()
let conflicted = false
let mode = 'split'
let editing

try { if (localStorage.getItem('asciidoc-mode') === 'preview') mode = 'preview' } catch {}

function setMode(next) {
  closeBlockEditor(true)
  mode = next
  layout.dataset.mode = mode
  for (const button of modeButtons) button.setAttribute('aria-pressed', String(button.dataset.modeButton === mode))
  try { localStorage.setItem('asciidoc-mode', mode) } catch {}
}

function showStatus(message) { status.textContent = message }

function render() {
  try {
    const result = renderAsciiDoc(source.value, document)
    preview.replaceChildren(result.fragment)
    const unavailable = []
    if (result.hasIncludes) unavailable.push('includes')
    if (result.hasImages) unavailable.push('images')
    notice.hidden = unavailable.length === 0
    notice.textContent = unavailable.length
      ? `External resources unavailable in this preview: ${unavailable.join(', ')}.`
      : ''
  } catch (error) {
    preview.textContent = `Preview failed: ${error.message}`
  }
}

async function sendPendingEdit() {
  clearTimeout(pendingTimer)
  if (sending) return sendPromise
  if (readOnly || conflicted || source.value === lastApplied) return
  sending = true
  sendPromise = (async () => {
    while (!conflicted && source.value !== lastApplied) {
      const text = source.value
      try {
        await window.orca.document.applyEdit({
          baseVersion: version,
          content: { kind: 'text', text }
        })
        lastApplied = text
        showStatus('Saved to Orca buffer')
      } catch (error) {
        conflicted = true
        showStatus(error.code === 'conflict'
          ? 'File changed outside Orca. Switch to Source to resolve.'
          : `Edit failed: ${error.message}`)
        break
      }
    }
  })().finally(() => { sending = false })
  return sendPromise
}

function receive(doc) {
  closeBlockEditor(true)
  if (doc.content?.kind !== 'text') {
    showStatus('Unsupported document content')
    return
  }
  const incoming = doc.content.text
  const hasLocalChanges = source.value !== lastApplied
  version = doc.version
  readOnly = doc.readOnly
  source.disabled = readOnly
  if (hasLocalChanges && incoming !== lastApplied) {
    conflicted = true
    showStatus('File changed outside Orca. Switch to Source to resolve.')
    return
  }
  source.value = incoming
  lastApplied = incoming
  conflicted = false
  showStatus(readOnly ? 'Read only' : '')
  render()
}

function sourceChanged() {
  render()
  showStatus('Updating…')
  clearTimeout(pendingTimer)
  pendingTimer = setTimeout(sendPendingEdit, 250)
}

source.addEventListener('input', sourceChanged)

function fitBlockEditor(area) {
  area.style.height = 'auto'
  area.style.height = `${area.scrollHeight}px`
}

// Replaces the clicked preview block by a textarea holding its AsciiDoc source.
function openBlockEditor(element) {
  if (editing || readOnly || conflicted) return
  const start = Number(element.dataset.lineStart)
  const end = Number(element.dataset.lineEnd)
  const text = getBlockSource(source.value, start, end)
  if (text === null) return
  const area = document.createElement('textarea')
  area.className = 'block-editor'
  area.spellcheck = false
  area.value = text
  area.setAttribute('aria-label', 'Edit AsciiDoc block')
  editing = { element, area, start, end, original: text }
  area.addEventListener('input', () => fitBlockEditor(area))
  area.addEventListener('blur', () => closeBlockEditor(true))
  area.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeBlockEditor(false)
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      closeBlockEditor(true)
    }
  })
  element.hidden = true
  element.after(area)
  fitBlockEditor(area)
  area.focus()
}

function closeBlockEditor(commit) {
  if (!editing) return
  const { element, area, start, end, original } = editing
  editing = undefined
  const text = area.value
  area.remove()
  element.hidden = false
  if (!commit || text === original) return
  const next = replaceBlock(source.value, start, end, text)
  if (next === null || next === source.value) return
  source.value = next
  sourceChanged()
}

preview.addEventListener('click', event => {
  if (mode !== 'preview' || event.target.closest('a[href], .block-editor')) return
  const element = event.target.closest('[data-line-start]')
  if (element) openBlockEditor(element)
})

for (const button of modeButtons) button.addEventListener('click', () => setMode(button.dataset.modeButton))
setMode(mode)

window.orca.document.onDidChange(receive)
window.orca.on('editor.flush', sendPendingEdit)
window.orca.document.get().then(receive).catch(error => {
  showStatus(`Unable to open document: ${error.message}`)
})
