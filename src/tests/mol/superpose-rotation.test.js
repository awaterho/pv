// Regression tests for the rotation produced by superpose().
//
// These drive superpose() with known rigid transforms and check that it
// recovers them, paying particular attention to small and planar atom sets.
// A minimal selection - three residues, CA only - is the awkward case: three
// points, once centred, always lie in a plane, so the correlation between the
// two sets is rank deficient. An SVD/Kabsch implementation has to correct the
// determinant there to avoid returning a mirroring, and getting that
// correction wrong is invisible on ordinary input and catastrophic here.
// superpose() now builds the rotation from a quaternion, which cannot be a
// mirroring, but the pathological cases are worth holding onto regardless.
import { test } from '../helpers';
import { vec3, mat3, quat } from 'gl-matrix';
import io from '../../io';
import sp from '../../mol/superpose';

// Four residues of 1r6a; enough for selections of three or four residues.
var PDB = [
'ATOM   1989  CA  GLY A 259       4.602 -55.267 -16.077  1.00 60.16           C',
'ATOM   1990  C   GLY A 259       5.949 -55.057 -16.740  1.00 61.59           C',
'ATOM   1991  O   GLY A 259       6.986 -55.356 -16.143  1.00 61.84           O',
'ATOM   1992  N   SER A 260       5.956 -54.516 -17.958  1.00 62.63           N',
'ATOM   1993  CA  SER A 260       7.221 -54.335 -18.659  1.00 63.83           C',
'ATOM   1994  C   SER A 260       7.242 -53.395 -19.859  1.00 65.17           C',
'ATOM   1995  O   SER A 260       8.275 -53.275 -20.527  1.00 65.57           O',
'ATOM   1996  CB  SER A 260       7.708 -55.687 -19.142  1.00 63.43           C',
'ATOM   1997  OG  SER A 260       6.810 -56.181 -20.119  1.00 63.29           O',
'ATOM   1998  N   GLY A 261       6.134 -52.732 -20.156  1.00 65.55           N',
'ATOM   1999  CA  GLY A 261       6.143 -51.865 -21.322  1.00 66.39           C',
'ATOM   2000  C   GLY A 261       6.513 -50.410 -21.111  1.00 65.80           C',
'ATOM   2001  O   GLY A 261       7.140 -50.028 -20.128  1.00 64.81           O',
'ATOM   2002  N   THR A 262       6.110 -49.603 -22.081  1.00 65.69           N',
'ATOM   2003  CA  THR A 262       6.326 -48.169 -22.073  1.00 65.64           C',
'ATOM   2004  C   THR A 262       4.926 -47.620 -22.292  1.00 65.69           C',
'ATOM   2005  O   THR A 262       4.152 -48.214 -23.041  1.00 65.75           O',
'ATOM   2006  CB  THR A 262       7.218 -47.748 -23.248  1.00 65.64           C',
'ATOM   2007  OG1 THR A 262       6.747 -48.382 -24.444  1.00 67.19           O',
'ATOM   2008  CG2 THR A 262       8.665 -48.148 -22.998  1.00 65.36           C',
'END'
].join('\n');

// Deterministic PRNG so failures are reproducible.
function makeRandom(seed) {
  var state = seed >>> 0;
  return function() {
    state = (state * 1103515245 + 12345) >>> 0;
    return (state >>> 8) / 0xffffff;
  };
}

function randomRotation(random) {
  // Shoemake's uniform random quaternion.
  var u1 = random(), u2 = random(), u3 = random();
  var q = quat.fromValues(
    Math.sqrt(1 - u1) * Math.sin(2 * Math.PI * u2),
    Math.sqrt(1 - u1) * Math.cos(2 * Math.PI * u2),
    Math.sqrt(u1) * Math.sin(2 * Math.PI * u3),
    Math.sqrt(u1) * Math.cos(2 * Math.PI * u3));
  var rot = mat3.create();
  mat3.fromQuat(rot, q);
  return rot;
}

function applyRigid(structure, rot, trans) {
  var pos = vec3.create();
  var atoms = structure.atoms();
  for (var i = 0; i < atoms.length; ++i) {
    vec3.transformMat3(pos, atoms[i].pos(), rot);
    vec3.add(pos, pos, trans);
    atoms[i].setPos(pos);
  }
}

function rmsd(atomsA, atomsB) {
  var sum = 0;
  for (var i = 0; i < atomsA.length; ++i) {
    sum += vec3.sqrDist(atomsA[i].pos(), atomsB[i].pos());
  }
  return Math.sqrt(sum / atomsA.length);
}

// Positions are stored as float32, so an exactly recoverable transform still
// leaves a little round-off on these coordinates.
var TOLERANCE = 1e-3;

