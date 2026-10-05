# Coloring

Colors are given to render styles as **color operations**: objects from `pv.color` that decide each atom's color.

```js
viewer.cartoon('protein', structure, { color: pv.color.byChain() });
```

To change the colors of an object you have already drawn, use `colorBy`, which recolors it in place:

```js
const cartoon = viewer.cartoon('protein', structure);
cartoon.colorBy(pv.color.rainbow());
// only some residues
cartoon.colorBy(pv.color.uniform('red'), structure.select({ rnums: [12, 13, 88] }));
viewer.requestRedraw();
```

## Color operations

| Operation | Colors |
|---|---|
| `uniform(color)` | Everything one color (default white) |
| `byElement()` | By element (carbon grey, nitrogen blue, oxygen red, sulfur yellow, …) |
| `bySS()` | By secondary structure: helix pale blue, strand green, coil light grey |
| `byChain()` | Each chain its own color; ligand and water chains (in mmCIF files) take the color of the polymer chain with the same author chain name |
| `byEntity()` | Each entity its own color, its copies in lighter and darker shades of it |
| `rainbow()` | Along each chain, from blue at the start to red at the end |
| `ssSuccession()` | Each helix and strand its own color along the chain, coil light grey |
| `byAtomProp(name, gradient, range)` | By a property of the atoms, e.g. `'tempFactor'` |
| `byResidueProp(name, gradient, range)` | By a property of the residues |
| `pv.snfg.color()` | Sugars in their SNFG color, all other atoms by element |

Most take arguments to change their colors:

```js
pv.color.uniform('#4e79a7');
pv.color.bySS({ C: 'lightgrey', H: 'red', E: 'yellow' });  // all three keys
pv.color.byChain(['red', 'green', 'blue']);                 // cycled through
pv.color.rainbow(pv.color.gradient(['white', 'darkblue']));
pv.color.byAtomProp('tempFactor', pv.color.gradient('heatmap'), [10, 80]);
```

`byChain()` and `byEntity()` use a palette of 12 colors that stay apart for the common forms of color blindness, `pv.color.CHAIN_PALETTE`.

## Specifying a color

Wherever PV takes a single color, it accepts:

- a name: `white`, `black`, `grey`, `lightgrey`, `darkgrey`, `red`, `green`, `blue`, `yellow`, `cyan`, `magenta`, `orange`, and of each color but the greys a `dark` and a `light` version (`darkred`, `lightblue`, …). Other CSS names, like `purple`, are not known.
- a hex string: `'#f00'`, `'#ff0000'`, or with alpha `'#f008'`, `'#ff000080'`
- an array of numbers from 0 to 1: `[1, 0, 0]`, or with alpha `[1, 0, 0, 0.5]`

A color with an alpha below 1 makes what it colors transparent.

## Gradients

`pv.color.gradient` makes a gradient for `rainbow`, `ssSuccession`, `byChain`, `byAtomProp` and `byResidueProp`:

```js
pv.color.gradient('heatmap');                        // a predefined one
pv.color.gradient(['blue', 'white', 'red']);         // evenly spaced
pv.color.gradient(['blue', 'white', 'red'], [0, 0.2, 1]);
```

The predefined gradients are `rainbow` (blue, green, yellow, red), `reds`, `greens`, `blues`, `trafficlight` (green, yellow, red) and `heatmap` (red, white, blue). Pass the gradient object, not its name: `byAtomProp('tempFactor', pv.color.gradient('reds'))`.

## Coloring by a property

`byAtomProp` and `byResidueProp` color by a number: one of the atom's or residue's own values, or a property you set yourself.

```js
// B-factors, scaled to the range found in the structure
viewer.cartoon('protein', structure, { color: pv.color.byAtomProp('tempFactor') });

// your own per-residue values
structure.eachResidue(function (residue) {
  residue.setProp('conservation', scores[residue.num()] || 0);
});
viewer.cartoon('protein', structure,
               { color: pv.color.byResidueProp('conservation', pv.color.gradient('reds'), [0, 1]) });
```

The atom values are `tempFactor`, `occupancy`, `serial` and `index`; the residue values `num` and `index`. A property that isn't set reads as 0. See the [custom property sample](/samples/custom-property).

## Writing your own

A color operation is a `pv.color.ColorOp` made from a function that writes an atom's color, as red, green, blue and alpha from 0 to 1, into an array:

```js
const hetatmsHalfTransparent = new pv.color.ColorOp(function (atom, out, index) {
  out[index] = 0.3;
  out[index + 1] = 0.5;
  out[index + 2] = 0.9;
  out[index + 3] = atom.isHetatm() ? 0.5 : 1;
});
```

- Always write all four values. An atom you skip keeps whatever color was there before.
- The trace-based styles (cartoon, tube, trace, sline, lineTrace) only ask for one atom per residue, the CA of an amino acid or the C3' of a nucleotide, so color those by residue: `atom.residue()`.
- Two more functions, `begin(structure)` and `end()`, are called before and after a coloring pass, for set-up such as finding a value range. Pass them as the second and third arguments. `this` is the operation in all three, so they can keep state on it:

```js
const byNumber = new pv.color.ColorOp(function (atom, out, index) {
  this.gradient.colorAt(this.rgba, (atom.residue().num() % 10) / 9);
  out[index] = this.rgba[0]; out[index + 1] = this.rgba[1];
  out[index + 2] = this.rgba[2]; out[index + 3] = this.rgba[3];
}, function (structure) {
  this.gradient = pv.color.gradient('trafficlight');
  this.rgba = [0, 0, 0, 1];
});
```

## The palette

`pv.color.setColorPalette(palette)` replaces the color names with your own, an object of names and colors. It replaces all of them, so include every name you use. It doesn't change colors already set, the element colors, the chain palette or the defaults of `bySS`.
