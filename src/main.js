import { renderAsciiDoc } from './render.js'

const source = document.querySelector('#source')
const preview = document.querySelector('#preview')
const notice = document.querySelector('#notice')
const status = document.querySelector('#status')

let version
let readOnly = false
let lastApplied = ''
let pendingTimer
let sending = false
let sendPromise = Promise.resolve()
let conflicted = false

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

source.addEventListener('input', () => {
  render()
  showStatus('Updating…')
  clearTimeout(pendingTimer)
  pendingTimer = setTimeout(sendPendingEdit, 250)
})

window.orca.document.onDidChange(receive)
window.orca.on('editor.flush', sendPendingEdit)
window.orca.document.get().then(receive).catch(error => {
  showStatus(`Unable to open document: ${error.message}`)
})
