# Biological assemblies

A crystal structure's file usually holds the asymmetric unit, which may be less, or more, than the molecule as it is in the cell. The biological assembly, how to build that molecule from the file's chains by rotating and moving copies of them, is in the file too: in `REMARK 350` of PDB files and the `pdbx_struct_assembly` tables of mmCIF files.

## Drawing an assembly

Give the assembly's name as `showRelated`:

```js
pv.io.fetchCif('https://files.rcsb.org/download/2POR.cif').then(function (structure) {
  viewer.cartoon('porin', structure, { showRelated: '1' });
  viewer.autoZoom();
});
```

The file of the porin 2POR has one chain; assembly 1 is the trimer. The copies are drawn from the same geometry, so they cost little memory. Every render style takes `showRelated`, as do [surfaces](./surfaces) and the [pv.rings and pv.snfg](./glycans-nucleic-acids) add-ons. Use the same name for all of them.

`showRelated: 'asym'`, the default, draws the atoms as they are in the file. To switch an object you have already drawn, call `obj.setShowRelated('1')` and `viewer.requestRedraw()`.

## Which assemblies there are

```js
structure.assemblies().forEach(function (assembly) {
  console.log(assembly.name());           // '1', '2', ...
});
const assembly = structure.assembly('1'); // or null
```

An assembly consists of generators: each applies a list of matrices (`generator.matrices()`, 4×4) to a list of chains (`generator.chains()`).

## Picking a copy

Picks report which copy was hit as `picked.symIndex()`, and `picked.pos()` is where the atom is in that copy. Pass the index to `setHover` to highlight only that copy, and get the copy's matrix with `obj.symWithIndex(index)`. See [Picking, hover and selection](./interaction).

Selections and colors apply to all copies alike, since they are copies of the same atoms.
