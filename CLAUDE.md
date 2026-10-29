# Type Warp

Browser tool that warps a font's outlines along a 12-point envelope and exports SVG/PNG.
Static site, no build step. Live at https://bersudsky.github.io/bulatov/ (GitHub Pages, `main`, repo root).

## Where things live

Open only the file for the mechanic you are changing.

| File | What it does |
|---|---|
| `index.html` | Markup only. Load order of scripts matters. |
| `js/state.js` | Settings object `S`, defaults, canvas `view`. Loaded first. |
| `js/geometry.js` | Envelope math: Bezier edges, Coons patch, homography (Converging mode). |
| `js/metrics.js` | Cap height, x-height, ascender, descender; Vertical trim frame. |
| `js/layout.js` | Text fields and wrapped rows, Line height, Leading, kerning, glyph outlines. |
| `js/curves.js` | Refits warped polylines into Bezier curves for display and export. |
| `js/render.js` | `recompute()`, `render()`, `refit()`, `fitView()`. Grid, font lines, measurements, handles. |
| `js/viewport.js` | Zoom, pan, keyboard shortcuts, resize. |
| `js/handles.js` | Point dragging, snapping to whole degrees, manual kerning, undo. |
| `js/export.js` | SVG and PNG export. |
| `js/controls.js` | Number scrubbing, sliders, toggles, Reset all, `syncUI()`. |
| `js/lines-panel.js` | Text panel blocks: size chip, leading chip, alignment, reorder. |
| `js/storage.js` | Persistence: artifact `window.storage` or `localStorage`. Keys `typewarp:*`. |
| `js/presets.js` | Saved states and sets of four mirrored variations. |
| `js/font.js` | Font loading and the font card. |
| `js/main.js` | Startup. Loaded last. |
| `css/*.css` | Split by area, loaded in cascade order: base, panel, lines, controls, states, stage. |

## How the code is wired

- Classic scripts with `defer`, sharing one global scope. No modules, so the page also opens from disk.
- A file may call functions from any other file inside event handlers. Code that runs at load time
  may only use what is defined in the same or an earlier file. Startup calls belong in `main.js`.
- After any change that alters geometry call `refit()` (recompute, fit view, draw), or `render()` to redraw.
- Envelope handles are stored as fractions of the frame. `recompute()` rescales them when the frame
  size changes so edge angles stay put. Set `PREV = null` when replacing `S` wholesale (apply state, restore).
- Saved state format version is in `storage.js` (`payload.v`); migrate old versions there, never drop data.
- After editing CSS or JS, bump `?v=` on the links in `index.html` so browsers fetch the new files.

## Rules

- Interface text is English. Never use the middle dot «·» anywhere in the UI.
- Spacing scale is `--s1..--s5` (4/8/12/16/24); vertical gaps are 8px.
- Type scale: 11px/600 uppercase headings, 12px hints, 14px everything else, weights 400 and 600 only.
