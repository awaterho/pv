import { test, strictEqual, deepEqual, ok } from './helpers';
import fs from 'node:fs';
import io from '../io';
import rings from '../rings';
import { vec3 } from 'gl-matrix';

function load(id) {
  return io.cif(fs.readFileSync('structures/' + id + '.cif', 'utf8'));
}

test('finds the one pyranose ring of a sugar, in ring order', function() {
  const nag = load('4byh').chain('C').residues()[0];
  const found = rings.findRings(nag);
  strictEqual(found.length, 1);
  deepEqual(found[0].map((a) => a.name()).sort(), ['C1', 'C2', 'C3', 'C4', 'C5', 'O5']);
  // consecutive ring atoms are bonded
  const ring = found[0];
  for (let i = 0; i < ring.length; ++i) {
    ok(ring[i].isConnectedTo(ring[(i + 1) % ring.length]));
  }
});

test('finds fused rings as their small rings', function() {
  // the MELK inhibitor 47W: isoquinoline (two fused 6-rings), a benzene
  // ring and a piperazine
  const inhibitor = load('4umt').chain('C').residues()[0];
  const found = rings.findRings(inhibitor);
  deepEqual(found.map((r) => r.length), [6, 6, 6, 6]);
});

test('fills each ring with a two-sided fan, colored by SNFG for sugars', function() {
  const fc = load('4byh');
  const added = [];
  const viewer = {
    customMesh: () => ({ addTriangles: (positions, opts) => added.push({ positions, opts }) }),
    requestRedraw: () => {},
  };
  rings.draw(viewer, 'rings', fc.select({ cname: 'C' }));
  strictEqual(added.length, 10);
  // a 6-ring: 6 fan triangles, each twice
  strictEqual(added[0].positions.length, 6 * 2 * 9);
  // the first sugar, GlcNAc, is SNFG blue
  deepEqual(Array.from(added[0].opts.color).slice(0, 3).map((v) => Math.round(v * 255)),
            [0, 144, 188]);
});

function stubViewer() {
  const calls = { triangles: [], tubes: [] };
  return {
    calls,
    customMesh: () => ({
      addTriangles: (positions, opts) => calls.triangles.push({ positions, opts }),
      addTube: (start, end, radius, opts) => calls.tubes.push({ start, end, radius, opts }),
    }),
    requestRedraw: () => {},
  };
}

test('draws each base as filled rings, without sticks by default', function() {
  const trna = load('1ehz');
  const viewer = stubViewer();
  rings.drawBases(viewer, 'bases', trna);
  ok(viewer.calls.triangles.length > 0);
  // only the outlines' thin tubes
  ok(viewer.calls.tubes.every((t) => t.radius === 0.12));
});

test('draws each base on a stick from C3\' if asked, colored like its parent base', function() {
  const trna = load('1ehz');
  const viewer = stubViewer();
  rings.drawBases(viewer, 'bases', trna, { sticks: true });
  const nucleotides = [];
  trna.eachResidue((r) => { if (r.isNucleotide()) nucleotides.push(r); });
  strictEqual(nucleotides.length, 76);
  // one stick per base, from C3' to the base atom bonded to C1'
  const sticks = viewer.calls.tubes.filter((t) => t.radius === 0.3);
  strictEqual(sticks.length, 76);
  const g1 = nucleotides[0];
  strictEqual(g1.name(), 'G');
  deepEqual(Array.from(sticks[0].start), Array.from(g1.atom("C3'").pos()));
  deepEqual(Array.from(sticks[0].end), Array.from(g1.atom('N9').pos()));
  // pseudouridine is a C-glycoside: its stick ends at C5, and it's colored
  // like U, its parent
  const psu = nucleotides.find((r) => r.name() === 'PSU');
  strictEqual(psu.prop('parentCompId'), 'U');
  const psuStick = sticks[nucleotides.indexOf(psu)];
  deepEqual(Array.from(psuStick.end), Array.from(psu.atom('C5').pos()));
  deepEqual(psuStick.opts.color, rings.baseColor(nucleotides.find((r) => r.name() === 'U')));
});

test('draws the symmetry copies of an assembly', function() {
  // Pariacoto virus: the RNA of one asymmetric unit in the file, 60 copies
  // in the icosahedral assembly 1
  const virus = load('1f8v');
  const asym = stubViewer(), capsid = stubViewer();
  rings.drawBases(asym, 'bases', virus, { sticks: true });
  rings.drawBases(capsid, 'bases', virus, { sticks: true, showRelated: '1' });
  ok(asym.calls.triangles.length > 0);
  strictEqual(capsid.calls.triangles.length, 60 * asym.calls.triangles.length);
  // the copies are moved: the first copy's first stick is the original
  // one, a later copy's isn't
  const perCopy = asym.calls.tubes.length;
  deepEqual(Array.from(capsid.calls.tubes[0].start), Array.from(asym.calls.tubes[0].start));
  ok(vec3.distance(capsid.calls.tubes[perCopy * 7].start, asym.calls.tubes[0].start) > 1);
});
