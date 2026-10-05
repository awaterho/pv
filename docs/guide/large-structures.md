# Large structures

Structures with a few hundred thousand atoms, such as a ribosome, load and draw in full. Beyond that, memory runs out before speed does.

## Trace only

`traceOnly` keeps only the CA of every amino acid and the C3' of every nucleotide, and no side chains, ligands or water:

```js
pv.io.fetchCif('https://files.rcsb.org/download/3J3Q.cif', undefined, { traceOnly: true })
  .then(function (structure) {
    viewer.cartoon('capsid', structure);
    viewer.autoZoom();
  });
```

The HIV-1 capsid 3J3Q, with 2.4 million atoms, loads this way. The atoms that aren't wanted are dropped while the file is read, so they never take up memory. The trace-based styles (cartoon, tube, trace, sline, lineTrace) draw such a structure as they would the full one, and a surface with `radiusOffset: 2` gives a closed outline of it (see [Surfaces](./surfaces#coarse-surfaces)).

The [demo](https://awaterho.github.io/pv/demo/) loads PDB entries trace-only above 500,000 atoms. It asks the RCSB for the atom count first:

```js
fetch('https://data.rcsb.org/rest/v1/core/entry/' + id)
  .then(function (response) { return response.json(); })
  .then(function (entry) {
    const traceOnly = entry.rcsb_entry_info.deposited_atom_count > 500000;
    return pv.io.fetchCif('https://files.rcsb.org/download/' + id + '.cif',
                          undefined, { traceOnly: traceOnly });
  });
```

## Detail

With the default `quality: 'auto'`, structures with more than 50,000 residues to draw, counting the copies of a [biological assembly](./assemblies), get less detailed geometry. Set `quality: 'high'` to keep full detail, or `'low'` to have it for everything.

## Assemblies

Copies drawn with `showRelated` share the geometry of the original, so a virus capsid of 60 copies of a small asymmetric unit draws quickly. Surfaces are the exception: they are computed over all copies.

## Other tips

- `lines` and `points` are the cheapest styles for all atoms.
- Antialiasing and ambient occlusion are on by default. They cost per pixel of the canvas, not per atom: on a laptop's integrated GPU, the two together add 1–2 ms per frame at 1100×800 and 6–8 ms at full screen, whatever is drawn. That matters only when drawing is slow already, such as all atoms of a large assembly as spheres. Then `antialias: false` (only when creating the viewer) and `viewer.options('ssao', false)` (any time) win back that time.
