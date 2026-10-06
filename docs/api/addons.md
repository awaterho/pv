# Add-ons

`pv.snfg`, `pv.rings` and `pv.membrane` are built on PV's public API. See [Glycans and nucleic acids](/guide/glycans-nucleic-acids) and the [membrane sample](/samples/membrane) for examples. Their drawing functions add a render object of the given name, usually a [custom mesh](/guide/custom-meshes), and return it; remove an old one first with `viewer.rm(name)`.

## pv.snfg

| Function | |
|---|---|
| `draw(viewer, name, structure, options)` | A 3D-SNFG symbol for every sugar of `structure`, and sticks between linked ones |
| `color(others)` | A color operation: sugars in their SNFG color, other atoms by `others` (default `pv.color.byElement()`) |
| `symbol(residue)` | `{ shape, color }` of a sugar, or `null` |
| `snfgName(residue)` | The sugar's SNFG name, e.g. `'GlcNAc'`; `null` for a sugar without one; `undefined` for anything else |
| `isSugar(residue)` | Whether it is a sugar |

`draw` options: `size` (1.5), `linkRadius` (0.2), `linkColor` (`'grey'`), `showRelated` (`'asym'`). Picks on a symbol return its ring oxygen as `target()`.

## pv.rings

| Function | |
|---|---|
| `draw(viewer, name, structure, options)` | Fills every ring of every residue of `structure` |
| `drawBases(viewer, name, structure, options)` | The bases of the nucleotides of DNA and RNA chains as filled, outlined rings |
| `baseColor(residue)` | The default base color: A red, G green, C yellow, U and T blue; modified bases as the base they derive from |
| `findRings(residue, maxSize)` | The rings of a residue, each an array of its atoms in order; `maxSize` defaults to 8 |

`draw` options: `color` (a color, or a function of the residue; sugars in SNFG colors and other rings grey by default), `showRelated`.

`drawBases` options: `color` (`baseColor` by default), `sticks` (`false`), `stickRadius` (0.3), `outlineRadius` (0.12), `showRelated`.

Picks return an atom of the residue as `target()`.

## pv.membrane

The membrane around a membrane protein: two parallel planes bounding the hydrophobic core of the lipid bilayer, as predicted by e.g. PPM for the OPM database. A membrane is an object with these fields; others, such as `viewTransform`, are ignored.

| Field | |
|---|---|
| `axis` | The membrane's normal |
| `plane_one_center`, `plane_two_center` | The centers of the two planes |
| `radius` | The radius of the protein's cross-section in them |
| `width` | The distance between the planes; taken from the centers when missing |

| Function | |
|---|---|
| `draw(viewer, name, structure, membrane, options)` | The membrane in one of the styles below. The atoms of `structure` cut it out or outline it where they cross it |
| `color(membrane, others, options)` | A color operation: atoms in the hydrophobic core light orange, in the headgroup layers either side of it red, the others by `others` (default light grey) |
| `depth(membrane, pos)` | The signed distance of `pos` from the middle of the membrane along its axis; within ±`width`/2 is the core |

`draw` styles (the `style` option):

| Style | |
|---|---|
| `'dots'` (default) | A grid of points on each plane, left out where the protein is. Returns a points render object of a structure of its own |
| `'flatDots'` | A finer grid of flat dots, fading towards the edge |
| `'plane'` | Translucent discs, with an outline of the protein's cross-section in each. The outline is a lines render object of its own, `name + '.outline'`: remove both with `viewer.rm(name + '*')` |
| `'slab'` | A translucent cylinder between the planes |
| `'rings'` | A circle on each plane, and the axis as an arrow |

`draw` options: `color` and `lineColor` (each style has its own), `radius` (of what's drawn of each plane; the membrane's radius + 8 Å), `spacing` (of the dot grids: 2.25 Å for `'dots'`, 1.5 Å for `'flatDots'`), `clearance` (how close to an atom a dot may lie: 3.5 Å), `pointSize` (of `'dots'`, in pixels: 2), `lineWidth` (of the `'plane'` outline, in pixels: 8), `showRelated` (the symmetry copies of `structure` that cut the membrane: `'asym'` or an assembly name, as for the render styles).

`color` options: `core`, `headgroups` (colors), `headgroupWidth` (5 Å).
