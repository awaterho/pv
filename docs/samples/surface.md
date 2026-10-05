<script setup>
import code from './code/surface.js?raw'
</script>

# Surface

Adenylate kinase with its inhibitor Ap5A, buried in the enzyme, inside a faint solvent-excluded surface of the protein. The orange shape is the inhibitor's pocket: the empty space of the cleft, as found by a cavity finder. It is larger than the inhibitor, with room the inhibitor leaves empty. The surfaces are computed in the background and added when they're ready. See [Surfaces](/guide/surfaces).

<PvSample :code="code" />

<<< ./code/surface.js

The pocket is the largest cavity [pyKVFinder](https://github.com/LBC-LNBio/pyKVFinder) 0.9.5 finds in chain A without the inhibitor and the waters (step 0.8, probe out 8.0), as it writes it: a PDB file of points filling the cavity (`samples/data/1ake-pocket.pdb` in the docs). The output of other cavity finders, such as the pocket spheres of fpocket, can be drawn the same way.
