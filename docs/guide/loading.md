# Loading structures

`pv.io` reads PDB, mmCIF, SDF and CHARMM CRD files. Each format has a parser for text you already have and a fetcher that downloads the file first:

| Format | Parse text | Download and parse |
|---|---|---|
| mmCIF | `pv.io.cif(text, options)` | `pv.io.fetchCif(url, callback, options)` |
| PDB | `pv.io.pdb(text, options)` | `pv.io.fetchPdb(url, callback, options)` |
| SDF (V2000 molfile) | `pv.io.sdf(text)` | `pv.io.fetchSdf(url, callback)` |
| CHARMM CRD | `pv.io.crd(text)` | `pv.io.fetchCrd(url, callback)` |

Prefer mmCIF: it is what the PDB archive publishes for every entry, and PV reads more from it (see [What PV reads from mmCIF](#what-pv-reads-from-mmcif)).

## Fetching

The fetchers return a promise of the structure:

```js
pv.io.fetchCif('https://files.rcsb.org/download/1AKE.cif').then(function (structure) {
  viewer.cartoon('protein', structure);
  viewer.autoZoom();
}, function (error) {
  console.error(error.message);   // e.g. "HTTP 404 fetching https://..."
});
```

The promise is rejected on a network error, an HTTP error status, an empty response, or a file without atoms, so a failed download never reaches your code as an empty structure. The older callback style still works, `fetchPdb(url, function (structure) { ... })`, but the callback only runs on success. To pass options without a callback, give `undefined` as the callback: `fetchCif(url, undefined, { traceOnly: true })`.

The files must be served from the same origin as your page, or with CORS headers. The RCSB (`https://files.rcsb.org/download/<id>.cif`), the AlphaFold DB and ModelArchive all send them.

## Parsing text

```js
const structure = pv.io.cif(text);
```

`pdb()` and `cif()` return the structure, or `undefined` if the text has no atoms. They don't throw on malformed numbers; a coordinate that doesn't parse becomes `NaN`.

## Several models

By default only the first model of an NMR ensemble or a multi-model file is read. With `loadAllModels: true`, `pdb()` and `cif()` return an array with one structure per model:

```js
pv.io.fetchCif(url, undefined, { loadAllModels: true }).then(function (models) {
  models.forEach(function (model, i) {
    viewer.cartoon('model.' + i, model);
  });
  viewer.autoZoom();
});
```

See the [NMR ensemble sample](/samples/ensemble).

## Options

| Option | Formats | Default | Meaning |
|---|---|---|---|
| `loadAllModels` | PDB, mmCIF | `false` | Read every model and return an array. |
| `traceOnly` | mmCIF | `false` | Keep only the CA of amino acids and the C3' of nucleotides, and no ligands or water. For structures too large to load in full; see [Large structures](./large-structures). |
| `conectRecords` | PDB | `true` | Read `CONECT` records as bonds. These are the only source of bonds between residues other than the polymer backbone: disulfides, glycan links, ligands attached to the protein. A partner listed twice gives a double bond. Records pointing at atoms that aren't in the file are skipped. In files with several models, the records are not read and bonds are found from distances. Set to `false` to ignore them. |

## What PV reads from mmCIF

**Chains are `label_asym_id` chains.** In mmCIF every polymer, every ligand and the water of a chain get their own `label_asym_id`, so in PV they are separate chains: in 4UMT the protein is chain A, a DMSO chain B, the inhibitor chain C and the water chain D. The author's chain name, as you know it from the paper or the PDB file, is the residue property `authAsymId`.

**Residue numbers are `label_seq_id`** for polymer residues, which counts from 1 along the sequence. Ligands and water have no `label_seq_id` and are numbered by their `auth_seq_id`. Where the author's numbering differs, it is the residue property `authSeqId`, a string with any insertion code.

Other properties the reader sets, only where they apply:

| Property | On | Value |
|---|---|---|
| `authAsymId` | residue | Author chain name, where it differs from the label one |
| `authSeqId` | residue | Author residue number (with insertion code), where it differs |
| `compName` | residue | Chemical component name, for non-polymer residues, e.g. "DIMETHYL SULFOXIDE" |
| `parentCompId` | residue | The standard residue a modified one derives from, e.g. MET for MSE, U for PSU |
| `isCarbohydrate` | residue | `true` for sugars |
| `snfg` | residue | The sugar's SNFG name, e.g. `'GlcNAc'` |
| `entityId` | chain | The `label_entity_id` |
| `entityDescription` | chain | The entity's description, e.g. "MATERNAL EMBRYONIC LEUCINE ZIPPER KINASE" |

Read them with `residue.prop('authSeqId')` or `chain.prop('entityDescription')`. An unset property reads as `0`, not `undefined`.

The reader also takes:

- **Secondary structure** from `struct_conf` (helices, and strands as written by the AlphaFold DB) and `struct_sheet_range`. For models without it, `pv.mol.assignHelixSheet(structure)` assigns it from the CA trace.
- **Biological assemblies** from `pdbx_struct_assembly_gen` and `pdbx_struct_oper_list`. See [Biological assemblies](./assemblies).
- **Bonds and bond orders** from `chem_comp_bond`, when the file has it. Otherwise bonds within a residue are found from atom distances.
- **Links between residues** from `struct_conn`: disulfides, glycosidic bonds, and covalently attached ligands. Metal coordination and hydrogen bonds are not bonds and are left out.

Of alternative conformations, only the first (`A`, or none) is read.

## PDB files

The PDB reader takes `ATOM` and `HETATM` records, `HELIX` and `SHEET` for secondary structure, and `REMARK 350` for biological assemblies. Chains are the one-letter chain ids, residues are numbered as in the file, with insertion codes. Bonds are found from distances. Of alternative conformations, only the first is read.

## SDF and CRD

An SDF file gives one structure with one chain per molecule (named `"1"`, `"2"`, …), each holding one residue named after the molecule's title. Bonds and bond orders come from the file. Only V2000 molfiles are read.

CRD files give one chain per segment, named after the segment id's first character.

## Building a structure yourself

```js
const structure = new pv.mol.Mol();
const chain = structure.addChain('A');
const residue = chain.addResidue('ALA', 1);
residue.addAtom('N', [0, 0, 0], 'N');
residue.addAtom('CA', [1.46, 0, 0], 'C');
// ...
structure.deriveConnectivity();
```

Call `deriveConnectivity()` when you are done: it finds the bonds, classifies the residues as amino acids or nucleotides, and so makes the backbone traces cartoons need.
