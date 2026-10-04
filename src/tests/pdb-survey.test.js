import { test, strictEqual, deepEqual } from './helpers';
import fs from 'node:fs';
import io from '../io';
import { parseCIF } from '../cif';
import { bondKey, checkBonds, checkShown, entityTypes } from '../../scripts/pdb-survey/checks.mjs';

function load(id) {
  return io.cif(fs.readFileSync('structures/' + id + '.cif', 'utf8'));
}

test('survey: bonds are compared with the CCD both ways', function() {
  const trna = load('1ehz');
  // the CCD's guanosine minus its glycosidic bond, plus one it doesn't have
  const g = trna.chain('A').residues()[0];
  const ccd = new Map([['G', new Set()]]);
  for (const atom of g.atoms()) {
    for (const bond of atom.bonds()) {
      const other = bond.atom_one() === atom ? bond.atom_two() : bond.atom_one();
      if (other.residue() === g) ccd.get('G').add(bondKey(atom.name(), other.name()));
    }
  }
  ccd.get('G').delete(bondKey("C1'", 'N9'));
  ccd.get('G').add(bondKey('C2', 'C8'));
  const flags = checkBonds(trna, ccd).filter((f) => f.detail.startsWith('G A/1 '));
  deepEqual(flags.map((f) => f.check + ' ' + f.detail.split(' ')[2]),
            ["extra-bond C1'-N9", 'missing-bond C2-C8']);
});

test('survey: a free amino acid ligand is shown (as a ligand)', function() {
  const cif = [
    'data_test',
    'loop_', '_entity.id', '_entity.type', '1 non-polymer',
    'loop_', '_atom_site.group_PDB', '_atom_site.id', '_atom_site.type_symbol',
    '_atom_site.label_atom_id', '_atom_site.label_comp_id', '_atom_site.label_asym_id',
    '_atom_site.label_entity_id', '_atom_site.label_seq_id',
    '_atom_site.Cartn_x', '_atom_site.Cartn_y', '_atom_site.Cartn_z',
    'HETATM 1 N N   ILE C 1 . 0.000 0.000 0.000',
    'HETATM 2 C CA  ILE C 1 . 1.458 0.000 0.000',
    'HETATM 3 C C   ILE C 1 . 2.009 1.420 0.000',
    'HETATM 4 O O   ILE C 1 . 1.251 2.390 0.000',
  ].join('\n');
  const s = io.cif(cif);
  const flags = checkShown(s, entityTypes(parseCIF(cif)));
  strictEqual(flags.length, 0);
});
