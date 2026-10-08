import { test, strictEqual, deepEqual } from '../helpers';
import * as glMatrix from 'gl-matrix';
import io from '../../io';


var mat4 = glMatrix.mat4;

var MULTI_LINE_MT = [
  'REMARK 350 BIOMOLECULE: 1                 \n',
  'REMARK 350 AUTHOR DETERMINED BIOLOGICAL UNIT: 55-MERIC       \n',
  'REMARK 350 APPLY THE FOLLOWING TO CHAINS: A, B, C, D, E, F, G, H, I, \n',
  'REMARK 350                    AND CHAINS: J, K, L, M, N, O, P, Q, R, \n',
];

test("parses remark 350 with multi-line chain definitions", function() {
  var reader = new io.Remark350Reader();
  for (var i = 0; i < MULTI_LINE_MT.length; ++i) {
    reader.nextLine(MULTI_LINE_MT[i]);
  }
  strictEqual(reader.assemblies().length, 1);
  var assembly = reader.assembly('1');
  strictEqual(assembly.generators().length, 1);
  var gen = assembly.generators()[0];
  deepEqual(gen.chains(), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 
            'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R']);
});



var MULTI_MATRICES = [
  'REMARK 350 BIOMOLECULE: 1                                             \n',
  'REMARK 350 APPLY THE FOLLOWING TO CHAINS: F, G, J, X                  \n',
  'REMARK 350   BIOMT1  10 -0.982297 -0.036603  0.183718       10.28017  \n',
  'REMARK 350   BIOMT2  10 -0.036603  0.999324  0.003392        0.18982  \n',
  'REMARK 350   BIOMT3  10 -0.183718 -0.003392 -0.982973     -110.95964  \n',
  'REMARK 350   BIOMT1   2  0.500000 -0.809017  0.309017        0.00000  \n',
  'REMARK 350   BIOMT2   2  0.809017  0.309017 -0.500000        0.00000  \n',
  'REMARK 350   BIOMT3   2  0.309017  0.500000  0.809017        0.00000  \n'
];

test("parses remark 350 with multiple matrices", function(assert) {
  var reader = new io.Remark350Reader();
  for (var i = 0; i < MULTI_MATRICES.length; ++i) {
    reader.nextLine(MULTI_MATRICES[i]);
  }
  strictEqual(reader.assemblies().length, 1);
  var assembly = reader.assembly('1');
  strictEqual(assembly.generators().length, 1);
  var gen = assembly.generator(0);
  strictEqual(gen.matrices().length, 2);

  var m1 = mat4.fromValues(-0.982297, -0.036603,  -0.183718, 0.00000,
                           -0.036603,  0.999324,  -0.003392, 0.00000,
                            0.183718,  0.003392,  -0.982973, 0.00000,
                           10.280170,  0.189820,-110.959640, 1.00000);

  assert.mat4Equal(gen.matrix(0), m1);

  var m2 = mat4.fromValues( 0.500000,  0.809017,  0.309017,  0.00000,
                           -0.809017,  0.309017,  0.500000,  0.00000,
                            0.309017, -0.500000,  0.809017,  0.00000,
                            0.000000,  0.000000,  0.000000,  1.00000);
  assert.mat4Equal(gen.matrix(1), m2);

});

// coordinates are set to zero to have a simple test case when conectRecords 
// is set to false, because this prevents any bonds to be formed between 
// atoms.
var CONECT_RECORDS = '\
HETATM    1  C                   0.000   0.000   0.000\n\
HETATM    2  C                   0.000   0.000   0.000\n\
HETATM    3  C                   0.000   0.000   0.000\n\
HETATM    4  C                   0.000   0.000   0.000\n\
HETATM    5  C                   0.000   0.000   0.000\n\
HETATM    6  C                   0.000   0.000   0.000\n\
HETATM    7  I                   0.000   0.000   0.000\n\
HETATM    8  H                   0.000   0.000   0.000\n\
HETATM    9  O                   0.000   0.000   0.000\n\
CONECT    1    2    6    7\n\
CONECT    2    1    3    8\n\
CONECT    3    2    4    9\n\
CONECT    6    1\n\
CONECT    7    1\n\
CONECT    8    2\n\
CONECT    9    3\n\
CONECT    4    3\n\
';

test('uses conect records when conectRecords flag is set', function(assert) {
  var structure = io.pdb(CONECT_RECORDS, { conectRecords : true });

  var atoms = [];
  structure.eachAtom(function(a) { atoms.push(a) });
  assert.strictEqual(atoms[0].bonds().length, 3);
  assert.strictEqual(atoms[1].bonds().length, 3);
  assert.strictEqual(atoms[2].bonds().length, 3);
  assert.strictEqual(atoms[3].bonds().length, 1);
  assert.strictEqual(atoms[4].bonds().length, 0);
  assert.strictEqual(atoms[5].bonds().length, 1);
  assert.strictEqual(atoms[6].bonds().length, 1);
  assert.strictEqual(atoms[7].bonds().length, 1);
  assert.strictEqual(atoms[8].bonds().length, 1);
});

