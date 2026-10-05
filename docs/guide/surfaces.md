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

## Coarse surfaces

On a structure loaded with only its CA and C3' atoms (see [Large structures](./large-structures)), `radiusOffset: 2` gives a closed, smooth outline of the molecule:

```js
viewer.surface('surface', structure, { radiusOffset: 2 });
```

The worker is part of the PV script, so there is no extra file to serve. A page with a strict Content Security Policy must allow workers from `blob:` URLs.
