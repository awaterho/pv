# Samples

Each sample is a page with a live viewer and the code that makes it. The code is complete apart from the page around it: an element with the id `viewer` and the PV script (see [Getting started](/guide/getting-started)). The structures are local copies of the RCSB entries, in `structures/` in the repository, stored gzipped: `pv.io.fetchCif` and `fetchPdb` unpack a gzipped file themselves, so any URL works, with or without `.gz`.

- [Protein with ligands](./ligands)
- [Hover and select](./hover-select)
- [Glycoprotein](./glycoprotein)
- [Nucleic acid](./nucleic-acid)
- [Biological assembly](./assembly)
- [Surface](./surface)
- [Spotlight](./spotlight)
- [NMR ensemble](./ensemble)
- [Color by a custom property](./custom-property)
- [Measure a distance](./measure-distance)
- [Labels](./labels)
- [Custom mesh](./custom-mesh)
- [Membrane](./membrane)

The [demo](https://awaterho.github.io/pv/demo/) shows much more: every style and color scheme, structures from the PDB, the AlphaFold DB and ModelArchive, and dropping your own files.