test('uses conect records by default', function(assert) {
  var structure = io.pdb(CONECT_RECORDS);
  var atoms = [];
  structure.eachAtom(function(a) { atoms.push(a) });
  assert.strictEqual(atoms[0].bonds().length, 3);
  assert.strictEqual(atoms[3].bonds().length, 1);
});

test('ignores conect records when conectRecords flag is false', function(assert) {
  var structure = io.pdb(CONECT_RECORDS, { conectRecords : false });
  var atoms = [];
  structure.eachAtom(function(a) { atoms.push(a) });
  assert.strictEqual(atoms[0].bonds().length, 0);
  assert.strictEqual(atoms[1].bonds().length, 0);
  assert.strictEqual(atoms[2].bonds().length, 0);
  assert.strictEqual(atoms[3].bonds().length, 0);
  assert.strictEqual(atoms[4].bonds().length, 0);
  assert.strictEqual(atoms[5].bonds().length, 0);
  assert.strictEqual(atoms[6].bonds().length, 0);
  assert.strictEqual(atoms[7].bonds().length, 0);
  assert.strictEqual(atoms[8].bonds().length, 0);
});

// double bond between atom 1 and atom 2 is encoded by repeating the partner
// serial number within a CONECT record's partner list (a convention used by
// e.g. Open Babel), single bonds otherwise.
var CONECT_RECORDS_WITH_ORDER = '\
HETATM    1  C                   0.000   0.000   0.000\n\
HETATM    2  C                   0.000   0.000   0.000\n\
HETATM    3  O                   0.000   0.000   0.000\n\
CONECT    1    2    2    3\n\
CONECT    2    1    1\n\
CONECT    3    1\n\
';

test('derives bond order from repeated conect partners', function(assert) {
  var structure = io.pdb(CONECT_RECORDS_WITH_ORDER, { conectRecords : true });
  var atoms = [];
  structure.eachAtom(function(a) { atoms.push(a) });
  assert.strictEqual(atoms[0].bonds().length, 2);
  var bondToC2 = atoms[0].bonds().filter(function(b) {
    return b.atom_one() === atoms[1] || b.atom_two() === atoms[1];
  })[0];
  var bondToO = atoms[0].bonds().filter(function(b) {
    return b.atom_one() === atoms[2] || b.atom_two() === atoms[2];
  })[0];
  assert.strictEqual(bondToC2.order(), 2);
  assert.strictEqual(bondToO.order(), 1);
});

function bondCounts(structure) {
  var counts = [];
  structure.eachAtom(function(a) { counts.push(a.bonds().length) });
  return counts;
}

test('reads bonds listed from one end only', function() {
  var pdb = '\
HETATM    1  C                   0.000   0.000   0.000\n\
HETATM    2  C                   0.000   0.000   0.000\n\
HETATM    3  O                   0.000   0.000   0.000\n\
CONECT    1    2    3\n\
';
  deepEqual(bondCounts(io.pdb(pdb)), [2, 1, 1]);
});

test('skips conect records pointing at missing atoms', function() {
  // atom 3 was stripped from the file, its records were kept
  var pdb = '\
HETATM    1  C                   0.000   0.000   0.000\n\
HETATM    2  C                   0.000   0.000   0.000\n\
CONECT    1    2    3\n\
CONECT    2    1\n\
CONECT    3    1\n\
CONECT A0000    1\n\
';
  deepEqual(bondCounts(io.pdb(pdb)), [1, 1]);
});

test('reads five-digit partner serials', function() {
  var pdb = '\
HETATM12345  C                   0.000   0.000   0.000\n\
HETATM12346  C                   0.000   0.000   0.000\n\
HETATM12347  O                   0.000   0.000   0.000\n\
CONECT123451234612347\n\
';
  deepEqual(bondCounts(io.pdb(pdb)), [2, 1, 1]);
});


var HETATM='\
ATOM   3316  C   GLY B 214      24.173   7.911  -3.276  1.00 94.23           C\n\
ATOM   3317  O   GLY B 214      24.730   8.496  -4.208  1.00 94.94           O\n\
ATOM   3318  OXT GLY B 214      23.962   8.474  -2.196  1.00 95.71           O\n\
TER    3319      GLY B 214                                                    \n\
HETATM 3320  PA  AP5 A 215      18.089  46.955  20.531  1.00 17.77           P\n\
HETATM 3321  O1A AP5 A 215      17.885  47.954  21.576  1.00 16.47           O\n\
HETATM 3322  O2A AP5 A 215      18.847  47.325  19.359  1.00 15.16           O\n\
ATOM   3317  O   GLY A 216      24.730   8.496  -4.208  1.00 94.94           O\n\
END\n\
'

