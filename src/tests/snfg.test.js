import { test, strictEqual, deepEqual, ok } from './helpers';
import fs from 'node:fs';
import io from '../io';
import snfg from '../snfg';
import { shapeGeometry } from '../snfg/shapes';
import { vec3 } from 'gl-matrix';

// sialylated IgG1 Fc (the demo's glycan example): two N-glycans of ten
// sugars each, label chains C and D, on Asn297 of chains A and B.
function loadFc() {
  return io.cif(fs.readFileSync('structures/4byh.cif', 'utf8'));
}

// records what draw() puts into the mesh, without WebGL
function stubViewer() {
  const calls = { tubes: [], triangles: [] };
  return {
    calls,
    customMesh: function() {
      return {
        addTube: function(start, end, radius, opts) { calls.tubes.push({ start, end, radius, opts }); },
        addTriangles: function(positions, opts) { calls.triangles.push({ positions, opts }); },
      };
    },
    requestRedraw: function() {},
  };
}

test('reads the SNFG symbol names of the sugars from the mmCIF file', function() {
  const fc = loadFc();
  const glycan = fc.chain('C').residues();
  deepEqual(glycan.map((r) => snfg.snfgName(r)),
            ['GlcNAc', 'GlcNAc', 'Man', 'Man', 'GlcNAc', 'Gal', 'Neu5Ac', 'Man', 'GlcNAc', 'Fuc']);
  strictEqual(snfg.symbol(glycan[0]).shape, 'cube');
  strictEqual(snfg.symbol(glycan[6]).shape, 'diamond');
  strictEqual(snfg.symbol(glycan[9]).shape, 'cone');
  strictEqual(snfg.symbol(fc.chain('A').residues()[0]), null);
  strictEqual(fc.select('carbohydrate').residueCount(), 20);
});

test('links the glycans to each other and to Asn297 through _struct_conn', function() {
  const fc = loadFc();
  const nag = fc.chain('C').residues()[0];
  const asn = fc.chain('A').residues().find((r) => r.name() === 'ASN' && r.prop('authSeqId') === '297');
  ok(!!asn);
  ok(nag.atom('C1').isConnectedTo(asn.atom('ND2')));
  ok(nag.atom('O4').isConnectedTo(fc.chain('C').residues()[1].atom('C1')));
});

test('draws one symbol per sugar, a stick per link and one to each Asn', function() {
  const fc = loadFc();
  const viewer = stubViewer();
  snfg.draw(viewer, 'glycans', fc);
  const { tubes, triangles } = viewer.calls;
  strictEqual(triangles.length, 20);
  // Man and Gal are smooth spheres: per glycan 3 Man + 1 or 2 Gal
  strictEqual(triangles.filter((t) => t.opts.normals !== undefined).length, 3 + 1 + 3 + 2);
  // 9 links within each ten-sugar tree, plus the one to Asn297
  strictEqual(tubes.length, 2 * (9 + 1));
  // each symbol sits on its ring: within half an Angstrom of the residue's
  // C1-O5 midpoint region, i.e. close to the ring atoms' center
  const nag = fc.chain('C').residues()[0];
  const ring = ['C1', 'C2', 'C3', 'C4', 'C5', 'O5'].map((n) => nag.atom(n).pos());
  const center = ring.reduce((c, p) => vec3.add(c, c, p), vec3.create());
  vec3.scale(center, center, 1 / 6);
  const cube = triangles.find((t) => t.opts.userData.residue() === nag);
  ok(!!cube);
  const mean = vec3.create();
  for (let i = 0; i < cube.positions.length; i += 3) {
    vec3.add(mean, mean, [cube.positions[i], cube.positions[i + 1], cube.positions[i + 2]]);
  }
  vec3.scale(mean, mean, 3 / cube.positions.length);
  ok(vec3.distance(mean, center) < 0.01);
});

function ringCenter(residue, names) {
  const c = vec3.create();
  names.forEach((n) => vec3.add(c, c, residue.atom(n).pos()));
  return vec3.scale(c, c, 1 / names.length);
}

function vertexMean(positions) {
  const mean = vec3.create();
  for (let i = 0; i < positions.length; i += 3) {
    vec3.add(mean, mean, [positions[i], positions[i + 1], positions[i + 2]]);
  }
  return vec3.scale(mean, mean, 3 / positions.length);
}

test('turns each cone base to its parent sugar, the tip away from it', function() {
  const fc = loadFc();
  const viewer = stubViewer();
  snfg.draw(viewer, 'glycans', fc);
  const glycan = fc.chain('C').residues();
  const pyranose = ['C1', 'C2', 'C3', 'C4', 'C5', 'O5'];
  // core Fuc 10 hangs off the O6 of the first GlcNAc
  const fuc = glycan[9], nag = glycan[0];
  ok(fuc.atom('C1').isConnectedTo(nag.atom('O6')));
  const cone = viewer.calls.triangles.find((t) => t.opts.userData.residue() === fuc);
  // a cone's vertices lie mostly on its base, so their mean is shifted
  // from the ring center towards the base, which faces the GlcNAc
  const center = ringCenter(fuc, pyranose);
  const towardsBase = vec3.sub(vec3.create(), vertexMean(cone.positions), center);
  const towardsParent = vec3.sub(vec3.create(), ringCenter(nag, pyranose), center);
  ok(vec3.dot(vec3.normalize(towardsBase, towardsBase),
              vec3.normalize(towardsParent, towardsParent)) > 0.99);
});

test('every SNFG shape is closed and wound outward', function() {
  for (const shape of ['sphere', 'cube', 'crossedCube', 'diamond', 'dividedDiamond', 'flatDiamond',
                       'cone', 'dividedCone', 'flatRectangle', 'star', 'flatHexagon',
                       'pentagon']) {
    const { triangles, colored } = shapeGeometry(shape);
    // closed: the signed volume (divergence theorem) is positive
    let volume = 0;
    for (const [a, b, c] of triangles) {
      volume += vec3.dot(a, vec3.cross(vec3.create(), b, c)) / 6;
    }
    ok(volume > 0);
    if (colored !== undefined) {
      const n = triangles.filter(colored).length;
      ok(n > 0 && n < triangles.length);
    }
  }
});

test('colors sugar atoms by SNFG and the rest by the fallback', function() {
  const fc = loadFc();
  const op = snfg.color();
  op.begin(fc);
  const out = [0, 0, 0, 0];
  op.colorFor(fc.chain('C').residues()[9].atom('C1'), out, 0);   // Fuc: red
  deepEqual(out.map((v) => Math.round(v * 255)), [237, 28, 36, 255]);
  op.colorFor(fc.chain('A').residues()[0].atom('N'), out, 0);    // by element
  ok(out[2] > out[0]);
  op.end();
});
