PV - The Protein Viewer
=========================================

`PV` is a WebGL2-based protein viewer for the browser. It renders cartoons, ball-and-stick,
line, trace, sphere and point representations directly from PDB or mmCIF files, with custom
color schemes, selections, and proper order-independent transparency, all at interactive
framerates even for large macromolecules.

You can try the [online demo](https://awaterho.github.io/pv/demo/), and read the
[documentation](https://awaterho.github.io/pv/docs/).

Origins
-----------------------------------------

`PV` is a fork and continuation of [`PV`](https://github.com/biasmv/pv), the WebGL protein
viewer originally created by [Marco Biasini](https://github.com/biasmv). The original project
was archived as no longer maintained; `pv` builds on that foundation and carries the work
forward: the rendering engine, molecule model and file parsers are all still fundamentally
Marco's design. Huge thanks to him, and to everyone who contributed to the original `PV`
(`@Traksewt`, `@kozmad`, `@greenify`, `@andreasprlic`, and others credited in `PV`'s own
history).

Since forking, the project has been substantially modernized:

  - migrated the WebGL context from WebGL1 to WebGL2
  - full rewrite of the codebase from JavaScript to TypeScript
  - replaced the AMD/RequireJS/Grunt build with [Vite](https://vitejs.dev), publishing ESM, CJS
    and IIFE bundles with generated type declarations
  - replaced the vendored `gl-matrix` copy with the upstream npm package
  - replaced screen-door transparency with proper weighted blended order-independent
    transparency (OIT), including for billboarded spheres
  - added an mmCIF/CIF parser alongside the existing PDB parser
  - migrated the test suite from QUnit to [Vitest](https://vitest.dev) (unit) and
    [Playwright](https://playwright.dev) (browser/visual regression)

Behaviour changes that may need changes in code using `PV`:

  - `select('ligand')` now selects everything but water outside the polymers: no longer the
    nucleotides of DNA/RNA chains, but now free amino acids. Code that picked DNA/RNA out of
    the ligands, e.g. `select('ligand').select({ rnames : ['A', 'C', 'G', 'U'] })`, should
    start from `select('polymer')` instead.
  - a residue with the atoms of both a nucleotide and an amino acid (SAM, SAH, hypermodified
    tRNA bases such as 12A) is a nucleotide only, so `select('protein')` no longer returns it.

Trying it out
-----------------------------------------

Clone this repository:

```bash
git clone https://github.com/awaterho/pv.git
cd pv
npm install
```

Then start the Vite dev server:

```bash
npm run dev
```

This opens `index.html`, which loads the viewer directly from TypeScript source. 


Using pv on your website
----------------------------------------

Build the single js file you need to run PV in your website:

```bash
git clone https://github.com/awaterho/pv.git
cd pv
npm install
npm run build
```

This produces `dist/pv.iife.js`, which defines a global `pv` and can be dropped straight into a
page with a plain `<script>` tag (`dist/pv.js` and `dist/pv.cjs` are also available if you're
using a bundler or `require`):

```
<div id="viewer" style="width: 100%; height: 100%;"></div>
<script src="pv.iife.js"></script>
<script>
  var viewer = pv.Viewer(document.getElementById('viewer'), {
    width: 'auto',
    height: 'auto',
    antialias: true,
  });

  pv.io.fetchCif('https://files.rcsb.org/download/1HBB.cif', function (structure) {
    viewer.cartoon('protein', structure, { color: pv.color.ssSuccession() });
    viewer.autoZoom();
  });
</script>
```

WebGL2 is required, so pv won't run in browsers without WebGL2 support.

Development
----------------------------------------

```bash
npm run dev         # start the Vite dev server (index.html)
npm run build        # produce dist/pv.{js,cjs,iife.js} + type declarations
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm test             # unit tests (vitest)
npm run test:browser # browser/visual-regression tests (playwright)
```
