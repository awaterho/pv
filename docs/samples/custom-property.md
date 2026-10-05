<script setup>
import code from './code/custom-property.js?raw'
</script>

# Color by a custom property

Each residue gets a property of your own, here the hydrophobicity of its amino acid, with `setProp`; `byResidueProp` colors by it.

<PvSample :code="code" />

<<< ./code/custom-property.js
