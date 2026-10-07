import { test, strictEqual, deepEqual, ok } from './helpers';
import fs from 'node:fs';
import io from '../io';
import rings from '../rings';
import { vec3 } from 'gl-matrix';

function load(id) {
  return io.cif(fs.readFileSync('structures/' + id + '.cif', 'utf8'));
}

test('finds the one pyranose ring of a sugar, in ring order', function() {
  const nag = load('4byh').chainByName('C').residues()[0];
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
  const inhibitor = load('4umt').chainByName('C').residues()[0];
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

// 2-oxo-dATP (6U4) bound to MTH1, chain A of PDB 5GHJ: a free nucleotide in
// a chain of its own
const FREE_NUCLEOTIDE_CIF = [
  'data_5GHJ',
  'loop_',
  '_atom_site.group_PDB',
  '_atom_site.id',
  '_atom_site.type_symbol',
  '_atom_site.label_atom_id',
  '_atom_site.label_alt_id',
  '_atom_site.label_comp_id',
  '_atom_site.label_asym_id',
  '_atom_site.label_seq_id',
  '_atom_site.Cartn_x',
  '_atom_site.Cartn_y',
  '_atom_site.Cartn_z',
  `HETATM 2794 P PG . 6U4 C . -7.076 -2.247 -9.336`,
  `HETATM 2795 O O3G . 6U4 C . -6.633 -0.808 -9.347`,
  `HETATM 2796 O O2G . 6U4 C . -7.066 -2.929 -7.982`,
  `HETATM 2797 O O1G . 6U4 C . -8.336 -2.479 -10.154`,
  `HETATM 2798 P PB . 6U4 C . -5.041 -4.313 -9.905`,
  `HETATM 2799 O O1B . 6U4 C . -5.923 -5.483 -9.601`,
  `HETATM 2800 O O2B . 6U4 C . -3.916 -3.976 -8.964`,
  `HETATM 2801 O O3B . 6U4 C . -5.931 -2.982 -10.210`,
  `HETATM 2802 P PA . 6U4 C . -5.068 -4.841 -12.797`,
  `HETATM 2803 O O2A . 6U4 C . -6.096 -5.918 -12.705`,
  `HETATM 2804 O O1A . 6U4 C . -5.411 -3.521 -13.431`,
  `HETATM 2805 O O3A . 6U4 C . -4.394 -4.536 -11.365`,
  `HETATM 2806 O "O5'" . 6U4 C . -3.760 -5.402 -13.509`,
  `HETATM 2807 C "C5'" . 6U4 C . -3.798 -5.855 -14.870`,
  `HETATM 2808 C "C4'" . 6U4 C . -3.264 -7.269 -14.882`,
  `HETATM 2809 O "O4'" . 6U4 C . -3.539 -7.814 -16.170`,
  `HETATM 2810 C "C3'" . 6U4 C . -1.762 -7.312 -14.709`,
  `HETATM 2811 O "O3'" . 6U4 C . -1.399 -8.571 -14.133`,
  `HETATM 2812 C "C2'" . 6U4 C . -1.272 -7.276 -16.150`,
  `HETATM 2813 C "C1'" . 6U4 C . -2.351 -8.100 -16.871`,
  `HETATM 2814 N N9 . 6U4 C . -2.459 -7.681 -18.288`,
  `HETATM 2815 C C8 . 6U4 C . -2.930 -6.502 -18.730`,
  `HETATM 2816 N N7 . 6U4 C . -2.831 -6.462 -20.084`,
  `HETATM 2817 C C5 . 6U4 C . -2.301 -7.652 -20.461`,
  `HETATM 2818 C C6 . 6U4 C . -1.952 -8.185 -21.696`,
  `HETATM 2819 N N6 . 6U4 C . -2.137 -7.483 -22.841`,
  `HETATM 2820 N N1 . 6U4 C . -1.381 -9.402 -21.706`,
  `HETATM 2821 C C2 . 6U4 C . -1.208 -10.141 -20.578`,
  `HETATM 2822 N N3 . 6U4 C . -1.545 -9.655 -19.361`,
  `HETATM 2823 C C4 . 6U4 C . -2.067 -8.409 -19.321`,
  `HETATM 2824 O O2 . 6U4 C . -0.750 -11.289 -20.668`,
].join('\n');

test('leaves out free nucleotides, which have no tube to stand on', function() {
  const s = io.cif(FREE_NUCLEOTIDE_CIF);
  const ligand = s.chainByName('C').residues()[0];
  ok(ligand.isNucleotide());
  const viewer = stubViewer();
  rings.drawBases(viewer, 'bases', s, { sticks: true });
  strictEqual(viewer.calls.triangles.length, 0);
  strictEqual(viewer.calls.tubes.length, 0);
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
