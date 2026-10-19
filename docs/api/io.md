# pv.io

See [Loading structures](/guide/loading) for what each reader reads.

## Parsers

| Function | Returns |
|---|---|
| `pv.io.cif(text, options)` | The structure, or `undefined` without atoms. With `loadAllModels`, an array of structures, one per model. |
| `pv.io.pdb(text, options)` | The same |
| `pv.io.sdf(text)` | One structure with a chain per molecule, or `null` if the file is cut short |
| `pv.io.crd(text)` | The structure |
| `pv.io.loadStructure(text, options)` | Whichever of the above the text turns out to be |

## Fetchers

| Function | |
|---|---|
| `pv.io.fetchCif(url, callback, options)` | |
| `pv.io.fetchPdb(url, callback, options)` | |
| `pv.io.fetchSdf(url, callback)` | |
| `pv.io.fetchCrd(url, callback)` | |
| `pv.io.fetchStructure(url, callback, options)` | |
| `pv.io.fetchText(url)` | |

Each of the first five returns a promise of what the parser returns. It is rejected with an `Error` on a network error, an HTTP error status, an empty response, or a file without atoms. The `callback`, if given, is called with the structure on success; pass `undefined` to give `options` without one.

`fetchText(url)` is the fetcher they all build on, without a parser: a promise of the file's text, for callers that need to pick a parser themselves (e.g. sniffing a URL of unknown format). All of them transparently unpack the response if it is gzipped, going by the gzip header's first two bytes rather than the URL or the `Content-Type`, since some servers (SWISS-MODEL's, for one) send gzipped files without the `Content-Encoding` header that would have had the browser unpack them already.

## Options

| Option | For | Default | |
|---|---|---|---|
| `loadAllModels` | `cif`, `pdb` | `false` | Read every model, and return an array |
| `traceOnly` | `cif` | `false` | Keep only CA and C3' atoms of polymers |
| `conectRecords` | `pdb` | `true` | Read `CONECT` records as bonds |
| `name` | `loadStructure` | — | The file name or URL the text came from, for guessing the format |
| `format` | `loadStructure` | — | `'cif'`, `'pdb'`, `'sdf'` or `'crd'`, when the format is known |

`loadStructure` and `fetchStructure` take all of these, and pass the ones that apply to whichever parser they pick.

## Helpers

`pv.io.guessFormat(text, name)` returns `'cif'`, `'pdb'`, `'sdf'` or `'crd'`, the format `loadStructure` would read the text as. `name` is optional. See [Files of unknown format](/guide/loading#files-of-unknown-format).

`pv.io.guessAtomElementFromName(name)` returns the element of an atom from its four-character PDB atom name, as the PDB reader does for files without element columns.
