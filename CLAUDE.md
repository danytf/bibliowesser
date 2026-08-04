# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Biblioteca ONG · Wesser — a single-file internal reference app (`index.html`, ~440KB) used by Wesser's commercial/fundraising team to quickly look up facts, figures, and talking points for the 7 NGOs they represent. Not a public-facing site.

**`index.html` is the only HTML deliverable and the file to edit.** One file for both audiences — the company intranet and the locked-down company tablets — carrying all 62 videos and an in-app fullscreen video viewer.

**Watch out for the name when reading history: today's `index.html` is not the old `index.html`.** The repo used to carry two files, and the one called `index.html` was the desktop/intranet build with no viewer. The unified file was committed as `biblioteca_final.html` and renamed over `index.html` immediately after, so `git log index.html` mixes the two lineages. `44a2c55` is the last commit where the old pair is intact: `git show 44a2c55:index.html`, `git show 44a2c55:index-tablet.html`.

It was built from the old `index.html` by adding a `"yt":"<11-char id>"` field to all 62 videos plus the 7 `captacion.resumen30.videoDestacado` entries (the ID derived from each `url`, `/shorts/` URLs included), then porting the viewer from `index-tablet.html`. Its data blocks are byte-identical to the old `index.html`'s apart from those `yt` fields. Differences from the tablet build: the local-mp4 leftovers are gone (`safeUrl()` is https-only, no `visor:true` branch), the viewer gained a seek bar, ±10s buttons and a time readout, and opening the page as `file://` shows a warning instead of silently failing.

**It must be served over http(s), never opened as `file://`** — YouTube rejects embeds with no valid referrer (Error 153). Verified working over plain http on a non-secure origin, so the intranet does not need HTTPS. There is deliberately no fallback to opening YouTube in a new tab: a banner in the header and a notice inside the viewer explain the problem instead, and the control bar stays hidden since it would do nothing.

### The superseded two-file split (deleted; here to explain why the current file looks the way it does)

- **the old `index.html`** — the intranet version, video links point to YouTube. This was the primary/source file for all content editing.
- **`index-tablet.html`** — the tablet version, served from the company intranet and opened on locked-down company tablets. Content-identical to `index.html` except: (1) each NGO's `videos` array is trimmed to a curated 3-4 video selection, and (2) every video (and each `captacion.resumen30.videoDestacado`) carries a `"yt":"<11-char id>"` field, which makes it open in the built-in fullscreen viewer instead of navigating away. `safeUrl()` in this file is also patched to allow `videos/*/*.mp4` relative paths, left over from an earlier local-mp4 approach.

  **The tablet file must be served over http(s), never opened as `file://`** — YouTube rejects embeds with no valid referrer (Error 153). Verified working over plain http on a non-secure origin, so the intranet does not need HTTPS for this.

Those two files were maintained independently, not auto-synced — which is the whole reason the unified file exists. While they were both live, any content edit that wasn't about videos (cifras, textos, programas, captación, etc.) had to be applied to both by hand. `scripts/make-tablet.js` was the one-time generator that bootstrapped `index-tablet.html` from `index.html`; it is dead code now, kept only as a record of how the split worked, and it would produce nothing usable if run against the current file.

An earlier iteration had the tablet play `.mp4` files shipped on the device, under a `videos/` directory. That is gone: every video now streams from YouTube. The `"visor":true` code path in `vidAttrs()`/`openVideo()` (play a local mp4 in the same fullscreen viewer) and the `videos/*/*.mp4` branch of `safeUrl()` survive from it, unused but working.

### Fullscreen video viewer

The tablet is restricted to a URL allowlist, but that alone cannot contain YouTube: `youtube.com/watch` is a SPA, so searching or opening another video happens via `pushState` with no page load a URL filter could see. The fix is to never open YouTube's site — only its embed player, inside the app:

