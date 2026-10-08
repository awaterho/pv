# Picking, hover and selection

PV tells you what is under the mouse or a finger and highlights what you choose, but leaves the decisions to you: which events to react to, what to highlight, what to show about it.

## Events

```js
viewer.on('click', function (picked, event) {
  if (picked === null) return;           // clicked on the background
  const atom = picked.target();
  console.log(atom.qualifiedName());     // e.g. "A.ASP23.CA"
});
```

| Event | When | Callback |
|---|---|---|
| `viewerReady` | The viewer is set up (immediately, if it already is) | `(viewer)` |
| `click` | A click, or a tap | `(picked, event)` |
| `doubleClick` | A double click or double tap | `(picked, event)` |
| `longPress` | A finger held still for half a second (touch only) | `(picked, event)` |
| `viewpointChanged` | The camera moved | `(camera)` |
| `mousemove`, `mousedown`, `mouseup` | The canvas's own mouse events | `(event)` |
| `keydown`, `keyup`, `keypress` | Key events while the viewer has focus | `(event)` |

`picked` is `null` when nothing was hit. Double-clicking centers the camera on the atom. Replace that with the `doubleClick` option, `pv.Viewer(element, { doubleClick: function (picked, event) { ... } })`, or turn it off with `doubleClick: null`.

## What was picked

`picked.target()` is the atom that was hit, for every molecular render style. Its other methods:

| Method | Returns |
|---|---|
| `target()` | The atom; for a [custom mesh](./custom-meshes), the `userData` of the shape |
| `pos()` | The position that was hit, as a `vec3` (for a symmetry copy, where the copy is) |
| `node()` | The render object that was hit |
| `symIndex()` | Which copy of a [biological assembly](./assemblies) was hit, or `null` |
| `connectivity()` | `'full'` for the atom-based styles, `'trace'` for the trace-based ones |

For the trace-based styles (cartoon, tube, trace, …), the atom is the CA or C3' of the residue; use `picked.target().residue()`.

## Hover

There is no hover event: pick on `mousemove` yourself, with `viewer.pick`, and highlight with `setHover`:

```js
let hovered = null;
viewer.on('mousemove', function (event) {
  const rect = viewer.boundingClientRect();
  const picked = viewer.pick({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  if (hovered) hovered.setHover(null);
  hovered = null;
  // render objects of a structure; custom meshes have their own setHover
  if (picked !== null && typeof picked.node().structure === 'function') {
    const residue = picked.target().residue();
    hovered = picked.node();
    hovered.setHover(hovered.structure().residueSelect(function (r) {
      return r.full() === residue.full();
    }), picked.symIndex());
  }
  viewer.requestRedraw();
});
```

`setHover(selection, symIndex)` tints the selection with the viewer's `hoverColor`. With the `symIndex` of the pick, only the copy under the mouse is tinted. `setHover(null)` removes it.

## Selection

`setSelection(selection)` tints a selection with the `selectionColor` and outlines it, until you change it:

```js
const cartoon = viewer.cartoon('protein', structure);
viewer.on('click', function (picked) {
  if (picked === null) return;
  const residue = picked.target().residue();
  cartoon.setSelection(structure.residueSelect(function (r) { return r.full() === residue.full(); }));
  viewer.requestRedraw();
});
```

`obj.selection()` returns the current selection. To change it, build a new selection and set it again; to clear it, set an empty one: `cartoon.setSelection(structure.createEmptyView())`.

The tints mix with the object's own colors. Set their color and strength with the viewer options `hoverColor` (default `'#f93'`) and `selectionColor` (default `'#3f3'`); the alpha of the color is the strength, 0.7 for a color without one.

See the [hover and select sample](/samples/hover-select).

## Picking the add-ons' meshes

The meshes of [pv.rings and pv.snfg](./glycans-nucleic-acids) report an atom of the residue as `target()`, but they have no hover or selection of their own: a pick on an SNFG symbol, a filled ring or a base should highlight the residue in the render object that shows it. Name that object with `picksFor`, and picks on the overlay come back as picks on it:

```js
viewer.cartoon('protein', structure);
viewer.licorice('ligand', structure.select('ligand'));
pv.rings.drawBases(viewer, 'bases', structure, { sticks: true, picksFor: 'protein' });
pv.snfg.draw(viewer, 'glycans', structure, { picksFor: 'ligand' });
pv.rings.draw(viewer, 'rings', structure.select('ligand'), { picksFor: 'ligand' });
```

A pick on one of those meshes then has the cartoon or the licorice as its `node()`, with the `symIndex()` and `transform()` of the copy that was hit, so the hover and selection code above needs to know nothing about the overlays. The mesh itself is still there as `pickedNode()`.

Any object takes it, not just the add-ons' — `obj.picksFor('protein')`, with a name, an object, or a list of either, of which the first one in the viewer wins (`['protein', 'structure']` covers two styles that name the polymer differently). Names are looked up when the pick happens, so the render object may be redrawn under the same name; if none of them is in the viewer the pick is reported on the mesh itself.

The overlays' own shapes are tinted through `setHover(test)` and `setSelection(test)` with the `userData` atom, see [custom meshes](./custom-meshes).
