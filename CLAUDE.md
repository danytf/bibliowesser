# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Biblioteca ONG · Wesser — a single-file internal reference app (`index.html`, ~265KB) used by Wesser's commercial/fundraising team to quickly look up facts, figures, and talking points for the 7 NGOs they represent. Not a public-facing site.

## Commands

There is no build, bundler, package manager, or test suite. This is a static HTML file with everything inline (CSS in `<style>`, JS in `<script>`, data in embedded `<script type="application/json">` blocks). To "run" it, just open `index.html` in a browser (or use a local static server / the `run` skill for a quick check after edits).

## Architecture

Everything lives in one file, in this order:

1. **`<style>` (head)** — all CSS, using CSS custom properties defined on `:root` for dark mode and overridden under `body.light` for light mode (toggled via `#thbtn`, persisted to `localStorage` key `wt`). Fonts: Plus Jakarta Sans (body text) and Space Grotesk (`--font-display`, used for numbers/headings).
2. **Per-NGO data blocks** — one `<script type="application/json" id="data-{id}">` per NGO (`aecc`, `aldeas`, `cruzroja`, `fec`, `fjc`, `fpm`, `wwf`). Each is a self-contained JSON object with fields like `id`, `emoji` (often inline SVG), `nombre`, `full`, `color`, `claim`, `meta[]`, `cifras[]` (key stats, each `{num,label,fuente}`), `programas[]` (collapsible program sections with `desc`, `dato`, `fuente`), `captacion` (the "30s pitch" speed-dial view: `problema`, `argumentario`, `motivosSocio`, `cierre`, `discurso`), `fuentesCompletas`, `videos`, `verificado`/`ultimaActualizacion`.
3. **Main `<script>` (bottom of body)** — loads `ONGS` by `JSON.parse`-ing each data block, then renders everything client-side. Key functions:
   - `renderTabs()` — builds the horizontal NGO tab bar (ARIA `tablist`/`tab`), wires click + arrow-key navigation (`tabKeydown`), and computes the "+N más" overflow badge for tabs that don't fit on screen.
   - `renderFicha()` — renders the full detail view for the currently selected NGO (`currentOng`): hero band, metadata chips, key-figures grid, collapsible program accordions.
   - `renderCaptacion(view, ong)` — renders the alternate "captación" (30s pitch) view when `captacionMode` is true, built from the NGO's `captacion` object.
   - `selectOng(id)` / `toggleCaptacion()` / `toggleTheme()` — state transitions; each re-renders tabs and/or ficha rather than diffing, since the whole app re-renders from `ONGS` + `currentOng` + `captacionMode` on any state change.
   - `esc()` / `safeUrl()` — manual escaping helpers used when interpolating data into template strings (no framework, so XSS-safety from embedded data is handled by hand — keep using these when adding new interpolations).

There is no routing, no persistence beyond the theme toggle, and no network calls — all content is static data baked into the page at authoring time.

## Working in this codebase

- To add or edit NGO content, edit the relevant `<script type="application/json" id="data-{id}">` block directly — keep it valid JSON (it's parsed with `JSON.parse`).
- `cifras` entries are objects `{num, label, fuente}`; `num` should be a single clean figure, not prose.
- Data displayed in `.citem-d`/secondary text should use `var(--muted)`, not the NGO's brand `color` — the brand color is reserved for hero numbers, not secondary data.
- Figures in this file have already been fact-checked against NGO sources; don't second-guess existing numbers without new source material.
- The file contains literal accented Spanish text (NGO names, claims, etc.) — when scripting edits (vs. using the Edit tool), use Node rather than shell tools that can mangle UTF-8/tildes on Windows.
- Both dark and light themes share the same markup; when touching colors, check both by toggling `#thbtn` (state persists per-browser via `localStorage`).
