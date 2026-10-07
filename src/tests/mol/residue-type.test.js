import { test, strictEqual, deepEqual } from '../helpers';
import io from '../../io';

function pdbLine(serial, name, resName, chain, resNum, x, y, z, element) {
  const atomName = name.length < 4 ? ' ' + name.padEnd(3) : name;
  return 'HETATM' + String(serial).padStart(5) + ' ' + atomName + ' ' + resName.padStart(3) +
         ' ' + chain + String(resNum).padStart(4) + '    ' +
         x.toFixed(3).padStart(8) + y.toFixed(3).padStart(8) + z.toFixed(3).padStart(8) +
         '  1.00  0.00          ' + element.padStart(2);
}

test('a nucleotide carrying an amino acid is a nucleotide only', function() {
  // the atom names of 12A, an adenosine with a threonine attached (from
  // PDB 4X65), spread out so only their names matter
  const names = ['P', "O5'", "C5'", "C4'", "O4'", "C3'", "O3'", "C2'", "C1'", 'N9',
                 'N', 'CA', 'C', 'O', 'CB'];
  const lines = names.map((n, i) => pdbLine(i + 1, n, '12A', 'W', 37, i * 5, 0, 0, n[0]));
  const s = io.pdb(lines.join('\n') + '\nEND\n');
  const residue = s.chainByName('W').residues()[0];
  strictEqual(residue.isNucleotide(), true);
  strictEqual(residue.isAminoacid(), false);
  // so the nucleic-acid trace runs through C3', not the threonine's CA
  strictEqual(residue.centralAtom().name(), "C3'");
});

test('the irons of an iron-sulfur cluster are bonded to the sulfurs only', function() {
  // the 4Fe-4S cluster SF4 of PDB 9A89, Fe-Fe 2.7 A
  const atoms = [
    ['FE1', 187.656, 193.742, 109.892, 'FE'], ['FE2', 187.939, 194.230, 107.216, 'FE'],
    ['FE3', 186.415, 192.124, 108.066, 'FE'], ['FE4', 189.138, 192.049, 108.340, 'FE'],
    ['S1', 187.949, 192.116, 106.396, 'S'], ['S2', 187.594, 191.465, 109.906, 'S'],
    ['S3', 189.587, 194.231, 108.790, 'S'], ['S4', 186.016, 194.332, 108.429, 'S'],
  ];
  const lines = atoms.map(([n, x, y, z, e], i) => pdbLine(i + 1, n, 'SF4', 'Q', 801, x, y, z, e));
  const s = io.pdb(lines.join('\n') + '\nEND\n');
  const residue = s.chainByName('Q').residues()[0];
  const bonds = new Set();
  for (const atom of residue.atoms()) {
    for (const bond of atom.bonds()) {
      const pair = [bond.atom_one().name(), bond.atom_two().name()].sort().join('-');
      bonds.add(pair);
    }
  }
  // each iron to three sulfurs, as in the cube's 12 edges
  strictEqual(bonds.size, 12);
  deepEqual([...bonds].filter((b) => !/^FE\d-S\d$/.test(b)), []);
});
