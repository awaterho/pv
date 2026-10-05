# pv.rings and pv.snfg

See [Glycans and nucleic acids](/guide/glycans-nucleic-acids) for examples. The drawing functions add a [custom mesh](/guide/custom-meshes) of the given name and return it; remove an old one first with `viewer.rm(name)`.

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
