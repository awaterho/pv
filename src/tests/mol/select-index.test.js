import { test, strictEqual, deepEqual } from '../helpers';
import io from '../../io';

const PEPTIDE = [1, 2, 3, 4].map((n, i) =>
  'ATOM  ' + String(i + 1).padStart(5) + '  CA  ALA A' + String(n).padStart(4) + '    ' +
  (i * 3.8).toFixed(3).padStart(8) + '   0.000   0.000  1.00  0.00           C').join('\n') + '\nEND\n';

function nums(view) {
  const result = [];
  view.eachResidue((r) => { result.push(r.num()); });
  return result;
}

test('rindex 0 selects the first residue', function() {
  const s = io.pdb(PEPTIDE);
  deepEqual(nums(s.select({ rindex: 0 })), [1]);
  deepEqual(nums(s.select({ rindex: 2 })), [3]);
});

test('rindices past the end of a chain select nothing', function() {
  const s = io.pdb(PEPTIDE);
  deepEqual(nums(s.select({ rindices: [1, 10] })), [2]);
  strictEqual(s.select({ rindices: [10] }).residueCount(), 0);
});
