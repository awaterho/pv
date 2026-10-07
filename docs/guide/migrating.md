# Migrating from PV 1.x

PV 2 is a rewrite of [Marco Biasini's PV](https://github.com/biasmv/pv) in TypeScript, on WebGL2. Most code written for PV 1.x runs unchanged. These are the changes that may need changes in yours.

## Loading PV

- The script is `dist/pv.iife.js` (it was `bio-pv.min.js`), and it still defines the global `pv`. There are also an ES module (`dist/pv.js`) and a CommonJS one (`dist/pv.cjs`), with TypeScript declarations. The RequireJS/AMD build is gone.
- PV needs **WebGL2**.

## Loading structures

- `pv.io.fetchPdb` and the other fetchers return a promise. The callback still works.
- `pv.io.cif` and `pv.io.fetchCif` are new, and read much more than the PDB reader: see [Loading structures](./loading#what-pv-reads-from-mmcif). Chains of mmCIF files are the `label_asym_id` chains, so ligands and water are chains of their own.

## Selections

- **`select('ligand')`** selects everything but water outside the polymers. It no longer includes the nucleotides of DNA and RNA chains, and now includes free amino acids. Code that picked DNA or RNA out of the ligands should start from `'polymer'`:

  ```js
  // PV 1.x
  structure.select('ligand').select({ rnames: ['A', 'C', 'G', 'U', 'DA', 'DC', 'DG', 'DT'] });
  // PV 2
  structure.select('polymer').select({ rnames: ['A', 'C', 'G', 'U', 'DA', 'DC', 'DG', 'DT'] });
  ```

- A residue with the atoms of both a nucleotide and an amino acid, such as SAM, SAH or the modified tRNA base 12A, is a nucleotide only, so `select('protein')` no longer returns it.

## Events

- The `atomClicked` and `atomDoubleClicked` events are `click` and `doubleClick`. The constructor options `atomClick`, `atomClicked`, `atomDoubleClick` and `atomDoubleClicked` are gone; use `click` and `doubleClick`.
- `click`, `doubleClick` and the new `longPress` also come from touch.
- The picked object no longer has `object()`. Use `target()` for the atom or custom-mesh data and `node()` for the object that was picked.

## Removed names

- `structure.chain(name)` is `structure.chainByName(name)`. `residue.chain()` is unchanged.
- `pv.rgb.setColorPalette` and `pv.rgb.hex2rgb` are `pv.color.setColorPalette` and `pv.color.hex2rgb`.

## Rendering

- `spheres` draws every atom as a sphere of 1.5 Å times `radiusMultiplier`, drawn as a flat image of a sphere; `sphereDetail` has no effect.
- `ballsAndSticks` draws double and triple bonds, where the file gives bond orders, and its default `sphereRadius` is 0.2.
- `setOpacity(alpha, selection)` and `setHover(selection, symIndex)` take a selection, so they can apply to part of an object. Transparency is order-independent.
- `setSelection` tints and outlines the selection instead of drawing a halo.
- The `quality` default is `'auto'`: high detail, and low for structures with more than 50,000 residues.
- Antialiasing is on by default (`antialias: false` turns it off), and draws the scene at twice the size and scales it down. Ambient occlusion is on by default too.
- `autoZoom()` re-centers the camera as well as zooming.

## New

[Biological assemblies](./assemblies) for every style (`showRelated`), [surfaces](./surfaces), [glycans and nucleic-acid bases](./glycans-nucleic-acids), triangles in [custom meshes](./custom-meshes), ambient occlusion, outlines, touch gestures, and [trace-only loading](./large-structures) of very large structures.
