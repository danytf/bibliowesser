# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Biblioteca ONG · Wesser — a single-file internal reference app (`index.html`, ~265KB) used by Wesser's commercial/fundraising team to quickly look up facts, figures, and talking points for the 7 NGOs they represent. Not a public-facing site.

There are **two independent HTML deliverables**:
- **`index.html`** — the intranet version, video links point to YouTube. This is the primary/source file for all content editing.
- **`index-tablet.html`** — the tablet version, served from the company intranet and opened on locked-down company tablets. Content-identical to `index.html` except: (1) each NGO's `videos` array is trimmed to a curated 3-4 video selection, and (2) every video (and each `captacion.resumen30.videoDestacado`) carries a `"yt":"<11-char id>"` field, which makes it open in the built-in fullscreen viewer instead of navigating away. `safeUrl()` in this file is also patched to allow `videos/*/*.mp4` relative paths, left over from an earlier local-mp4 approach.

  **The tablet file must be served over http(s), never opened as `file://`** — YouTube rejects embeds with no valid referrer (Error 153). Verified working over plain http on a non-secure origin, so the intranet does not need HTTPS for this.

**These two files are maintained independently, not auto-synced.** Any content edit that isn't about videos (cifras, textos, programas, captación, etc.) must be applied to both files by hand. `scripts/make-tablet.js` exists only as the one-time generator used to bootstrap `index-tablet.html` from `index.html` — it is not a build step to run routinely; if a large resync is ever needed, it can be re-run and re-adapted (it re-derives the video selection and the `safeUrl` patch from a hardcoded `SELECCION` map, and would need updating for any other diff between the files).

The `videos/` directory (a `README.md` per NGO listing expected `.mp4` filenames; `videos/**/*.mp4` is gitignored) is a leftover of the earlier approach where the tablet played local files. Nothing in either HTML references it any more.

### Fullscreen video viewer (tablet only)

The tablet is restricted to a URL allowlist, but that alone cannot contain YouTube: `youtube.com/watch` is a SPA, so searching or opening another video happens via `pushState` with no page load a URL filter could see. The fix is to never open YouTube's site — only its embed player, inside the app:

- `#vfs` overlay + Fullscreen API, so the browser chrome disappears and the user never leaves the page.
- A transparent `#vfsShield` over the iframe swallows every tap, so the player's title, logo, "Watch on YouTube" and "More videos" are visible but not clickable. The only controls are ours (`#vfsClose`, `#vfsPlay`).
- The YouTube IFrame API closes the viewer on `ENDED`, so the end-screen suggestion grid never appears. It is an optional enhancement — if the API fails to load, the viewer still works without pause/auto-close.
- `vidAttrs()` builds the link attributes for both the video list and the featured video: `yt` → embed in the viewer, `visor:true` → local mp4 in the same viewer, neither → plain link opening in a new tab.

Allowlist domains the player needs: `www.youtube-nocookie.com`, `*.googlevideo.com` (wildcard required, the subdomain rotates), `i.ytimg.com`, `yt3.ggpht.com`, `jnn-pa.googleapis.com`, `www.gstatic.com`, `www.google.com`, and `www.youtube.com` restricted to `/iframe_api` and `/s/player/*` so that `/watch` and `/results` stay blocked. Plus `fonts.googleapis.com` / `fonts.gstatic.com` for the page fonts (it degrades to system fonts if blocked).

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
