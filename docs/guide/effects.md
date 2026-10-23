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

Opacity is kept apart from the color, so `colorBy` no longer resets it: set a residue opaque once and it stays opaque through any number of recolorings. Where an opacity was set it wins over the alpha of the colors; everywhere else the colors' own alpha applies. `setOpacity(null, selection)` drops the opacity again, handing that selection back to its colors:

```js
cartoon.setOpacity(0.4);
cartoon.setOpacity(1, structure.select({ cname: 'A' }));
cartoon.colorBy(color.bySS());        // chain A is still opaque
cartoon.setOpacity(null);             // back to the alpha of bySS()
viewer.requestRedraw();
```

Transparent geometry is blended with weighted, order-independent transparency, so overlapping transparent objects look right however they are arranged. It needs two WebGL2 extensions that most browsers have (`EXT_color_buffer_float` and `OES_draw_buffers_indexed`); without them, transparent parts are blended in the order they are drawn.

## Spotlight

`viewer.spotlight(target, options)` fades everything except what is near `target`, to show a binding site or a region in its context:

```js
const site = structure.select({ cname: 'A', rnums: [39, 42, 88] });
viewer.spotlight([site, ligand], { radius: 5 });
viewer.spotlight(null);  // off again
```

`target` is a structure, a selection, a point (`[x, y, z]`), or a list of them, so several separate regions can be lit at once.

| Option | Default | |
|---|---|---|
| `radius` | 5 | Everything within this many Å of an atom of `target` stays as it is |
| `falloff` | 3 | Over this many Å further out, it fades to `opacity` |
| `opacity` | 0.2 | Of everything further away |
| `objects` | `'*'` | The objects it applies to: a name, or with one `*`, or a list of them |

`objects` is matched by name each time the scene is drawn, so an object that is removed and added again under the same name (to change its render style, for example) stays in the spotlight. Objects that don't match, such as the residues drawn as sticks around a ligand, aren't faded.

The fade is done in the shaders, from the distance of each point to `target`, so it is smooth across a cartoon or surface, and `colorBy` doesn't undo it. It is measured in the scene, so each copy of a [biological assembly](./assemblies) fades by where it is. `target` is held as up to 128 spheres: one per atom when they fit, otherwise around a few bonded atoms each, then around whole residues, then around runs of residues. So the larger the target, the coarser the edge of the lit region; a few dozen residues still measure to within about an Å of their atoms.

## Outline

A dark outline around the silhouettes of objects, and around a [selection](./interaction#selection) in the selection color. Off by default. Sticks and spheres small on screen get a darker shade of their own color instead of black, so zoomed-out structures keep their colors.

| Option | Default | |
|---|---|---|
| `outline` | `false` | On or off; also `viewer.options('outline', true)` |
| `outlineWidth` | 1.5 | In pixels |
| `outlineColor` | `'black'` | Also `viewer.options('outlineColor', 'grey')` |

Lines, points and labels have no outline, and transparent parts don't either.

## Fog

Things further back fade into the background color, on by default. Turn it off with the option `fog: false`, or `viewer.options('fog', false)`.

## Ambient occlusion

Screen-space ambient occlusion darkens creases and pockets, for a more solid look. On by default, with a radius of 3 Å and an intensity of 0.7.

```js
const viewer = pv.Viewer(element, { ssaoRadius: 2, ssaoIntensity: 1 });
viewer.options('ssao', false);
```

`ssaoRadius` is in Å.

## Antialiasing

By default, PV draws the scene at twice the size and scales it down, which smooths edges. Turn it off with `antialias: false` when creating the viewer; it can't be changed afterwards. See [Large structures](./large-structures#other-tips) for what it costs.

## Background

The `background` option sets the background color (default white), which the fog fades to: `viewer.options('background', 'black')`.

## Screenshots

`viewer.imageData()` returns the current image as a PNG data URL, for a download link or an `<img>`. With `antialias`, the default, it is twice the canvas size.

```js
const link = document.createElement('a');
link.href = viewer.imageData();
link.download = 'structure.png';
link.click();
```