- `#vfs` overlay + Fullscreen API, so the browser chrome disappears and the user never leaves the page.
- A transparent `#vfsShield` over the iframe swallows every tap, so the player's title, logo, "Watch on YouTube" and "More videos" are visible but not clickable. Every control is ours: `#vfsClose`, plus `#vfsCtl` holding the seek bar (`#vfsSeek`), the time readout (`#vfsTime`) and `#vfsBack`/`#vfsPlay`/`#vfsFwd`. `#vfsCtl` only appears once the player has answered, so a viewer that never starts shows no dead buttons.
- `#vfsCtl` fades out (`.oculto`) 3s into playback and comes back on any pointer/key activity over `#vfs`, via `mostrarCtl()`. It deliberately stays put while paused, and `#vfsClose` never hides — on a kiosk tablet the way out must always be on screen. Note the listener is on `#vfs` in the capture phase: the shield eats the tap before anything else sees it, so this is the only way to get the bar back on a touch device.
- Captions are forced off: `cc_load_policy=0` on the embed is not enough on its own (a user/browser preference still wins), so `quitarSubtitulos()` also sends `unloadModule` for both `captions` and `cc` on every state change.
- The player is driven by `postMessage` straight at the iframe (`enablejsapi=1` + a `listening` handshake), **deliberately not** by loading the IFrame API from `www.youtube.com`. That is what keeps `www.youtube.com` off the allowlist, and with it `/watch` and `/results`. `ytMensaje()` reads `playerState` and closes the viewer on `0` (ended), so the end-screen suggestion grid never appears; it also reads `currentTime`/`duration` out of `infoDelivery` to drive the seek bar, and seeking sends `seekTo`. After a seek, incoming positions are ignored for 800ms (`ignorarHasta`) so the bar doesn't snap back to the stale time.
- `vidAttrs()` builds the link attributes for both the video list and the featured video: a valid `yt` → embed in the viewer, otherwise a plain link opening in a new tab. The `href` always stays the original YouTube URL, as a way out if the JS ever fails.

Minimum allowlist, verified on the tablet build by blocking everything else and replaying all 23 videos there; the unified file uses the same embed and hosts: the page's own URL, `www.youtube-nocookie.com`, and `*.googlevideo.com` (wildcard required — the subdomain rotates per session, `rr1---…`, `rr2---…`). Nothing else is needed: `www.google.com` (one anti-abuse script), `jnn-pa.googleapis.com`, `www.gstatic.com` (the YouTube logo), `i.ytimg.com` / `yt3.ggpht.com` (thumbnails) and `fonts.googleapis.com` / `fonts.gstatic.com` are all optional or cosmetic. Do not add `www.youtube.com` — playback, pause and auto-close all work without it.

## Commands

There is no build, bundler, package manager, or test suite. This is a static HTML file with everything inline (CSS in `<style>`, JS in `<script>`, data in embedded `<script type="application/json">` blocks). To "run" it, **serve it over http** — a one-liner static server on any port is enough — and open it there. Do not check it by double-clicking the file: over `file://` the page renders fine but no video plays, and you will only see the warning banner.

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

- There is one HTML file, `index.html`. Nothing needs applying twice any more.
- To add or edit NGO content, edit the relevant `<script type="application/json" id="data-{id}">` block directly — keep it valid JSON (it's parsed with `JSON.parse`).
- A new video needs both `url` (the full YouTube URL, used as the link's `href` fallback) and `yt` (just the 11-character ID). Without `yt` the entry still works, but it opens YouTube in a new tab instead of the in-app viewer — which on the locked-down tablets means a dead end.
- `cifras` entries are objects `{num, label, fuente}`; `num` should be a single clean figure, not prose.
- Data displayed in `.citem-d`/secondary text should use `var(--muted)`, not the NGO's brand `color` — the brand color is reserved for hero numbers, not secondary data.
- Figures in this file have already been fact-checked against NGO sources; don't second-guess existing numbers without new source material.
- The file contains literal accented Spanish text (NGO names, claims, etc.) — when scripting edits (vs. using the Edit tool), use Node rather than shell tools that can mangle UTF-8/tildes on Windows.
- Both dark and light themes share the same markup; when touching colors, check both by toggling `#thbtn` (state persists per-browser via `localStorage`).
