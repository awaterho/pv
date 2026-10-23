<script setup>
import code from './code/spotlight.js?raw'
</script>

# Spotlight

Haemoglobin (PDB 4HHB), a tetramer whose four chains each hold a heme in a pocket of its own. The buttons light the pockets with `viewer.spotlight()`: everything within `radius` Å of a heme atom stays as it is, and over `falloff` Å further out fades to `opacity`. The rest of the protein stays visible, so a site is seen in its context rather than on its own.

<PvSample :code="code" />

<<< ./code/spotlight.js

The target is a structure, a selection, a point (`[x, y, z]`), or a list of them: **Four hemes** passes the selection of all four, which lights four separate regions at once, and **One heme** passes one of them. **One heme, wide** is the same target with a radius of 12 Å and a falloff of 8, which lights most of a subunit — the beam is as broad or as tight as the region you mean.

The fade happens in the shaders, from the distance of each point to the target, so it runs smoothly along a cartoon or a surface instead of switching per residue, and a later `colorBy` doesn't undo it. Here it applies to everything drawn; the `objects` option limits it by name, to leave the ligands or the sticks around them at full color. See [Spotlight](/guide/effects#spotlight).
