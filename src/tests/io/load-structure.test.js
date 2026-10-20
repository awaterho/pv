import { test, strictEqual, ok } from '../helpers';
import io from '../../io';


var CIF_TEXT = [
  '# a leading comment, as mmCIF files from the PDB carry\n',
  'data_1ABC\n',
  'loop_\n',
  '_atom_site.group_PDB\n',
  '_atom_site.id\n',
  '_atom_site.label_atom_id\n',
  '_atom_site.label_comp_id\n',
  '_atom_site.label_asym_id\n',
  '_atom_site.label_seq_id\n',
  '_atom_site.Cartn_x\n',
  '_atom_site.Cartn_y\n',
  '_atom_site.Cartn_z\n',
  '_atom_site.type_symbol\n',
  '_atom_site.pdbx_PDB_model_num\n',
  'ATOM 1 N  GLY A 1 1.000 2.000 3.000 N 1\n',
  'ATOM 2 CA GLY A 1 2.000 2.000 3.000 C 1\n',
  'ATOM 3 C  GLY A 1 3.000 2.000 3.000 C 1\n',
  'ATOM 4 O  GLY A 1 4.000 2.000 3.000 O 1\n'
].join('');

var PDB_TEXT = [
  'ATOM      1  N   GLY A   1       1.000   2.000   3.000  1.00  0.00           N\n',
  'ATOM      2  CA  GLY A   1       2.000   2.000   3.000  1.00  0.00           C\n',
  'ATOM      3  C   GLY A   1       3.000   2.000   3.000  1.00  0.00           C\n',
  'ATOM      4  O   GLY A   1       4.000   2.000   3.000  1.00  0.00           O\n',
  'END\n'
].join('');

var SDF_TEXT = [
  'Simple Ligand\n',
  '\n',
  ' Teststructure\n',
  '  2  1  0  0  1  0            999 V2000\n',
  '    0.0000    0.0000    0.0000 N   0  3  0  0  0  0\n',
  '    1.0000    0.0000    0.0000 C   0  0  0  0  0  0\n',
  '  1  2  1  0  0  0\n',
  'M  END\n',
  '$$$$\n'
].join('');

var CRD_TEXT = [
  '* CHARMM coordinates\n',
  '*\n',
  '    2\n',
  '    1    1 GLY  N      1.00000   2.00000   3.00000 A    1      0.00000\n',
  '    2    1 GLY  CA     2.00000   2.00000   3.00000 A    1      0.00000\n'
].join('');


test('guessFormat takes the format from a known extension', function() {
  strictEqual(io.guessFormat('', '1ake.cif'), 'cif');
  strictEqual(io.guessFormat('', 'MODEL.MMCIF'), 'cif');
  strictEqual(io.guessFormat('', '1ake.pdb'), 'pdb');
  strictEqual(io.guessFormat('', 'pdb1ake.ent'), 'pdb');
  strictEqual(io.guessFormat('', 'ligand.sdf'), 'sdf');
  strictEqual(io.guessFormat('', 'ligand.mol'), 'sdf');
  strictEqual(io.guessFormat('', 'system.crd'), 'crd');
});

test('guessFormat looks past .gz and a URL query or fragment', function() {
  strictEqual(io.guessFormat('', 'https://files.rcsb.org/download/1AKE.cif.gz'), 'cif');
  strictEqual(io.guessFormat('', 'https://example.org/model.pdb?v=2'), 'pdb');
  strictEqual(io.guessFormat('', 'https://example.org/model.cif#chainA'), 'cif');
});

test('guessFormat falls back to the text when the name says nothing', function() {
  strictEqual(io.guessFormat(CIF_TEXT), 'cif');
  strictEqual(io.guessFormat(PDB_TEXT), 'pdb');
  strictEqual(io.guessFormat(SDF_TEXT), 'sdf');
  strictEqual(io.guessFormat(CRD_TEXT), 'crd');
  // a name without an extension, or with one of some other file, is no help
  strictEqual(io.guessFormat(CIF_TEXT, 'structure'), 'cif');
  strictEqual(io.guessFormat(PDB_TEXT, 'structure.txt'), 'pdb');
});

// URLs that don't end in a file name at all: the format can only come from
// what the server sends back
test('guessFormat reads the text for a URL with no extension', function() {
  var URLS = [
    'https://modelarchive.org/doi/10.5452/ma-bak-cepc-0001',
    'https://example.org/api/structure/1ake',
    'https://example.org/download?id=1ake&format=mmcif',
    'https://example.org/v1.2/fetch/1ake',
    'https://example.org/entries/1ake#chainA'
  ];
  for (var i = 0; i < URLS.length; ++i) {
    strictEqual(io.guessFormat(CIF_TEXT, URLS[i]), 'cif');
    strictEqual(io.guessFormat(PDB_TEXT, URLS[i]), 'pdb');
    strictEqual(io.guessFormat(SDF_TEXT, URLS[i]), 'sdf');
    strictEqual(io.guessFormat(CRD_TEXT, URLS[i]), 'crd');
  }
});

test('a dot in the host or path is not taken for an extension', function() {
  // "files.rcsb.org/.../1ake" must not read as the extension "org/download/1ake"
  strictEqual(io.guessFormat(PDB_TEXT, 'https://files.rcsb.org/download/1ake'), 'pdb');
  // nor "10.5452/ma-bak-cepc-0001" as one
  strictEqual(io.guessFormat(PDB_TEXT, 'https://modelarchive.org/doi/10.5452/ma-bak-cepc-0001'), 'pdb');
});

test('mmCIF without a data_ block header is still read as mmCIF', function() {
  var stripped = CIF_TEXT.split('data_1ABC\n').join('');
  strictEqual(io.guessFormat(stripped), 'cif');
  strictEqual(io.loadStructure(stripped).atomCount(), 4);
});

test('the extension wins over the text', function() {
  // a PDB file whose first line happens to start with a * is still a PDB file
  strictEqual(io.guessFormat('*anything\n' + PDB_TEXT, 'model.pdb'), 'pdb');
});

test('loadStructure reads mmCIF and PDB without being told which', function() {
  var fromCif = io.loadStructure(CIF_TEXT);
  strictEqual(fromCif.atomCount(), 4);
  var fromPdb = io.loadStructure(PDB_TEXT);
  strictEqual(fromPdb.atomCount(), 4);
  // and the same by name, with text that gives nothing away
  strictEqual(io.loadStructure(PDB_TEXT, { name : 'model.pdb' }).atomCount(), 4);
});

test('loadStructure reads SDF and CRD too', function() {
  strictEqual(io.loadStructure(SDF_TEXT).atomCount(), 2);
  strictEqual(io.loadStructure(CRD_TEXT).atomCount(), 2);
});

test('an explicit format skips the guessing', function() {
  // the .pdb name would have picked the PDB reader for mmCIF text
  var s = io.loadStructure(CIF_TEXT, { name : 'wrongly-named.pdb', format : 'cif' });
  strictEqual(s.atomCount(), 4);
});

test('loadStructure passes its options on to the parser it picks', function() {
  var trace = io.loadStructure(CIF_TEXT, { traceOnly : true });
  strictEqual(trace.atomCount(), 1);
  ok(trace.atom('A.1.CA') !== null);
});

test('loadStructure returns nothing for text with no atoms', function() {
  ok(!io.loadStructure('data_empty\n'));
  ok(!io.loadStructure('HEADER    NOTHING HERE\nEND\n'));
});
