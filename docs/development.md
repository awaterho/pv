# Development

PV is written in TypeScript and built with [Vite](https://vitejs.dev). It needs [Node.js](https://nodejs.org) 18 or newer.

```bash
git clone https://github.com/awaterho/pv.git
cd pv
npm install
npm run dev
```

`npm run dev` serves the demo (`index.html` and `demo.js`) at `http://localhost:5173`, loading PV straight from the TypeScript source, so changes show on reload.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Serves the demo from the source |
| `npm run build` | Builds `dist/pv.js` (ES module), `dist/pv.cjs` (CommonJS) and `dist/pv.iife.js` (global `pv`), minified, with source maps |
| `npm run build:debug` | The same, not minified, in `dist-debug/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | The TypeScript compiler, without output |
| `npm test` | The unit tests (Vitest) |
| `npm run test:browser` | The browser tests (Playwright); run `npx playwright install chromium` once first |
| `npm run docs:dev` | Serves these docs, with live samples running the source |
| `npm run build:pages` | Builds the site for GitHub Pages into `pages-dist/`: the landing page, the demo and these docs |
| `npm run survey:sample`, `npm run survey` | The PDB survey; see below |

## Tests

- **Unit tests** are in `src/tests/**/*.test.js` and run in Node. Structures they need are in `structures/`.
- **Browser tests** are in `tests/browser/` and run in Chromium against the dev server. Some compare screenshots with saved images, in `tests/browser/*-snapshots/`, allowing 2% of the pixels to differ.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, build, the unit tests and the browser tests on every push and pull request. Pushes to `main` also publish the site (`.github/workflows/pages.yml`).

## The PDB survey

The survey checks what PV makes of real PDB entries, without drawing them: it loads a sample of entries with PV's mmCIF reader and compares the result with the file and the wwPDB Chemical Component Dictionary. It finds bonds PV adds or misses, impossible valences, residues no style shows, cartoons bridging gaps, and files that fail to load.

```bash
npm run survey:sample   # picks about 1,800 entries into survey/ids.txt
npm run survey          # loads and checks them; downloads are cached in survey/cache
```

Then open `http://localhost:5173/survey/report.html` with `npm run dev` running: the problems found, grouped by check and residue, with links that open each entry in the demo.

## Code layout

| Path | |
|---|---|
| `src/viewer.ts` | The viewer: options, render styles, camera, events, picking |
| `src/gfx/` | Rendering: geometry of the styles, shaders, scene objects, labels, custom meshes |
| `src/mol/` | The molecule model, selections, superposition, assemblies |
| `src/io.ts`, `src/cif.ts` | The file readers |
| `src/color.ts` | Color operations |
| `src/surface/` | Surface computation, run in Web Workers |
| `src/rings/`, `src/snfg/` | The add-ons, built on the public API only |
| `demo.js` | The demo |
| `docs/` | These docs (VitePress) |
| `scripts/` | The Pages build and the PDB survey |

## Making a release

1. Set the version in `package.json`.
2. Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:browser`.
3. Check the demo and the samples in these docs.
4. Commit, tag the version, and push.
