# Render styles

Every render style is a viewer method with the same shape:

```js
const obj = viewer.cartoon(name, structure, options);
```

It draws `structure` (a whole structure, or a [selection](./selections) of one) and adds the result to the scene under `name`. The returned [render object](/api/render-objects) can be recolored, made transparent or highlighted later without drawing it again. To change the style, remove the object (`viewer.rm(name)`) and draw it anew.

You can draw the same atoms in several styles, and different parts in different styles:

```js
viewer.cartoon('protein', structure);
viewer.licorice('ligands', structure.select('ligand'));
viewer.ballsAndSticks('site', structure.select({ rnums: [12, 13, 88] }));
```

## The styles

| Style | Draws | Default color |
|---|---|---|
| `cartoon` | Helices as spirals, strands as arrows, coil as a tube. DNA and RNA as a tube with a stick for each base. | by secondary structure |
| `tube` | The backbone as a smooth tube of one radius | by secondary structure |
| `trace` | Straight cylinders between consecutive CA atoms | red |
| `sline` | The backbone as a smooth line | magenta |
| `lineTrace` | Straight lines between consecutive CA atoms | magenta |
| `lines` | Every bond as a line; atoms without bonds as small crosses | by element |
| `points` | Every atom as a point | by element |
| `spheres` | Every atom as a sphere | by element |
| `ballsAndSticks` | Atoms as spheres, bonds as cylinders; double and triple bonds as two or three thinner cylinders | by element |
| `licorice` | Atoms and bonds as sticks of one radius | by element |
| `surface` | The molecular surface; see [Surfaces](./surfaces) | by element |

The trace-based styles (cartoon, tube, trace, sline, lineTrace) draw only the polymer residues, along their backbone traces: one point per residue, at the CA of an amino acid and the C3' of a nucleotide. The others draw the atoms you give them.

`viewer.renderAs(name, structure, mode, options)` calls a style by its name, given as a string, for all styles but `surface`.

## Options

All styles take:

| Option | Default | Meaning |
|---|---|---|
| `color` | see above | A [color operation](./coloring), e.g. `pv.color.byChain()`. Not a plain color: write `pv.color.uniform('red')` for one color. |
| `showRelated` | `'asym'` | `'asym'` for the atoms as in the file, or the name of a [biological assembly](./assemblies) to draw all its copies. |

The style-specific options, with their defaults:

| Style | Options |
|---|---|
| `cartoon` | `radius` 0.3 (of the coil tube), `strength` 1 (of the spline smoothing), `forceTube` false (draw everything as a tube), `smoothStrands` true, `baseSticks` true (the sticks of DNA and RNA bases) |
| `tube` | as `cartoon`, with `forceTube` always true |
| `trace` | `radius` 0.3 |
| `sline` | `lineWidth` 4 (pixels), `strength` 1 |
| `lineTrace`, `lines` | `lineWidth` 4 (pixels) |
| `points` | `pointSize` 1 |
| `spheres` | `radiusMultiplier` 1 (the spheres have a radius of 1.5 Å times this, for every element) |
| `ballsAndSticks` | `cylRadius` 0.1, `sphereRadius` 0.2, `radius` (sets both), `scaleByAtomRadius` true (scales the spheres by the element's van der Waals radius) |
| `licorice` | `radius` 0.2 |

## Detail

Curved geometry is made of a number of segments that the viewer's `quality` option sets: `'high'`, `'medium'` or `'low'`. The default, `'auto'`, means high detail, and low detail for structures with more than 50,000 residues to draw. A style call can set its own detail with `arcDetail`, `sphereDetail` and `splineDetail`, and `viewer.quality('medium')` changes it for everything drawn afterwards.

## Nucleic acids

`cartoon` draws DNA and RNA as a tube along the phosphate backbone with a stick for each base. For filled base rings in the base's color, as in the [demo](https://awaterho.github.io/pv/demo/), turn the sticks off and add `pv.rings.drawBases`:

```js
viewer.cartoon('structure', structure, { baseSticks: false });
pv.rings.drawBases(viewer, 'bases', structure, { sticks: true });
```

See [Glycans and nucleic acids](./glycans-nucleic-acids).

## Managing objects

| Method | Does |
|---|---|
| `viewer.get(name)` | Returns the object of that name, or `null` |
| `viewer.rm(pattern)` | Removes the matching objects |
| `viewer.hide(pattern)`, `viewer.show(pattern)` | Hides or shows them; hidden objects are not drawn, picked or zoomed to |
| `viewer.forEach(pattern, callback)` | Calls `callback(obj)` for each matching object |
| `viewer.all()` | All objects |
| `viewer.clear()` | Removes everything |

A pattern is a name, or a name with `*`, such as `'structure.*'`. Only the first `.` and the first `*` of a pattern are treated as such, so keep patterns to one of each.

After `rm`, `hide`, `show` and `clear`, call `viewer.requestRedraw()` to see the change. Drawing a new object redraws by itself.
