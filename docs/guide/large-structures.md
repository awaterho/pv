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

- `antialias: true` draws at twice the size; leave it off on slow devices.
- `lines` and `points` are the cheapest styles for all atoms.
- Ambient occlusion (`ssao`) costs two extra passes per frame.
