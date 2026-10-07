# Molecules

A structure is a `Mol`, made of chains, residues and atoms. A [selection](./select) is a `MolView`, made of views of them: `ChainView`, `ResidueView` and `AtomView`, which hold part of the structure. Views have the same methods for reading as the objects they show, and `full()` returns that object (an object's `full()` is itself). Data such as positions and properties lives on the objects, so changes made through a view change the structure.

`pv.mol` holds `Mol`, `MolView`, `superpose`, `matchResiduesByIndex`, `matchResiduesByNum` and `assignHelixSheet`.

## Mol and MolView

| Method | |
|---|---|
| `chains()` | |
| `chainByName(name)` | The chain of that name, or `null` |
| `eachChain(callback)`, `eachResidue(callback)`, `eachAtom(callback)` | Return `false` from `callback` to stop |
| `residueCount()`, `atomCount()` | |
| `atoms()` | All atoms, as an array |
| `atom('A.12.CA')` | An atom by chain name, residue number and atom name, or `null` |
| `select(what)`, `residueSelect(fn)`, `atomSelect(fn)`, `selectWithin(target, options)` | See [Selections](./select) |
| `center()` | The mean position of the atoms |
| `boundingSphere()` | A sphere around them, with `center()` and `radius()` |
| `backboneTraces()` | The backbone traces of all chains |
| `assemblies()`, `assembly(name)` | The [biological assemblies](/guide/assemblies) |
| `chainsByName(names)` | The chains of those names, in that order |
| `createEmptyView()` | An empty `MolView` of the structure |
| `full()` | The `Mol` |

`Mol` only:

| Method | |
|---|---|
| `new pv.mol.Mol()` | An empty structure |
| `addChain(name)` | Adds a chain |
| `connect(atomA, atomB, order)` | Adds a bond (order 1 by default) |
| `deriveConnectivity()` | Finds bonds from distances, classifies the residues and links the backbone. Call it after building a structure yourself. |

`MolView` only:

| Method | |
|---|---|
| `addAtom(atom)` | Adds an atom, with its chain and residue as needed; returns its view |
| `removeAtom(atom, removeEmpty)` | Removes an atom; with `removeEmpty`, also residues and chains left empty |
| `addChain(chain, all)` | Adds a chain, with all its residues and atoms if `all` |

## Chain

| Method | |
|---|---|
| `name()` | |
| `residues()`, `eachResidue(callback)`, `eachAtom(callback)`, `atomCount()` | |
| `residueByRnum(num)` | The residue of that number, or `null` |
| `residuesInRnumRange(first, last)` | |
| `backboneTraces()`, `eachBackboneTrace(callback)` | Its stretches of linked amino acids or nucleotides |
| `prop(name)`, `setProp(name, value)` | Properties, such as `entityId` and `entityDescription` from mmCIF files |
| `asView()` | A `MolView` of just this chain |
| `structure()`, `full()` | |
| `addResidue(name, num, insCode)` | (`Chain` only) Adds a residue |

## Residue

| Method | |
|---|---|
| `name()` | The three-letter name, e.g. `'ALA'` |
| `num()`, `insCode()` | Residue number, and insertion code (`'\0'` for none) |
| `index()` | Position in the chain, from 0 |
| `chain()` | |
| `atoms()`, `atom(name)`, `eachAtom(callback)` | |
| `isAminoacid()` | Has N, CA, C and O, and isn't a nucleotide |
| `isNucleotide()` | Has C1', C3', C4' and O3' |
| `isWater()` | Is HOH or DOD |
| `centralAtom()` | CA of an amino acid, C3' of a nucleotide, else `null` |
| `ss()` | Secondary structure: `'H'`, `'E'` or `'C'` |
| `center()` | Mean position of its atoms |
| `qualifiedName()` | E.g. `'A.ALA12'` |
| `prop(name)`, `setProp(name, value)` | Properties: its own values (`'num'`, `'index'`), those of mmCIF files (`'authSeqId'`, `'compName'`, …), and your own. An unset property is `0`. |
| `full()` | |
| `addAtom(name, position, element, isHetatm, occupancy, tempFactor, serial)` | (`Residue` only) Adds an atom |

## Atom

| Method | |
|---|---|
| `name()`, `element()` | |
| `pos()` | Its position, a `vec3` (the atom's own; copy it to keep it) |
| `residue()` | |
| `index()` | Unique within the structure |
| `serial()`, `occupancy()`, `tempFactor()`, `isHetatm()` | From the file |
| `bonds()`, `bondCount()`, `eachBond(callback)`, `isConnectedTo(atom)` | |
| `qualifiedName()` | E.g. `'A.ALA12.CA'` |
| `prop(name)`, `setProp(name, value)` | As for residues |
| `setPos(position)` | (`Atom` only) Moves it |
| `full()` | |

A bond has `atom_one()`, `atom_two()`, `order()` (1 to 4; aromatic bonds read from files are 2) and `mid_point()`.

## Superposition

```js
const pairs = pv.mol.matchResiduesByNum(model, reference, 'backbone');
pv.mol.superpose(pairs[0], pairs[1]);
```

`pv.mol.superpose(subject, reference)` moves the whole structure of `subject` to fit its atoms onto those of `reference`, paired in order, with the least root-mean-square deviation. Both must have the same number of atoms, at least 3. It returns `true` on success. Draw the structure again afterwards.

`matchResiduesByNum(a, b, atoms)` and `matchResiduesByIndex(a, b, atoms)` pair the residues of two structures, chain by chain in order, by residue number or by position, and return two selections with the atoms both residues have, in matching order. `atoms` limits them: `'backbone'` (N, CA, C, O), a list such as `'CA'` or `'N, CA, C'`, an array of names, or `'all'`.

## Secondary structure

`pv.mol.assignHelixSheet(structure)` assigns helices and strands from the CA positions, for models that come without them.