function recoversRigidTransform(assert, numResidues, atomNames, seed) {
  var random = makeRandom(seed);
  var worstMatched = 0;
  var worstAllAtom = 0;
  for (var trial = 0; trial < 50; ++trial) {
    var reference = io.pdb(PDB);
    var subject = io.pdb(PDB);
    applyRigid(subject, randomRotation(random),
               vec3.fromValues((random() - 0.5) * 200, (random() - 0.5) * 200,
                               (random() - 0.5) * 200));
    var range = [259, 259 + numResidues - 1];
    var matched = sp.matchResiduesByNum(subject.select({rnumRange : range}),
                                        reference.select({rnumRange : range}),
                                        atomNames);
    assert.ok(matched !== null);
    var result = sp.superpose(matched[0], matched[1]);
    assert.ok(result !== null);
    var measured = rmsd(matched[0].atoms(), matched[1].atoms());
    // The RMSD superpose() reports comes out of the eigenvalue rather than a
    // second pass over the atoms, so check it against the measured one.
    assert.ok(Math.abs(result.rmsd - measured) < TOLERANCE);
    worstMatched = Math.max(worstMatched, measured);
    // superpose() moves the whole structure, not just the matched subset.
    worstAllAtom = Math.max(worstAllAtom,
                            rmsd(subject.atoms(), reference.atoms()));
  }
  assert.ok(worstMatched < TOLERANCE);
  assert.ok(worstAllAtom < TOLERANCE);
}

// Three CA atoms are the minimal selection and are always coplanar once
// centred, so this is the case that exercises the determinant correction.
test('recovers rigid transform from a 3-residue CA selection', function(assert) {
  recoversRigidTransform(assert, 3, 'CA', 20240101);
});

test('recovers rigid transform from a 4-residue CA selection', function(assert) {
  recoversRigidTransform(assert, 4, 'CA', 20240102);
});

test('recovers rigid transform from a 3-residue backbone selection',
     function(assert) {
  recoversRigidTransform(assert, 3, 'backbone', 20240103);
});

test('recovers rigid transform from all atoms', function(assert) {
  recoversRigidTransform(assert, 4, 'all', 20240104);
});

test('superposition RMSD does not depend on where the subject started',
     function(assert) {
  // The best-fit RMSD between two structures is a property of the pair, so
  // moving the subject around beforehand must not change it.
  //
  // A mirrored subject is the sharpest test of that: no proper rotation can
  // undo a mirroring, so the fit has to settle for the best compromise, and
  // any implementation that reaches for a fixed global axis to resolve the
  // ambiguity will produce an answer that depends on where the subject
  // happened to be sitting.
  var random = makeRandom(20240105);
  var mirror = mat3.create();
  mirror[8] = -1;
  var range = [259, 262];
  var rmsds = [];
  for (var trial = 0; trial < 20; ++trial) {
    var reference = io.pdb(PDB);
    var subject = io.pdb(PDB);
    applyRigid(subject, mirror, vec3.create());
    applyRigid(subject, randomRotation(random),
               vec3.fromValues((random() - 0.5) * 100, (random() - 0.5) * 100,
                               (random() - 0.5) * 100));
    var matched = sp.matchResiduesByNum(subject.select({rnumRange : range}),
                                        reference.select({rnumRange : range}),
                                        'CA');
    var result = sp.superpose(matched[0], matched[1]);
    assert.ok(result !== null);
    rmsds.push(result.rmsd);
  }
  var best = Math.min.apply(null, rmsds);
  var worst = Math.max.apply(null, rmsds);
  // A mirrored structure really cannot be fitted, so the RMSD is non-zero;
  // the point is that it is the *same* non-zero value every time.
  assert.ok(best > 0.1);
  assert.ok(worst - best < TOLERANCE);
});

test('handles a collinear selection without producing NaN', function(assert) {
  // Three collinear atoms leave the rotation about their common axis
  // undetermined. There is still a correct answer - any of those rotations
  // superposes the atoms exactly - and superpose() has to return one of them
  // rather than write NaN over every position in the structure.
  var reference = io.pdb(PDB);
  var subject = io.pdb(PDB);
  var refAtoms = reference.atoms();
  var subAtoms = subject.atoms();
  for (var i = 0; i < 3; ++i) {
    refAtoms[i].setPos(vec3.fromValues(i, 0, 0));
    subAtoms[i].setPos(vec3.fromValues(0, i, 0));
  }
  // Build three-atom views over the collinear atoms of the first residue.
  var views = [];
  var structures = [subject, reference];
  for (var v = 0; v < structures.length; ++v) {
    var view = structures[v].full().createEmptyView();
    var chain = structures[v].chains()[0];
    var residue = chain.residues()[0];
    var outResidue = view.addChain(chain).addResidue(residue);
    var resAtoms = residue.atoms();
    for (var a = 0; a < 3; ++a) {
      outResidue.addAtom(resAtoms[a]);
    }
    views.push(view);
  }
  var result = sp.superpose(views[0], views[1]);
  assert.ok(result !== null);
  // Congruent, so one of those rotations fits them exactly.
  assert.ok(result.rmsd < TOLERANCE);
  var all = subject.atoms();
  for (var k = 0; k < all.length; ++k) {
    var p = all[k].pos();
    assert.ok(isFinite(p[0]) && isFinite(p[1]) && isFinite(p[2]));
  }
});
