<script setup>
import code from './code/membrane.js?raw'
</script>

# Membrane

The porin of *Rhodobacter capsulatus* (PDB 2POR) in the bacterial outer membrane, as SWISS-MODEL predicts it: two planes bounding the hydrophobic core of the lipid bilayer. The file holds one chain; the porin is a trimer, its biological assembly 1, and each chain is a β-barrel around a water-filled pore. The buttons switch between ways of showing the membrane with `pv.membrane`. It is cut out or outlined where the trimer crosses it, holes for the pores included, from the atoms near each plane only, so this stays fast for large structures. See [pv.membrane](/api/addons#pv-membrane).

<PvSample :code="code" />

<<< ./code/membrane.js

- **Dots**: a grid of points on each plane, left out where the protein is. The lower plane's dots continue into the pores.
- **Flat dots**: a finer grid of flat dots in one mesh, fading towards the edge.
- **Plane**: translucent discs. They tint what lies behind them, and a dark blue line traces the protein's cross-section in each.
- **Depth color**: no shapes. The protein is colored by its depth in the membrane: the hydrophobic core orange, the headgroup layers red.
- **Slab**: a translucent cylinder filling the hydrophobic core.
- **Rings**: a circle on each plane and the membrane's axis. This style hides the least, so it suits large assemblies.
