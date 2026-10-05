# Custom meshes and labels

## Custom meshes

A custom mesh holds shapes you add yourself: tubes, spheres and triangles. Use it to show what the structure doesn't contain, such as a distance, an axis, a membrane, or a pocket.

```js
const mesh = viewer.customMesh('marks');
mesh.addTube([0, 0, 0], [10, 0, 0], 0.3, { color: 'red' });
mesh.addSphere([10, 0, 0], 1, { color: 'blue' });
viewer.requestRedraw();
```

| Method | Adds |
|---|---|
| `addTube(start, end, radius, options)` | A cylinder from `start` to `end`; `cap: false` leaves its ends open |
| `addSphere(center, radius, options)` | A sphere |
| `addTriangles(positions, options)` | Triangles: `positions` has 9 numbers per triangle, the corners in counter-clockwise order seen from the front |

Their options:

| Option | Default | |
|---|---|---|
| `color` | `'white'` | Any [color](./coloring#specifying-a-color); an alpha below 1 makes the shape transparent |
| `userData` | `null` | What a pick on the shape returns as `target()` |
| `triangleColors` | | (`addTriangles`) A color for each triangle |
| `normals` | | (`addTriangles`) A normal for each corner, laid out as `positions`, for smooth shading; without them each triangle is flat |
| `copy` | `null` | A symmetry copy number, reported by picks as `symIndex()` |

All the triangles of one `addTriangles` call form one shape, for picking and highlighting. Positions are in Å, in the same coordinates as the structure.

### Picking and highlighting

A pick on a shape returns its `userData` as `picked.target()` and the mesh as `picked.node()`. To highlight shapes, pass a test of their `userData`:

```js
mesh.addSphere(center, 1, { color: 'orange', userData: { site: 'A' } });

viewer.on('click', function (picked) {
  const site = picked && picked.node() === mesh ? picked.target() : null;
  mesh.setSelection(site ? function (data) { return data === site; } : null);
  viewer.requestRedraw();
});
```

`setHover(test, copy)` does the same with the hover color. Shapes without `userData` are never highlighted.

### Opacity

`mesh.setOpacity(alpha)` sets the opacity of everything added so far. For a mesh that is partly transparent, give those shapes a color with alpha, or put them in a second mesh.

The mesh counts towards `autoZoom()`. To change a mesh, remove it with `viewer.rm(name)` and build it anew. See the [custom mesh sample](/samples/custom-mesh).

## Labels

`viewer.label(name, text, position, options)` puts text at a point in space. It always faces the screen and keeps its size in pixels as you zoom.

```js
const atom = structure.atom('A.31.CA');
viewer.label('label', 'Tyr 31', atom.pos(), { fontSize: 16, fontColor: '#333' });
```

| Option | Default | |
|---|---|---|
| `font` | `'Verdana'` | |
| `fontSize` | 24 | In pixels |
| `fontStyle` | `'normal'` | E.g. `'bold'`, `'italic bold'` |
| `fontColor` | `'#000'` | A CSS color |
| `fillStyle` | `'#000'` | Color of the background box |
| `backgroundAlpha` | 0 | Opacity of the background box |

Labels can't be picked, and don't count towards `autoZoom()`. To change the text, remove the label and add a new one. For text fixed on the screen rather than in space, put an HTML element over the viewer. See the [labels sample](/samples/labels).
