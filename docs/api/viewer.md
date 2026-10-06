# pv.Viewer

```js
const viewer = pv.Viewer(element, options);
```

Creates a viewer in `element`: a canvas of the given size, with mouse, touch and keyboard handling. `pv.Viewer` is a function; `new` is not needed. `pv.isWebGLSupported()` returns whether the browser has WebGL2.

## Options

| Option | Default | |
|---|---|---|
| `width`, `height` | 500 | Size in CSS pixels, or `'auto'` for the size of `element` |
| `antialias` | `true` | Draw at twice the size and scale down, for smooth edges. Only when the viewer is created. |
| `quality` | `'auto'` | Detail of curved geometry: `'high'`, `'medium'`, `'low'`, or `'auto'` (high, and low above 50,000 residues) |
| `background` | `'white'` | Background color, also the color of the fog |
| `fog` | `true` | Fade things further back into the background |
| `outline` | `true` | Outline silhouettes |
| `outlineColor` | `'black'` | |
| `outlineWidth` | 1.5 | In pixels |
| `ssao` | `true` | Screen-space ambient occlusion |
| `ssaoRadius` | 3 | In Å |
| `ssaoIntensity` | 0.7 | |
| `selectionColor` | `'#3f3'` | Tint of selections; the alpha is its strength, 0.7 for a color without alpha |
| `hoverColor` | `'#f93'` | Tint of hovered parts, likewise |
| `fov` | 45 | Vertical field of view, in degrees |
| `animateTime` | 500 | Duration of `fitTo` and `autoZoom`, and of double-click centering, in ms |
| `slabMode` | `'auto'` | Near and far clipping: `'auto'` keeps everything visible in between, `'fixed'` uses 0.1 and 400 |
| `click` | | A `click` listener |
| `doubleClick` | `'center'` | A `doubleClick` listener; the default centers on the picked atom, `null` turns it off |
| `noKeyboardGrab` | `false` | Don't take key events (then `on('keydown')` and the other key events can't be used) |

`viewer.options(name)` returns an option, `viewer.options(name, value)` changes it. Changing `fog`, `outline`, `outlineColor`, `outlineWidth`, `background`, `fov`, `selectionColor`, `hoverColor`, `slabMode` and the `ssao` options takes effect. `viewer.quality(q)` changes the detail of what is drawn afterwards.

## Render styles

Each draws `structure` (a structure or a selection), adds it to the scene under `name` and returns the [render object](./render-objects). See [Render styles](/guide/render-styles) for the options.

| Method | |
|---|---|
| `cartoon(name, structure, options)` | |
| `tube(name, structure, options)` | |
| `trace(name, structure, options)` | |
| `sline(name, structure, options)` | |
| `lineTrace(name, structure, options)` | |
| `lines(name, structure, options)` | |
| `points(name, structure, options)` | |
| `spheres(name, structure, options)` | |
| `ballsAndSticks(name, structure, options)` | |
| `licorice(name, structure, options)` | |
| `surface(name, structure, options)` | Returns a promise of the object; see [Surfaces](/guide/surfaces) |
| `renderAs(name, structure, mode, options)` | One of the above by name (not `surface`) |
| `customMesh(name)` | An empty [custom mesh](/guide/custom-meshes) |
| `label(name, text, position, options)` | A [text label](/guide/custom-meshes#labels) |

## Objects

| Method | |
|---|---|
| `get(name)` | The object of that name, or `null` |
| `add(name, obj)` | Adds an object |
| `rm(pattern)` | Removes the objects matching `pattern` (a name, or with one `*`) |
| `hide(pattern)`, `show(pattern)` | Hides or shows them |
| `forEach(pattern, callback)` | Calls `callback(obj, index)` for each; `pattern` can be left out |
| `all()` | All objects |
| `clear()` | Removes all objects |

## Camera

All take an optional duration in ms as their last argument. See [Camera](/guide/camera).

| Method | |
|---|---|
| `autoZoom(ms)` | Center and zoom on everything visible |
| `fitTo(what, ms)` | Center and zoom on a render object, a structure, a selection, or an array of structures and selections |
| `centerOn(what, ms)` | Center on a structure or selection, keeping the zoom |
| `setCamera(rotation, center, zoom, ms)` | |
| `setRotation(rotation, ms)` | A 3×3 or 4×4 matrix as 9 or 16 numbers |
| `setCenter(center, ms)` | |
| `setZoom(zoom, ms)` | Distance from the camera to the center, in Å |
| `rotate(axis, angle, ms)`, `translate(vector, ms)` | In screen space |
| `rotation()`, `center()`, `zoom()` | The current values (the first two change as the camera moves; copy them to keep them) |
| `spin(speed, axis)` | `true` for a slow turn, a speed in radians per second, or `false` to stop; without arguments, whether it spins |
| `rockAndRoll(on)` | Rock back and forth; without arguments, whether it does |
| `slabMode(mode, { near, far })` | `'auto'` or `'fixed'` |

## Events and picking

| Method | |
|---|---|
| `on(event, callback)` | Adds a listener; also `addListener`. See [the events](/guide/interaction#events). |
| `pick({ x, y })` | What is at a point of the canvas, in CSS pixels from its top left, or `null` |
| `boundingClientRect()` | The canvas's position on the page, to turn mouse coordinates into canvas ones |

`pick` returns an object with:

| Method | |
|---|---|
| `target()` | The atom, or the `userData` of a custom mesh's shape |
| `pos()` | Where it was hit, a `vec3` |
| `node()` | The render object |
| `symIndex()` | The copy of a biological assembly, or `null` |
| `connectivity()` | `'full'`, `'trace'` or `'unknown'` (custom meshes) |

## Drawing and size

| Method | |
|---|---|
| `requestRedraw()` | Draw again on the next frame. Needed after `colorBy`, `setOpacity`, `setSelection`, `setHover`, `rm`, `hide`, `show`, `clear` |
| `resize(width, height)` | |
| `fitParent()` | Resize to the element the viewer is in |
| `imageData()` | The current image as a PNG data URL |
| `destroy()` | Removes everything and the canvas |
| `ok()` | Whether WebGL2 was set up |
| `gl()` | The WebGL2 context |
