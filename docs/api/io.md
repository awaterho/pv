# pv.io

See [Loading structures](/guide/loading) for what each reader reads.

## Parsers

| Function | Returns |
|---|---|
| `pv.io.cif(text, options)` | The structure, or `undefined` without atoms. With `loadAllModels`, an array of structures, one per model. |
| `pv.io.pdb(text, options)` | The same |
| `pv.io.sdf(text)` | One structure with a chain per molecule, or `null` if the file is cut short |
| `pv.io.crd(text)` | The structure |

## Fetchers

| Function | |
|---|---|
| `pv.io.fetchCif(url, callback, options)` | |
| `pv.io.fetchPdb(url, callback, options)` | |
| `pv.io.fetchSdf(url, callback)` | |
| `pv.io.fetchCrd(url, callback)` | |

Each returns a promise of what the parser returns. It is rejected with an `Error` on a network error, an HTTP error status, an empty response, or a file without atoms. The `callback`, if given, is called with the structure on success; pass `undefined` to give `options` without one.

## Options

| Option | For | Default | |
|---|---|---|---|
| `loadAllModels` | `cif`, `pdb` | `false` | Read every model, and return an array |
| `traceOnly` | `cif` | `false` | Keep only CA and C3' atoms of polymers |
| `conectRecords` | `pdb` | `false` | Read `CONECT` records as bonds |

## Helpers

`pv.io.guessAtomElementFromName(name)` returns the element of an atom from its four-character PDB atom name, as the PDB reader does for files without element columns.
