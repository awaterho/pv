import { test, strictEqual, deepEqual, ok, almostEqualAssert } from './helpers';
import fs from 'node:fs';
import io from '../io';
import mol from '../mol/all';
import color from '../color';
import membrane from '../membrane';
import { vec3 } from 'gl-matrix';

// a membrane 30 Å thick, normal along z, from z = 0 to z = 30
const MEMBRANE = {
  axis: [0, 0, 1],
  plane_one_center: [0, 0, 30],
  plane_two_center: [0, 0, 0],
  radius: 10,
};

// a structure with atoms at the given positions
function structureOf(positions) {
  const structure = new mol.Mol();
  const residue = structure.addChain('A').addResidue('ALA', 1);
  positions.forEach((p) => residue.addAtom('CA', vec3.clone(p), 'C'));
  return structure;
}

function stubViewer() {
  const calls = { triangles: [], tubes: [], points: [], lines: [] };
  return {
    calls,
    customMesh: () => ({
      addTriangles: (positions, opts) => calls.triangles.push({ positions, opts }),
      addTube: (start, end, radius, opts) => calls.tubes.push({ start, end, radius, opts }),
    }),
    points: (name, structure, opts) => calls.points.push({ structure, opts }),
    lines: (name, structure, opts) => calls.lines.push({ name, structure, opts }),
    requestRedraw: () => {},
  };
}

function dotsOf(viewer) {
  const dots = [];
  viewer.calls.points[0].structure.eachAtom((a) => dots.push(a.pos()));
  return dots;
}

test('measures depth from the middle of the membrane, along its axis', function() {
  almostEqualAssert(membrane.depth(MEMBRANE, [5, 5, 15]), 0);
  almostEqualAssert(membrane.depth(MEMBRANE, [0, 0, 30]), 15);
  almostEqualAssert(membrane.depth(MEMBRANE, [0, 0, -3]), -18);
});

test('colors the core, the headgroup layers and the rest', function() {
  const op = membrane.color(MEMBRANE, color.uniform('blue'));
  const structure = structureOf([[0, 0, 15], [0, 0, 33], [0, 0, -4], [0, 0, 50]]);
  op.begin(structure);
  const colors = [];
  structure.eachAtom((atom) => {
    const out = [0, 0, 0, 0];
    op.colorFor(atom, out, 0);
    colors.push(out.slice(0, 3).map((v) => Math.round(v * 255)));
  });
  op.end();
  deepEqual(colors, [[248, 196, 113], [217, 84, 43], [217, 84, 43], [0, 0, 255]]);
});

test('leaves out the dots near the atoms', function() {
  const empty = stubViewer();
  membrane.draw(empty, 'membrane', structureOf([]), MEMBRANE);
  const viewer = stubViewer();
  // an atom on the upper plane, and one between the planes, reaching neither
  const atoms = [[1, 1, 30], [0, 0, 15]];
  membrane.draw(viewer, 'membrane', structureOf(atoms), MEMBRANE);
  const all = dotsOf(empty), cut = dotsOf(viewer);
  ok(cut.length < all.length);
  // dots on both planes, within the radius (10 + 8 Å)
  ok(all.every((p) => (p[2] === 0 || p[2] === 30) && Math.hypot(p[0], p[1]) <= 18));
  // exactly those closer to the atom than the clearance are gone
  const near = all.filter((p) => vec3.distance(p, atoms[0]) < 3.5);
  ok(near.length > 0);
  strictEqual(cut.length, all.length - near.length);
  ok(cut.every((p) => vec3.distance(p, atoms[0]) >= 3.5));
});

test('outlines the cross-section of the atoms in each plane', function() {
  // a column of atoms through both planes
  const column = [];
  for (let z = -5; z <= 35; z += 1.5) column.push([0, 0, z]);
  const viewer = stubViewer();
  membrane.draw(viewer, 'membrane', structureOf(column), MEMBRANE, { style: 'plane' });
  // drawn as lines of their own, one closed ring of bonded atoms per plane,
  // around the column at about 3 Å
  strictEqual(viewer.calls.lines.length, 1);
  strictEqual(viewer.calls.lines[0].name, 'membrane.outline');
  const rings = viewer.calls.lines[0].structure.chains()[0].residues();
  strictEqual(rings.length, 2);
  for (const ring of rings) {
    for (const atom of ring.atoms()) {
      strictEqual(atom.bonds().length, 2);
      const p = atom.pos();
      ok(Math.hypot(p[0], p[1]) > 2 && Math.hypot(p[0], p[1]) < 3.5);
    }
  }
});

test('draws a slab and rings without atoms', function() {
  const slab = stubViewer();
  membrane.draw(slab, 'membrane', structureOf([]), MEMBRANE, { style: 'slab' });
  // the wall, two caps and two rims
  strictEqual(slab.calls.triangles.length, 5);
  const rings = stubViewer();
  membrane.draw(rings, 'membrane', structureOf([]), MEMBRANE, { style: 'rings' });
  // two circles and the arrowhead, and the axis as a tube
  strictEqual(rings.calls.triangles.length, 3);
  strictEqual(rings.calls.tubes.length, 1);
});

test('cuts the membrane with every copy of showRelated', function() {
  const porin = io.cif(fs.readFileSync('structures/2por.cif', 'utf8'));
  // SWISS-MODEL's membrane of the porin trimer
  const porinMembrane = {
    axis: [-0.00079, -0.000068, 1],
    plane_one_center: [-2.704, -4.524, 30.987],
    plane_two_center: [-2.686, -4.523, 8.046],
    radius: 48.85,
  };
  const count = (showRelated) => {
    const viewer = stubViewer();
    membrane.draw(viewer, 'membrane', porin, porinMembrane, { showRelated });
    return dotsOf(viewer).length;
  };
  const none = count('asym'), trimer = count('1');
  const empty = stubViewer();
  membrane.draw(empty, 'membrane', structureOf([]), porinMembrane);
  const all = dotsOf(empty).length;
  // the other two chains take out about as many dots again each, less
  // where the chains touch
  const ratio = (all - trimer) / (all - none);
  ok(ratio > 2.5 && ratio <= 3);
});
