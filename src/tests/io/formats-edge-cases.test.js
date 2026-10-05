import { test, strictEqual } from '../helpers';
import io from '../../io';

test('an SDF molecule without bonds is read', function() {
  const sdf = [
    'sodium',
    '  test',
    '',
    '  1  0  0  0  0  0  0  0  0  0999 V2000',
    '    0.0000    0.0000    0.0000 Na  0  3  0  0  0  0  0  0  0  0  0  0',
    'M  CHG  1   1   1',
    'M  END',
    '$$$$',
  ].join('\n');
  const s = io.sdf(sdf);
  strictEqual(s !== null, true);
  strictEqual(s.atomCount(), 1);
  strictEqual(s.atoms()[0].element(), 'Na');
});

test('CONECT bonds are not added a second time by distance', function() {
  // a carbonyl: C and O 1.23 A apart, a double bond by CONECT
  const pdb = [
    'HETATM    1  C1  LIG A   1       0.000   0.000   0.000  1.00  0.00           C',
    'HETATM    2  O1  LIG A   1       1.230   0.000   0.000  1.00  0.00           O',
    'CONECT    1    2    2',
    'CONECT    2    1    1',
    'END',
  ].join('\n');
  const s = io.pdb(pdb, { conectRecords: true });
  const carbon = s.atoms()[0];
  strictEqual(carbon.bondCount(), 1);
  strictEqual(carbon.bonds()[0].order(), 2);
});
