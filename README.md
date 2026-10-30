# AsciiDoc Viewer for Orca

An Orca custom editor for `.adoc` files. Edit the source on the left and see a live AsciiDoc preview on the right. Orca manages the document buffer, saving and external changes.

## Install for development

Requires Orca 1.4.245 or newer and Node.js 20 or newer.

```sh
npm ci
npm run build
```

In Orca, enable plugins in **Settings → Plugins**, add this repository under **Development folders…**, then review and enable the plugin. Open a `.adoc` file. The regular **Source** view remains available in Orca's editor toggle.

## Limits

Orca provides custom editors with the open document's text, but not its path or access to adjacent files. `include::` directives and image files therefore cannot be resolved by this plugin. The preview marks images as unavailable and shows a notice when the source contains includes or images. Relative links are disabled in the preview. Use Orca's Source view for documents needing those resources.

The preview uses Asciidoctor.js in secure mode and sanitizes the resulting HTML. All JavaScript dependencies are bundled locally; the plugin does not request host capabilities or load resources from a CDN.

## Build

```sh
npm run build
npm test
```

`editor/app.js` is committed so Orca can install this repository without running a build.
