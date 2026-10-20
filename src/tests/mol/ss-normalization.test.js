import { test } from '../helpers';
import residue from '../../mol/residue';
import io from '../../io';

var ssType = residue.ssType;

// DSSP annotation of chain A of PDB entry 6ifp, as served by the SWISS-MODEL
// template library. Uses the full 8-state alphabet: C, E, T, S, B, G and H.
var DSSP_6IFP_A =
  'CEEEEEEEEEETTEEEEEESSEEEECTTCEEEEECCSTTCCCEECTTCSCTTCCCCBCCTTCC' +
  'EEEECCSCEEEEEECGGGTTTTCEEEEEESSSCTTHHHHHHSCCCHHHHHHHHHHHHHTTC';

test('ssType collapses the 8-state alphabet onto C, H and E', function(assert) {
  assert.strictEqual(ssType('H'), 'H');
  assert.strictEqual(ssType('G'), 'H', '3-10 helix is a helix');
  assert.strictEqual(ssType('I'), 'H', 'pi helix is a helix');
  assert.strictEqual(ssType('E'), 'E');
  assert.strictEqual(ssType('B'), 'E', 'isolated beta bridge is a strand');
  assert.strictEqual(ssType('T'), 'C', 'turn is coil');
  assert.strictEqual(ssType('S'), 'C', 'bend is coil');
  assert.strictEqual(ssType('C'), 'C');
});

test('ssType treats unassigned and malformed codes as coil', function(assert) {
  assert.strictEqual(ssType(''), 'C');
  assert.strictEqual(ssType(' '), 'C', 'DSSP leaves "none" blank');
  assert.strictEqual(ssType(undefined), 'C', 'indexing past a short string');
  assert.strictEqual(ssType(null), 'C');
  assert.strictEqual(ssType('?'), 'C');
});

test('ssType accepts lowercase codes', function(assert) {
  assert.strictEqual(ssType('h'), 'H');
  assert.strictEqual(ssType('g'), 'H');
  assert.strictEqual(ssType('e'), 'E');
  assert.strictEqual(ssType('b'), 'E');
  assert.strictEqual(ssType('t'), 'C');
});

// The cartoon renderer tests residues against 'C', 'H' and 'E' in four places
// (tube profile frame, strand smoothing, arrow heads and the coil->helix
// transition fix-up). A code outside that alphabet reaching a residue draws a
// twisted tube, so the normalization has to happen on assignment.
test('setSS normalizes 8-state annotation on assignment', function(assert) {
  var done = assert.async();
  io.fetchPdb('tests/data/1crn.pdb', function(structure) {
    var i = 0;
    structure.eachResidue(function(r) {
      r.setSS(DSSP_6IFP_A[i % DSSP_6IFP_A.length]);
      i += 1;
    });
    var assigned = '';
    structure.eachResidue(function(r) { assigned += r.ss(); });
    assert.strictEqual(assigned.length, i);
    assert.strictEqual(/^[CHE]+$/.test(assigned), true,
                       'only 3-state codes reach the renderer');
    var expected = '';
    for (var j = 0; j < i; ++j) {
      expected += ssType(DSSP_6IFP_A[j % DSSP_6IFP_A.length]);
    }
    assert.strictEqual(assigned, expected);
    done();
  });
});
