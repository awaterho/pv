import { test, strictEqual, ok, almostEqualAssert } from './helpers';
import fs from 'node:fs';
import io from '../io';
import { spotlightSpheres } from '../spotlight';

function load(id) {
  return io.cif(fs.readFileSync('structures/' + id + '.cif', 'utf8'));
}

function spheres(packed) {
  const out = [];
  for (let i = 0; i < packed.length; i += 4) {
    out.push({ center: [packed[i], packed[i + 1], packed[i + 2]], r: packed[i + 3] });
  }
  return out;
}

function enclosesAtoms(sphereList, view) {
  let all = true;
  view.eachAtom((atom) => {
    const p = atom.pos();
    all = all && sphereList.some((s) =>
      Math.hypot(p[0] - s.center[0], p[1] - s.center[1], p[2] - s.center[2]) <= s.r + 1e-3);
  });
  return all;
}

test('a point per atom when they fit', function() {
  const view = load('1ake').select({ cname: 'A', rnumRange: [10, 14] });
  const found = spheres(spotlightSpheres(view, 128));
  strictEqual(found.length, view.atomCount());
  ok(found.every((s) => s.r === 0));
  ok(enclosesAtoms(found, view));
});

test('runs of a few atoms when they do not', function() {
  const view = load('1ake').select({ cname: 'A', rnumRange: [10, 29] });
  const found = spheres(spotlightSpheres(view, 128));
  ok(found.length <= 128);
  ok(found.length > 20);
  // tighter than one sphere per residue
  ok(found.every((s) => s.r < 3));
  ok(enclosesAtoms(found, view));
});

test('the shortest runs of atoms that fit', function() {
  // 100 residues: runs of a few atoms fit where whole residues would be
  // fewer but coarser
  const view = load('1ake').select({ cname: 'A', rnumRange: [1, 100] });
  const found = spheres(spotlightSpheres(view, 128));
  ok(found.length <= 128);
  ok(found.length > 100);
  ok(enclosesAtoms(found, view));
});

test('points are spheres of radius 0', function() {
  const found = spheres(spotlightSpheres([[1, 2, 3], [4, 5, 6]], 128));
  strictEqual(found.length, 2);
  strictEqual(found[1].r, 0);
  almostEqualAssert(found[1].center[2], 6);
});

test('a single point is one sphere', function() {
  strictEqual(spotlightSpheres([1, 2, 3], 128).length, 4);
});

test('more residues than fit are merged, still enclosing every atom', function() {
  const structure = load('1ake');
  const found = spheres(spotlightSpheres(structure, 64));
  ok(found.length <= 64);
  ok(found.length > 32);
  ok(enclosesAtoms(found, structure));
});

test('more chains than fit are merged across chains', function() {
  const points = [];
  for (let i = 0; i < 200; ++i) {
    points.push([i, 0, 0]);
  }
  const structure = load('1ake');
  const found = spheres(spotlightSpheres([structure].concat(points), 8));
  ok(found.length <= 8);
  ok(enclosesAtoms(found, structure));
});

test('nothing to spotlight gives no spheres', function() {
  strictEqual(spotlightSpheres([], 64).length, 0);
});
