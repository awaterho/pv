<script setup>
import code from '../samples/code/getting-started.js?raw'
</script>

# Getting started

PV shows protein and nucleic-acid structures in a web page with WebGL2. You give it an element to draw in, load a structure, and pick one or more render styles for it.

<PvSample :code="code" />

<<< ../samples/code/getting-started.js

## Adding PV to a page

PV is built as one file in three formats, in `dist/` of the [repository](https://github.com/awaterho/pv):

| File | Use it with |
|---|---|
| `pv.iife.js` | A plain `<script>` tag. Defines the global `pv`. |
| `pv.js` | `import pv from './pv.js'` (ES module). |
| `pv.cjs` | `require('pv')` (CommonJS). |

Build them with `npm install` and `npm run build` in a clone of the repository. `dist/pv.d.ts` has the TypeScript declarations.

A complete page:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>PV</title>
</head>
<body>
  <div id="viewer"></div>
  <script src="pv.iife.js"></script>
  <script>
    const viewer = pv.Viewer(document.getElementById('viewer'),
                             { width: 600, height: 400, antialias: true });
    pv.io.fetchCif('https://files.rcsb.org/download/1AKE.cif').then(function (structure) {
      viewer.cartoon('protein', structure);
      viewer.licorice('ligands', structure.select('ligand'));
      viewer.autoZoom();
    });
  </script>
</body>
</html>
```

PV needs WebGL2, which every current browser has. Without it the viewer element shows a "WebGL not supported" message instead; check beforehand with `pv.isWebGLSupported()`.

## The pieces

- **`pv.Viewer(element, options)`** creates the viewer: a canvas in `element`, plus the camera, mouse and touch handling. See [pv.Viewer](/api/viewer) for the options (size, antialiasing, background, fog, outline, …).
- **`pv.io`** reads structures: `fetchCif` and `fetchPdb` download and parse a file and return a promise of the structure; `cif` and `pdb` parse text you already have. See [Loading structures](./loading).
- **Render styles** such as `viewer.cartoon(name, structure)` or `viewer.licorice(name, structure)` draw a structure, or part of one, and add the result to the scene under `name`. Use the name to get, hide or remove it later. See [Render styles](./render-styles).
- **Selections** such as `structure.select('ligand')` pick out part of a structure, to draw it differently, color it or highlight it. See [Selections](./selections).
- **`viewer.autoZoom()`** points the camera so that everything is in view.

## Navigating

| | Mouse | Touch |
|---|---|---|
| Rotate | Drag | Drag with one finger |
| Zoom | Wheel | Pinch |
| Move | Shift + drag, or middle-button drag | Drag with two fingers |
| Rotate in the screen plane | | Twist with two fingers |
| Center on an atom | Double-click | Double-tap |
