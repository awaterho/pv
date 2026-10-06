# Camera

The camera looks at a center point from a distance (the zoom), in a direction set by a rotation.

## Pointing it at things

```js
viewer.autoZoom();                            // everything visible
viewer.fitTo(structure.select({ cname: 'A' }));
viewer.centerOn(structure.select('ligand'));  // keeps the zoom
```

`autoZoom()` and `fitTo(what)` set the center and the zoom so that everything visible, or `what` (a render object, a structure, a selection, or an array of structures and selections), is in view. `centerOn` only moves the center.

All camera calls take a duration in milliseconds as their last argument and then move smoothly: `viewer.fitTo(selection, 500)`. Without it, `fitTo` and `autoZoom` use the viewer's `animateTime` option (default 500) and the others are immediate.

## Setting it directly

| Method | Does |
|---|---|
| `setCamera(rotation, center, zoom, ms)` | All three at once |
| `setRotation(rotation, ms)` | `rotation` is a 3×3 or 4×4 matrix, as an array of 9 or 16 numbers |
| `setCenter(center, ms)` | `center` is `[x, y, z]` |
| `setZoom(zoom, ms)` | The distance from the camera to the center, in Å |
| `rotate(axis, angle, ms)` | Rotates about an axis in screen space, by an angle in radians |
| `translate(vector, ms)` | Moves the center by a vector in screen space |
| `rotation()`, `center()`, `zoom()` | The current values; copy `rotation()` and `center()` before keeping them, they change as the camera moves |

After `setCenter` and `setZoom` without a duration, call `viewer.requestRedraw()`.

To save a view and come back to it:

```js
const saved = { rotation: Array.from(viewer.rotation()),
                center: Array.from(viewer.center()), zoom: viewer.zoom() };
// later
viewer.setCamera(saved.rotation, saved.center, saved.zoom, 500);
```

`pv.viewpoint.principalAxes(obj)` returns a rotation that lines a render object's longest extent up with the screen's x axis: `viewer.setRotation(pv.viewpoint.principalAxes(cartoon))`.

## Motion

```js
viewer.spin(true);           // a slow turn about the vertical axis
viewer.spin(0.5, [1, 0, 0]); // 0.5 radians a second about the x axis
viewer.spin(false);
viewer.rockAndRoll(true);    // rock back and forth
```

## Clipping

Nothing nearer to the camera than the near clipping plane, or further than the far one, is drawn. Both are distances from the camera, in Å; the camera is `viewer.zoom()` Å from the center.

By default (`viewer.slabMode('auto')`), PV sets them every frame so that everything visible is between them. `viewer.slabMode('fixed', { near, far })` fixes them instead, for example to cut a 10 Å slice through the middle and look inside:

```js
const z = viewer.zoom();
viewer.slabMode('fixed', { near: z - 5, far: z + 5 });
// and back
viewer.slabMode('auto');
```

The planes stay at their distance from the camera, so zooming moves the slice through the structure; set them again after zooming to keep it at the center.

## Size

The canvas is the size of the `width` and `height` options. `viewer.resize(width, height)` changes it, and `viewer.fitParent()` makes it the size of the element the viewer is in; PV doesn't follow changes in the page's size by itself:

```js
window.addEventListener('resize', function () { viewer.fitParent(); });
```
