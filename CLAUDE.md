# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Orca (>= 1.4.245) custom-editor plugin for `.adoc` files: source textarea on the left, live Asciidoctor.js preview on the right. Manifest is `orca-plugin.json` (sandboxed-ui, no host capabilities). Requires Node.js 20+.

## Commands

- `npm ci` — install locked deps
- `npm run build` — bundle `src/main.js` and inline it with `editor/style.css` into `editor/index.template.html`, writing `editor/index.html` and `editor/app.js`
- `npm test` — `node --test` (runs `render.test.js`; single test: `node --test --test-name-pattern="<name>" render.test.js`)

No linter or formatter. Style: ES modules, two-space indent, single quotes, no semicolons.

## Architecture

- `src/render.js` — `renderAsciiDoc(source, document)`: Asciidoctor in `safe: 'secure'` → DOMPurify → DOM fragment. Returns `{ fragment, hasIncludes, hasImages }`; images are marked unavailable and relative links are neutralised.
- `src/main.js` — editor glue against the `window.orca` API: `document.get()` / `onDidChange` feed `receive()`; edits are debounced (250ms) and sent with `document.applyEdit({ baseVersion, content })`; `editor.flush` forces a send. Tracks `version`, `lastApplied`, `conflicted` to detect external changes (on conflict, edits stop and the user is told to switch to Source view).
- `scripts/build.js` — Orca loads editors as sandboxed `srcdoc` with a CSP allowing only inline assets, so the build embeds CSS and JS directly into `editor/index.html`.

## Gotchas

- `editor/index.html` and `editor/app.js` are **generated but committed** (Orca installs the repo without building). Edit `src/`, `editor/style.css` or `editor/index.template.html`, then rebuild and commit the outputs. Never edit the generated files directly.
- Security invariants (see `AGENTS.md`): keep Asciidoctor in secure mode, keep sanitizing output, no remote scripts/assets, includes and images stay unavailable (the plugin gets document text only, no path or adjacent files). Add tests to `render.test.js` (`node:test`, `node:assert/strict`, jsdom) for new rendering or security-sensitive behavior.
- Commit subjects are short and imperative.
