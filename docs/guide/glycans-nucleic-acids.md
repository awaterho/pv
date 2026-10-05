# Glycans and nucleic acids

Two add-ons draw sugars and bases in the forms people know them by:

- **`pv.snfg`** draws each sugar of a glycan as its [3D-SNFG](https://www.ncbi.nlm.nih.gov/glycans/snfg.html) symbol (a blue cube for GlcNAc, a green sphere for mannose, …), joined by sticks.
- **`pv.rings`** fills the rings of residues with flat polygons, and draws DNA and RNA bases as filled, outlined rings in their base's color.

Both are built on PV's public [custom mesh](./custom-meshes) API, and draw into a custom mesh of the name you give them.

## Glycans

```js
pv.io.fetchCif('https://files.rcsb.org/download/4BYH.cif').then(function (structure) {
  viewer.cartoon('protein', structure);
  viewer.licorice('glycans', structure.select('carbohydrate'), { color: pv.snfg.color() });
  pv.snfg.draw(viewer, 'symbols', structure);
  viewer.autoZoom();
});
```

`pv.snfg.draw(viewer, name, structure, options)` puts a symbol on every sugar, centered on its ring and turned so that its base points at the residue it is attached to, and joins linked sugars with sticks. Options:

| Option | Default | |
|---|---|---|
| `size` | 1.5 | Radius of the symbols, about in Å |
| `linkRadius` | 0.2 | Radius of the sticks |
| `linkColor` | `'grey'` | Color of the sticks |
| `showRelated` | `'asym'` | Or the name of a [biological assembly](./assemblies) |

Sugars are recognized by the SNFG name in the mmCIF file, then by a table of about 35 common chemical component ids (NAG, MAN, BMA, FUC, GAL, SIA, …). A sugar without a known symbol is a white hexagon.

`pv.snfg.color(others)` is a [color operation](./coloring) that colors sugars in their SNFG color and everything else with `others` (default `pv.color.byElement()`).

## Filled rings

```js
viewer.licorice('ligands', structure.select('ligand'));
pv.rings.draw(viewer, 'rings', structure.select('ligand'));
```

`pv.rings.draw(viewer, name, structure, options)` fills every ring of every residue in `structure`: sugars in their SNFG color, other rings grey. It goes with a licorice, balls-and-sticks or lines display of the same atoms. Options: `color` (a color, or a function of the residue returning one) and `showRelated`.

## DNA and RNA bases

```js
viewer.cartoon('structure', structure, { baseSticks: false });
pv.rings.drawBases(viewer, 'bases', structure, { sticks: true });
```

`pv.rings.drawBases(viewer, name, structure, options)` draws the base of every nucleotide of a DNA or RNA chain as filled rings with a grey outline: A red, G green, C yellow, U and T blue, and modified bases like the base they derive from. With `sticks: true`, a stick in the base's color joins it to the backbone tube of the cartoon, so turn the cartoon's own base sticks off. Free nucleotides, such as ATP, are not drawn: they are ligands.

| Option | Default | |
|---|---|---|
| `color` | by base | A color, or a function of the residue returning one; `pv.rings.baseColor(residue)` is the default |
| `sticks` | `false` | A stick from the backbone to each base |
| `stickRadius` | 0.3 | |
| `outlineRadius` | 0.12 | |
| `showRelated` | `'asym'` | Or the name of a biological assembly |

## Updating

These functions add a new mesh each time they are called. Remove the old one first when you draw again: `viewer.rm('symbols')`.

## Picking

A pick on a symbol, a ring or a base returns an atom of its residue as `target()`, so you can show the residue it belongs to. See [Picking the add-ons' meshes](./interaction#picking-the-add-ons-meshes).
