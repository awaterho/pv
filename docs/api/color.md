# pv.color

See [Coloring](/guide/coloring) for how colors are used.

## Color operations

| Function | Default arguments | Colors |
|---|---|---|
| `uniform(color)` | `'white'` | Everything `color` |
| `byElement(palette)` | CPK colors | By element. `palette` replaces them: an object of upper-case element symbols and `[r, g, b]` arrays. Unknown elements are magenta. |
| `bySS(colors)` | coil `[.8, .8, .8]`, helix `[.6, .6, .9]`, strand `[.2, .8, .2]` | By secondary structure; `colors` is `{ C, H, E }` with all three |
| `byChain(colors)` | `CHAIN_PALETTE` | Each chain its own color, cycling through `colors`, an array of colors or a gradient. Non-polymer chains of mmCIF files take the color of the polymer with the same author chain name. |
| `byEntity(colors)` | `CHAIN_PALETTE` | Each entity its own color, its copies shaded lighter and darker |
| `rainbow(gradient)` | `gradient('rainbow')` | Along each chain's residues |
| `ssSuccession(gradient, coilColor)` | `gradient('rainbow')`, `'lightgrey'` | Each helix and strand of a chain its own color |
| `byAtomProp(name, gradient, range)` | `gradient('rainbow')`, the values' range | By `atom.prop(name)` |
| `byResidueProp(name, gradient, range)` | `gradient('rainbow')`, the values' range | By `residue.prop(name)` |

`range` is `[min, max]`; values outside it take the colors at its ends.

## Gradients

`pv.color.gradient(name)` returns a predefined gradient: `'rainbow'`, `'reds'`, `'greens'`, `'blues'`, `'trafficlight'` or `'heatmap'`.

`pv.color.gradient(colors, stops)` makes one from an array of colors, evenly spaced, or at `stops`, an array of positions from 0 to 1.

A gradient's `colorAt(out, value)` writes the color at `value`, from 0 to 1, into `out` (an array of 4) and returns it.

## ColorOp

```js
new pv.color.ColorOp(colorFor, begin, end)
```

`colorFor(atom, out, index)` writes the atom's color as four numbers from 0 to 1 into `out[index]` to `out[index + 3]`. `begin(structure)` and `end()`, both optional, are called before and after each coloring. In all three, `this` is the operation.

## Colors

| | |
|---|---|
| `forceRGB(color, alpha)` | Turns any [color](/guide/coloring#specifying-a-color) into an `[r, g, b, a]` array |
| `hex2rgb(hex, alpha)` | The same for a hex string |
| `setColorPalette(palette)` | Replaces the color names |
| `CHAIN_PALETTE` | The 12 colors of `byChain` and `byEntity` |
