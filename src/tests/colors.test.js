import { test, strictEqual, deepEqual, ok } from './helpers';
import fs from 'node:fs';
import color from '../color';
import io from '../io';

function compareColor(lhs, rhs) {
  strictEqual(lhs[0], rhs[0]);
  strictEqual(lhs[1], rhs[1]);
  strictEqual(lhs[2], rhs[2]);
}

test("force rgb from hex triplet", function() {
  var red = [1.0, 0.0, 0.0];
  compareColor([1.0, 0.0, 0.0], color.forceRGB('#f00'));
  compareColor([1.0, 0.0, 0.0], color.forceRGB('#ff0000'));
  compareColor([1.0, 1.0, 0.0], color.forceRGB('#ff0'));
  compareColor([1.0, 1.0, 0.0], color.forceRGB('#ffff00'));
});

test("force rgb from hex quadruplet", function() {
  compareColor([1.0, 0.0, 0.0, 1.0], color.forceRGB('#f00f'));
  compareColor([1.0, 0.0, 0.0, 0.0], color.forceRGB('#f000'));
  compareColor([1.0, 0.0, 0.0, 1.0], color.forceRGB('#ff0000ff'));
  compareColor([1.0, 0.0, 0.0, 0.0], color.forceRGB('#ff000000'));
});

test("force rgb from rgb", function() {
  var red = [1.0, 0.0, 0.0];
  compareColor([1.0, 0.0, 0.0], color.forceRGB([1.0, 0.0, 0.0]));
  compareColor([1.0, 1.0, 0.0], color.forceRGB([1.0, 1.0, 0.0]));
});

test("force rgb from color names", function() {
  var red = [1.0, 0.0, 0.0];
  compareColor([1.0, 0.0, 0.0], color.forceRGB('red'));
  compareColor([1.0, 1.0, 0.0], color.forceRGB('yellow'));
});

// titin-telethonin: six protein chains (A-F) among 17 label chains, the rest
// sulfates and waters. Entity 1 is chains A, B, D and E, entity 2 C and F.
function loadTitin() {
  return io.cif(fs.readFileSync('structures/2f8v.cif', 'utf8'));
}

function colorOfChain(op, structure, chainName) {
  var out = [0, 0, 0, 0];
  op.colorFor(structure.chainByName(chainName).residues()[0].atoms()[0], out, 0);
  return out;
}

function closeColor(lhs, rhs) {
  for (var i = 0; i < 4; ++i) {
    ok(Math.abs(lhs[i] - rhs[i]) < 1e-6, 'component ' + i + ': ' + lhs + ' vs ' + rhs);
  }
}

function mixTowards(c, target, w) {
  return [c[0]*(1-w)+target*w, c[1]*(1-w)+target*w, c[2]*(1-w)+target*w, c[3]];
}

// the polymer chain a water/ligand chain is assigned to by author chain name
function partnerOf(structure, chainName) {
  var auth = structure.chainByName(chainName).residues()[0].prop('authAsymId');
  return structure.chains().find(function(c) {
    return c.backboneTraces().length > 0 &&
      (c.residues()[0].prop('authAsymId') || c.name()) === auth;
  });
}

test('byChain gives polymer chains palette colors, ligands follow their author chain', function() {
  var structure = loadTitin();
  var op = color.byChain();
  op.begin(structure);
  var palette = color.CHAIN_PALETTE.map(function(c) { return color.forceRGB(c); });
  ['A', 'B', 'C', 'D', 'E', 'F'].forEach(function(name, i) {
    closeColor(colorOfChain(op, structure, name), palette[i]);
  });
  var partner = partnerOf(structure, 'L');
  ok(!!partner);
  deepEqual(colorOfChain(op, structure, 'L'), colorOfChain(op, structure, partner.name()));
  op.end();
});

test('byChain cycles a custom palette', function() {
  var structure = loadTitin();
  var op = color.byChain(['red', 'blue']);
  op.begin(structure);
  closeColor(colorOfChain(op, structure, 'A'), color.forceRGB('red'));
  closeColor(colorOfChain(op, structure, 'B'), color.forceRGB('blue'));
  closeColor(colorOfChain(op, structure, 'C'), color.forceRGB('red'));
  op.end();
});

test('byChain with a gradient spreads it over the polymer chains', function() {
  var structure = loadTitin();
  var grad = color.gradient('rainbow');
  var op = color.byChain(grad);
  op.begin(structure);
  var gradientAt = function(t) {
    var out = [0, 0, 0, 0];
    grad.colorAt(out, t);
    return out;
  };
  deepEqual(colorOfChain(op, structure, 'A'), gradientAt(0));
  deepEqual(colorOfChain(op, structure, 'F'), gradientAt(1));
  op.end();
});

test('byEntity gives each entity a hue and its copies dark to light shades', function() {
  var structure = loadTitin();
  var op = color.byEntity();
  op.begin(structure);
  var p0 = color.forceRGB(color.CHAIN_PALETTE[0]);
  var p1 = color.forceRGB(color.CHAIN_PALETTE[1]);
  // entity 1, four copies: -0.3, -0.1, +0.1, +0.3
  closeColor(colorOfChain(op, structure, 'A'), mixTowards(p0, 0, 0.3));
  closeColor(colorOfChain(op, structure, 'B'), mixTowards(p0, 0, 0.1));
  closeColor(colorOfChain(op, structure, 'D'), mixTowards(p0, 1, 0.1));
  closeColor(colorOfChain(op, structure, 'E'), mixTowards(p0, 1, 0.3));
  // entity 2, two copies
  closeColor(colorOfChain(op, structure, 'C'), mixTowards(p1, 0, 0.3));
  closeColor(colorOfChain(op, structure, 'F'), mixTowards(p1, 1, 0.3));
  var partner = partnerOf(structure, 'L');
  deepEqual(colorOfChain(op, structure, 'L'), colorOfChain(op, structure, partner.name()));
  op.end();
});

test('byEntity falls back to one entity per chain without entity ids', function() {
  var structure = io.pdb(fs.readFileSync('tests/data/1r6a.pdb', 'utf8'));
  var byEntity = color.byEntity();
  var byChain = color.byChain();
  byEntity.begin(structure);
  byChain.begin(structure);
  structure.chains().forEach(function(c) {
    if (c.residues().length === 0) return;
    deepEqual(colorOfChain(byEntity, structure, c.name()),
              colorOfChain(byChain, structure, c.name()));
  });
  byEntity.end();
  byChain.end();
});
