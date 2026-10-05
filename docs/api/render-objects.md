# Render objects

The render styles return render objects, which can be changed after they are drawn. Call `viewer.requestRedraw()` after changing them.

## Of a structure

Returned by `cartoon`, `tube`, `trace`, `sline`, `lineTrace`, `lines`, `points`, `spheres`, `ballsAndSticks`, `licorice` and (through its promise) `surface`.

| Method | |
|---|---|
| `colorBy(colorOp, selection)` | Recolors everything, or the atoms of `selection`. Sets the opacity too, to the colors' alpha. |
| `setOpacity(alpha, selection)` | Opacity from 0 to 1, of everything or of `selection` |
| `setSelection(selection)` | Tints and outlines `selection` in the selection color; an empty selection clears it |
| `selection()` | The current selection |
| `setHover(selection, symIndex)` | Tints `selection` in the hover color, only in copy `symIndex` if given; `null` clears it |
| `hover()` | The current hover selection |
| `structure()` | The structure or selection the object was drawn from |
| `select(what)` | `structure().select(what)` |
| `setShowRelated(name)`, `showRelated()` | The [biological assembly](/guide/assemblies) drawn, or `'asym'` |
| `symWithIndex(index)` | The 4×4 matrix of a copy, as reported by `symIndex()` |
| `eachCentralAtom(callback)` | Calls `callback(atom, position)` for the CA or C3' of every residue, in every copy. `position` is reused between calls; copy it to keep it. |
| `getColorForAtom(atom, out)` | Writes the atom's current color into `out`, an array of 4 |
| `setLineWidth(width)`, `setPointSize(size)` | For `lines`, `lineTrace`, `sline` and `points` |

## All objects

Render objects, custom meshes and labels all have:

| Method | |
|---|---|
| `name()` | |
| `show()`, `hide()`, `visible()` | |
| `order(n)` | Drawing order, lowest first (1 by default, labels 100); takes effect when the object is added |

## Custom meshes

Returned by `viewer.customMesh(name)`. See [Custom meshes](/guide/custom-meshes) for the options.

| Method | |
|---|---|
| `addTube(start, end, radius, options)` | |
| `addSphere(center, radius, options)` | |
| `addTriangles(positions, options)` | |
| `setOpacity(alpha)` | Of everything added so far |
| `setSelection(test)` | Tints the shapes whose `userData` passes `test(userData)`; `null` clears it |
| `setHover(test, copy)` | The same with the hover color |

## Labels

Returned by `viewer.label(name, text, position, options)`. They have only the methods of all objects.
