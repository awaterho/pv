# Transparency and effects

## Transparency

`setOpacity` makes a render object, or part of it, transparent:

```js
const cartoon = viewer.cartoon('protein', structure);
cartoon.setOpacity(0.4);
cartoon.setOpacity(1, structure.select({ cname: 'A' }));  // chain A opaque again
viewer.requestRedraw();
```

Opacity runs from 0 (invisible) to 1 (opaque). For the trace-based styles it is set per residue. Fully transparent parts can't be picked. A color with an alpha below 1 makes things transparent as well, in [color operations](./coloring) and in [custom meshes](./custom-meshes).

Transparent geometry is blended with weighted, order-independent transparency, so overlapping transparent objects look right however they are arranged. It needs two WebGL2 extensions that most browsers have (`EXT_color_buffer_float` and `OES_draw_buffers_indexed`); without them, transparent parts are blended in the order they are drawn.

`colorBy` sets the opacity too, to that of its colors (opaque for the built-in operations), so call `setOpacity` again after recoloring.

## Outline

A dark outline around the silhouettes of objects, and around a [selection](./interaction#selection) in the selection color. On by default.

| Option | Default | |
|---|---|---|
| `outline` | `true` | On or off; also `viewer.options('outline', false)` |
| `outlineWidth` | 1.5 | In pixels |
| `outlineColor` | `'black'` | Also `viewer.options('outlineColor', 'grey')` |

Lines, points and labels have no outline, and transparent parts don't either.

## Fog

Things further back fade into the background color, on by default. Turn it off with the option `fog: false`, or `viewer.options('fog', false)`.

## Ambient occlusion

Screen-space ambient occlusion darkens creases and pockets, for a more solid look. Off by default.

```js
const viewer = pv.Viewer(element, { ssao: true, ssaoRadius: 2, ssaoIntensity: 1 });
viewer.options('ssao', false);
```

`ssaoRadius` is in Å.

## Antialiasing

With `antialias: true`, PV draws the scene at twice the size and scales it down, which smooths edges at a cost in speed. Leave it off for very large structures on slow devices.

## Background

The `background` option sets the background color (default white), which the fog fades to: `viewer.options('background', 'black')`.

## Screenshots

`viewer.imageData()` returns the current image as a PNG data URL, for a download link or an `<img>`. With `antialias` it is twice the canvas size.

```js
const link = document.createElement('a');
link.href = viewer.imageData();
link.download = 'structure.png';
link.click();
```
