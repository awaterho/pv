import { test, strictEqual, deepEqual } from '../helpers';
import fs from 'node:fs';
import io from '../../io';

function load(id) {
  return io.cif(fs.readFileSync('structures/' + id + '.cif', 'utf8'));
}

function names(view) {
  const result = [];
  view.eachResidue((r) => { result.push(r.name() + r.num()); });
  return result;
}

// a CA trace with a gap after residue 3 and one after 4: residue 4 is a
// polymer residue on its own between two chain breaks
const BROKEN_TRACE = [
  'ATOM      1  CA  ALA A   1       0.000   0.000   0.000  1.00  0.00           C',
  'ATOM      2  CA  ALA A   2       3.800   0.000   0.000  1.00  0.00           C',
  'ATOM      3  CA  ALA A   3       7.600   0.000   0.000  1.00  0.00           C',
  'ATOM      4  CA  ALA A   4      17.600   0.000   0.000  1.00  0.00           C',
  'ATOM      5  CA  ALA A   5      27.600   0.000   0.000  1.00  0.00           C',
  'ATOM      6  CA  ALA A   6      31.400   0.000   0.000  1.00  0.00           C',
  'END',
].join('\n');

test('ligand selects no nucleotides of a DNA/RNA chain', function() {
  const trna = load('1ehz');
  const ligand = trna.select('ligand');
  let nucleotides = 0;
  ligand.eachResidue((r) => { if (r.isNucleotide()) nucleotides += 1; });
  strictEqual(nucleotides, 0);
  // the ions are still there, the water isn't
  ligand.eachResidue((r) => { strictEqual(r.isWater(), false); });
  strictEqual(ligand.residueCount() > 0, true);
});

test('ligand selects the small molecules but no residue of the protein', function() {
  // MELK with its inhibitor 47W and a DMSO
  const melk = load('4umt');
  const ligand = melk.select('ligand');
  deepEqual([...new Set(names(ligand).map((n) => n.replace(/\d+$/, '')))].sort(), ['47W', 'DMS']);
  ligand.eachResidue((r) => { strictEqual(r.isAminoacid(), false); });
});

test('ligand selects a free amino acid', function() {
  const cif = [
    'data_test',
    'loop_', '_atom_site.group_PDB', '_atom_site.id', '_atom_site.type_symbol',
    '_atom_site.label_atom_id', '_atom_site.label_comp_id', '_atom_site.label_asym_id',
    '_atom_site.label_seq_id', '_atom_site.Cartn_x', '_atom_site.Cartn_y', '_atom_site.Cartn_z',
    'HETATM 1 N N   ILE C . 0.000 0.000 0.000',
    'HETATM 2 C CA  ILE C . 1.458 0.000 0.000',
    'HETATM 3 C C   ILE C . 2.009 1.420 0.000',
    'HETATM 4 O O   ILE C . 1.251 2.390 0.000',
  ].join('\n');
  const s = io.cif(cif);
  strictEqual(s.chain('C').residues()[0].isAminoacid(), true);
  deepEqual(names(s.select('ligand')), ['ILE1']);
});

test('ligand selects a residue left alone between chain breaks', function() {
  const s = io.pdb(BROKEN_TRACE);
  deepEqual(names(s.select('ligand')), ['ALA4']);
  // and ligand and polymer split the structure between them
  deepEqual(names(s.select('polymer')), ['ALA1', 'ALA2', 'ALA3', 'ALA5', 'ALA6']);
});

test('ligand of a view judges residues by their place in the whole chain', function() {
  const s = io.pdb(BROKEN_TRACE);
  // residue 2 alone in the view is still part of the trace 1-3
  strictEqual(s.select({ rnums: [2] }).select('ligand').residueCount(), 0);
  deepEqual(names(s.select({ rnums: [2, 4] }).select('ligand')), ['ALA4']);
});
