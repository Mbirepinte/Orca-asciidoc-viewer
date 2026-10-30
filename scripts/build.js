import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'

const bundle = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  write: false
})

const script = bundle.outputFiles[0].text
const [template, style] = await Promise.all([
  readFile('editor/index.template.html', 'utf8'),
  readFile('editor/style.css', 'utf8')
])

// Orca loads custom editors as srcdoc with a CSP that permits inline assets only.
const html = template
  .replace('<!-- INLINE_STYLE -->', () => `<style>\n${style.replace(/<\/style/gi, '<\\/style')}\n</style>`)
  .replace('<!-- INLINE_SCRIPT -->', () => `<script>\n${script.replace(/<\/script/gi, '<\\/script')}\n</script>`)

await Promise.all([
  writeFile('editor/app.js', script),
  writeFile('editor/index.html', html)
])
