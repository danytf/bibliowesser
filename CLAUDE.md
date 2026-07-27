# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Biblioteca ONG · Wesser — a single-file internal reference app (`index.html`, ~265KB) used by Wesser's commercial/fundraising team to quickly look up facts, figures, and talking points for the 7 NGOs they represent. Not a public-facing site.

There are **two independent HTML deliverables**:
- **`index.html`** — the intranet version, video links point to YouTube. This is the primary/source file for all content editing.
- **`index-tablet.html`** — the tablet version, handed out on company tablets without reliable internet. Content-identical to `index.html` except: (1) each NGO's `videos` array is trimmed to a curated 3-video selection, and (2) those video `url`s point to local files (`videos/{ongId}/{slug}.mp4`) instead of YouTube. `safeUrl()` in this file is patched to also allow `videos/*/*.mp4` relative paths (the original only allows `http(s)://`).

**These two files are maintained independently, not auto-synced.** Any content edit that isn't about videos (cifras, textos, programas, captación, etc.) must be applied to both files by hand. `scripts/make-tablet.js` exists only as the one-time generator used to bootstrap `index-tablet.html` from `index.html` — it is not a build step to run routinely; if a large resync is ever needed, it can be re-run and re-adapted (it re-derives the video selection and the `safeUrl` patch from a hardcoded `SELECCION` map, and would need updating for any other diff between the files).

Video files themselves (`.mp4`) are not committed to git (`videos/**/*.mp4` in `.gitignore`, large binaries handled outside version control) — only a `videos/{ongId}/README.md` per NGO listing the exact filenames the tablet HTML expects. Actual `.mp4` files must be placed on the tablet manually with those exact names.

## Commands

There is no build, bundler, package manager, or test suite. This is a static HTML file with everything inline (CSS in `<style>`, JS in `<script>`, data in embedded `<script type="application/json">` blocks). To "run" it, just open `index.html` in a browser (or use a local static server / the `run` skill for a quick check after edits).

## Architecture

Everything lives in one file, in this order:

1. **`<style>` (head)** — all CSS, using CSS custom properties defined on `:root` for dark mode and overridden under `body.light` for light mode (toggled via `#thbtn`, persisted to `localStorage` key `wt`). Fonts: Plus Jakarta Sans (body text) and Space Grotesk (`--font-display`, used for numbers/headings).
2. **Per-NGO data blocks** — one `<script type="application/json" id="data-{id}">` per NGO (`aecc`, `aldeas`, `cruzroja`, `fec`, `fjc`, `fpm`, `wwf`). Each is a self-contained JSON object with fields like `id`, `emoji` (often inline SVG), `nombre`, `full`, `color`, `claim`, `meta[]`, `cifras[]` (key stats, each `{num,label,fuente}`), `programas[]` (collapsible program sections with `desc`, `dato`, `emoji`, `name`, optional `categoria`/`resumenClave`), `captacion` (the "30s pitch" speed-dial view: `problema`, `argumentario`, `motivosSocio`, `cierre`, `discurso`), `fuentesCompletas`, `videos`, `verificado`/`ultimaActualizacion`.
3. **Main `<script>` (bottom of body)** — loads `ONGS` by `JSON.parse`-ing each data block, then renders everything client-side. Key functions:
   - `renderTabs()` — builds the NGO tab bar once at init (ARIA `tablist`/`tab`); tabs wrap onto multiple lines rather than scrolling/overflowing, so there's no "+N más" badge. `updateTabs()` patches active-tab/badge state afterward without rebuilding. Click and arrow-key navigation (`tabKeydown`) are wired via event delegation.
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
