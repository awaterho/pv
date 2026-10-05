# Surfaces

`viewer.surface` computes a molecular surface and draws it:

```js
viewer.surface('surface', structure.select('protein'), { color: pv.color.uniform('lightgrey') })
  .then(function (surface) {
    if (surface === null) return;   // removed before it was ready
    surface.setOpacity(0.6);
    viewer.requestRedraw();
  });
```

The surface is computed in the background, in Web Workers, so the page stays responsive. `surface()` returns a promise of the render object, which is added to the viewer once it is ready; `viewer.get(name)` returns `null` until then. Removing the name with `viewer.rm` or `viewer.clear()` stops the computation, and the promise then gives `null`.

## Options

| Option | Default | |
|---|---|---|
| `type` | `'ses'` | `'ses'`: solvent-excluded (Connolly) surface; `'sas'`: solvent-accessible surface; `'vdw'`: van der Waals surface |
| `probeRadius` | 1.4 | Radius of the solvent probe, in Å |
| `gridSpacing` | 0.5 | Resolution of the grid the surface is computed on, in Å |
| `radiusOffset` | 0 | Added to every atom's radius |
| `color` | by element | A [color operation](./coloring); each point of the surface takes its nearest atom's color |
| `showRelated` | `'asym'` | Or the name of a [biological assembly](./assemblies) |

Hydrogens are left out. Pass `structure.select('protein')` to leave out water and ligands as well.

For very large structures, the grid is made coarser by itself, so that it stays within memory.

## Assemblies

With `showRelated`, the surface is computed over all copies of the assembly together, so the faces where copies touch are buried, as they are in the real molecule.

## Recoloring

The surface supports `colorBy`, `setOpacity`, `setSelection` and `setHover` like other render objects. Since it arrives later, do these in the promise's `then`.

`colorBy` and `setOpacity` take a view as an optional second argument, and then change only that part of the surface.

## Pockets

A pocket found by a cavity finder, such as KVFinder or fpocket, is usually a set of points or spheres filling the empty space. A surface around them shows the pocket's shape. Put them into a structure of their own, as atoms of one element, and compute its surface; `radiusOffset` makes the atoms about as large as the spacing of the points:

```js
pv.io.fetchPdb('pocket.pdb').then(function (cavity) {
  const pocket = new pv.mol.Mol();
  const points = pocket.addChain('P').addResidue('POC', 1);
  cavity.eachAtom(function (atom) { points.addAtom('C', atom.pos(), 'C'); });
  viewer.surface('pocket', pocket, { color: pv.color.uniform('orange'), radiusOffset: -1 });
});
```

Copying the points matters when the file names them as hydrogens, as KVFinder's does, since surfaces leave hydrogens out. The [Surface sample](/samples/surface) shows a pocket inside a faint surface of the protein.

## Coarse surfaces

On a structure loaded with only its CA and C3' atoms (see [Large structures](./large-structures)), `radiusOffset: 2` gives a closed, smooth outline of the molecule:

```js
viewer.surface('surface', structure, { radiusOffset: 2 });
```

The worker is part of the PV script, so there is no extra file to serve. A page with a strict Content Security Policy must allow workers from `blob:` URLs.
