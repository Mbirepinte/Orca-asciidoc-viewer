# Repository Guidelines

## Project Structure & Module Organization

`src/main.js` connects the editor to Orca's document API and manages preview updates, saving, and conflicts. `src/render.js` converts AsciiDoc to sanitized HTML. `editor/index.html` and `editor/style.css` define the editor UI; `editor/app.js` is the generated browser bundle committed for Orca installation. Root-level `render.test.js` contains rendering tests. `orca-plugin.json` defines the plugin, and `README.md` documents installation and current limitations.

## Build, Test, and Development Commands

Use Node.js 20 or newer and Orca 1.4.245 or newer.

- `npm ci` installs the locked dependencies.
- `npm run build` bundles `src/main.js` into `editor/app.js` with esbuild. Rebuild after changing source code, and commit the updated bundle.
- `npm test` runs the Node test suite.

For a local check in Orca, add this repository under **Settings → Plugins → Development folders**, enable the plugin, and open a `.adoc` file.

## Coding Style & Naming Conventions

Follow the existing JavaScript style: ES modules, two-space indentation, single quotes, and no semicolons. Use `camelCase` for variables and functions; keep file names lowercase. There is no configured formatter or linter, so keep changes consistent with nearby code. Edit `src/` files rather than the minified `editor/app.js` directly.

## Testing Guidelines

Add behavior tests to `render.test.js` using `node:test`, `node:assert/strict`, and jsdom. Name tests for observable behavior, as in `renders document structure`. Run `npm test` before submitting changes. There is no stated coverage threshold; cover new rendering behavior and security-sensitive cases such as unsafe HTML, links, and unavailable resources.

## Commit & Pull Request Guidelines

The available history contains one short, imperative commit subject (`render test`); use similarly concise subjects that describe the change. In pull requests, explain the user-visible behavior, list `npm test` and build results, and link an issue when applicable. Include screenshots for UI changes and commit the rebuilt `editor/app.js` when `src/` changes affect it.

## Security & Resource Limits

Keep Asciidoctor in secure mode and sanitize generated HTML. The editor cannot resolve adjacent files: includes and images must remain unavailable in the preview, and relative links must not become navigable. Do not add remote scripts or asset fetching to the preview.
