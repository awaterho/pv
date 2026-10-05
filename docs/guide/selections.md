# Selections

A selection is a part of a structure: a `MolView`, which holds some of its chains, residues and atoms. Anything that takes a structure takes a selection as well: render styles, `colorBy`, `setOpacity`, `setSelection`, `fitTo`. A selection doesn't copy anything; its atoms are the structure's own.

## By keyword

```js
structure.select('protein');
structure.select('ligand');
```

| Keyword | Selects |
|---|---|
| `'polymer'` | The residues of the backbone traces: what cartoon, tube and trace draw |
| `'ligand'` | Everything but water outside the polymers: small molecules, ions, free amino acids and nucleotides (ATP, SAM), and residues left on their own between chain breaks |
| `'water'` | Water (HOH and DOD) |
| `'protein'` | Every amino acid, in a polymer or not |
| `'carbohydrate'` | Sugars (only for mmCIF files) |

`'ligand'`, `'polymer'` and `'water'` divide a structure between them. The nucleotides of DNA and RNA are polymer, not ligand: select them with `'polymer'`.

## By chain, residue and atom

An object of conditions selects what meets all of them:

```js
structure.select({ cname: 'A' });
structure.select({ cnames: ['A', 'B'], rnumRange: [10, 50] });
structure.select({ rname: 'HEM' });
structure.select({ rnames: ['ASP', 'GLU'], anames: ['OD1', 'OD2', 'OE1', 'OE2'] });
```

| Condition | Matches |
|---|---|
| `cname`, `cnames` | Chain names (also as `chain`, `chains`) |
| `rname`, `rnames` | Residue names |
| `rnum`, `rnums` | Residue numbers (insertion codes are ignored) |
| `rnumRange: [first, last]` | Residue numbers from `first` to `last`, both included |
| `rindex`, `rindices`, `rindexRange: [first, last]` | Residue positions in the chain, counting from 0 |
| `rtype` | Secondary structure: `'H'` helix, `'E'` strand, `'C'` coil |
| `aname`, `anames` | Atom names |
| `hetatm` | `true` for HETATM atoms, `false` for ATOM atoms |

For mmCIF files, chain names are the `label_asym_id` and polymer residue numbers the `label_seq_id`; see [Loading structures](./loading#what-pv-reads-from-mmcif).

## With a function

```js
// residues with any atom of B-factor above 60
structure.residueSelect(function (residue) {
  return residue.atoms().some(function (atom) { return atom.tempFactor() > 60; });
});

// sulfur atoms
structure.atomSelect(function (atom) { return atom.element() === 'S'; });
```

`residueSelect` keeps whole residues, `atomSelect` single atoms.

## Around something

`selectWithin` selects the atoms near another selection, residue or structure:

```js
const ligand = structure.select({ rname: 'ATP' });
const pocket = structure.selectWithin(ligand, { radius: 5, matchResidues: true });
viewer.licorice('pocket', pocket);
```

`radius` is in Å (default 4). With `matchResidues: true` a residue with any atom in range is selected whole.

## Combining

A selection has the same `select` methods, so conditions can be chained:

```js
structure.select('protein').select({ cname: 'A' });
```

To build one by hand, start from `structure.createEmptyView()` and add to it with `addAtom(atom)`, which adds the atom's chain and residue as needed, and remove with `removeAtom(atom, true)`.

## Working through a structure

```js
structure.eachChain(function (chain) { ... });
structure.eachResidue(function (residue) { ... });
structure.eachAtom(function (atom) { ... });
structure.atom('A.12.CA');        // chain.residue number.atom name
```

Returning `false` from the callback stops the loop. A selection's atoms and residues are views of the structure's own; `atom.full()` gives the structure's atom. See [Molecules](/api/mol).