test('sets HETATM flag', function(assert) {
  var structure = io.pdb(HETATM);
  var atoms = [];
  structure.eachAtom(function(a) { atoms.push(a) });
  assert.strictEqual(atoms[0].isHetatm(), false);
  assert.strictEqual(atoms[1].isHetatm(), false);
  assert.strictEqual(atoms[2].isHetatm(), false);
  assert.strictEqual(atoms[3].isHetatm(), true);
  assert.strictEqual(atoms[4].isHetatm(), true);
  assert.strictEqual(atoms[5].isHetatm(), true);
  assert.strictEqual(atoms[6].isHetatm(), false);

  // check that accessor also works for views. not strictly an IO test
  var view = structure.select();
  atoms = [];
  view.eachAtom(function(a) { atoms.push(a) });
  assert.strictEqual(atoms[0].isHetatm(), false);
  assert.strictEqual(atoms[1].isHetatm(), false);
  assert.strictEqual(atoms[2].isHetatm(), false);
  assert.strictEqual(atoms[3].isHetatm(), true);
  assert.strictEqual(atoms[4].isHetatm(), true);
  assert.strictEqual(atoms[5].isHetatm(), true);
  assert.strictEqual(atoms[6].isHetatm(), false);

});

var OCCUPANCY_AND_TEMP_FACTOR='\
ATOM   3316  C   GLY B 214      24.173   7.911  -3.276100.00 94.23           C\n\
ATOM   3317  O   GLY B 214      24.730   8.496  -4.208  0.55-94.94           O\n\
ATOM   3318  OXT GLY B 214      23.962   8.474  -2.196  1.00999.99           O\n\
ATOM   3317  O   GLY A 216      24.730   8.496  -4.208                       O\n\
END\n\
';

test('guess element from atom name', function(assert) {
  assert.strictEqual('H', io.guessAtomElementFromName('1H2 '));
  assert.strictEqual('H', io.guessAtomElementFromName(' H1 '));
  assert.strictEqual('P', io.guessAtomElementFromName(' P  '));
  assert.strictEqual('O', io.guessAtomElementFromName(' O2\''));
  assert.strictEqual('O', io.guessAtomElementFromName(' O2\''));
  assert.strictEqual('C', io.guessAtomElementFromName(' CA '));
  assert.strictEqual('CA', io.guessAtomElementFromName('CA  '));
  assert.strictEqual('C', io.guessAtomElementFromName(' C  '));
});

test('occupancy and temp-factor', function(assert) {
  var structure = io.pdb(OCCUPANCY_AND_TEMP_FACTOR);
  var atoms = structure.atoms();
  assert.strictEqual(atoms[0].occupancy(), 100.00);
  assert.strictEqual(atoms[1].occupancy(), 0.55);
  assert.strictEqual(atoms[2].occupancy(), 1.00);
  assert.strictEqual(atoms[3].occupancy(), null);

  assert.strictEqual(atoms[0].tempFactor(), 94.23);
  assert.strictEqual(atoms[1].tempFactor(),-94.94);
  assert.strictEqual(atoms[2].tempFactor(), 999.99);
  assert.strictEqual(atoms[3].tempFactor(), null);
});


test('load multi-model PDB file', function(assert) {
  var done = assert.async();
  io.fetchPdb('/tests/data/1nmr.pdb', function(structures) {
    assert.strictEqual(structures.length, 20);
    for (var i = 0; i < structures.length; ++i) {
      // check that all structures have the same number of atoms and 
      // that they have the correct assembly information attached.
      assert.strictEqual(structures[i].atoms().length, 1290);
      assert.strictEqual(structures[i].assembly(), null);
      // check secondary structure assignment
      assert.strictEqual(structures[i].chainByName('A').residueByRnum(19).ss(),  'H');

    }
    done();
  }, { loadAllModels : true });
});

test('only load first model when loadAllModels option is not set', function(assert) {
  var done = assert.async();
  io.fetchPdb('/tests/data/1nmr.pdb', function(structure) {
    assert.strictEqual(structure.atoms().length, 1290);
    assert.strictEqual(structure.assembly(), null);
    assert.strictEqual(structure.chainByName('A').residueByRnum(19).ss(),  'H');
    done();
  });
});

test('fetchPdb resolves its promise with the structure', async function() {
  var structure = await io.fetchPdb('/tests/data/1crn.pdb');
  strictEqual(structure.atoms().length > 0, true);
});

test('fetchPdb rejects on HTTP error and does not call the callback', async function() {
  var called = false;
  var error = null;
  try {
    await io.fetchPdb('/tests/data/missing.pdb', function() { called = true; });
  } catch (e) {
    error = e;
  }
  strictEqual(called, false);
  strictEqual(/HTTP 404/.test(error.message), true);
});

test('fetchPdb rejects when the response holds no structure', async function() {
  var error = null;
  try {
    await io.fetchPdb('/package.json');
  } catch (e) {
    error = e;
  }
  strictEqual(/no structure/.test(error.message), true);
});
