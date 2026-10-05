# Selections

Each returns a new `MolView` and works on structures and on selections. See the [Selections guide](/guide/selections) for examples.

## select(keyword)

| Keyword | |
|---|---|
| `'polymer'` | The residues of the backbone traces |
| `'ligand'` | Everything but water outside the backbone traces |
| `'water'` | HOH and DOD |
| `'protein'` | Every amino acid |
| `'carbohydrate'` | Sugars, as marked in mmCIF files |

## select(conditions)

All conditions must hold.

| Condition | Value | Matches |
|---|---|---|
| `cname`, `chain` | name | The chain |
| `cnames`, `chains` | array | Any of the chains |
| `rname` | name | Residues of that name |
| `rnames` | array | Residues of any of those names |
| `rnum` | number | Residues of that number |
| `rnums` | array | Residues of any of those numbers |
| `rnumRange` | `[first, last]` | Residue numbers in the range, both included |
| `rindex` | number | The residue at that position in its chain, from 0 |
| `rindices` | array | Residues at those positions in their chain, from 0 |
| `rindexRange` | `[first, last]` | Residues at positions in the range |
| `rtype` | `'H'`, `'E'` or `'C'` | Residues of that secondary structure |
| `aname` | name | Atoms of that name |
| `anames` | array | Atoms of any of those names |
| `hetatm` | boolean | HETATM atoms, or ATOM atoms |

Residue numbers are compared without insertion codes.

## residueSelect(fn), atomSelect(fn)

`residueSelect` keeps the residues for which `fn(residue)` returns `true`, with all their atoms. `atomSelect` keeps the atoms for which `fn(atom)` does.

## selectWithin(target, options)

The atoms within a distance of any atom of `target`, which can be a structure, a selection, a chain or a residue.

| Option | Default | |
|---|---|---|
| `radius` | 4 | In Å |
| `matchResidues` | `false` | Select whole residues |
