var viewer;

// index.html (dev) doesn't build/load dist/pv.iife.js
// bundle, so fall back to importing the TypeScript source directly --
// this only works when served through the Vite dev server, which
// transpiles it on the fly.
var pv = window.pv;
if (!pv) {
  pv = (await import('./src/index')).default;
  window.pv = pv;
}
var io = pv.io;
var viewpoint = pv.viewpoint;
var color = pv.color;

var structure;

// draws biological assembly 1 (symmetry-related copies included) when the
// structure defines one, as every RCSB entry (local or fetched) does, and
// just the asymmetric unit otherwise, e.g. the AlphaFold model.
function related() {
  return structure.assembly('1') ? '1' : 'asym';
}

// opacity slider (in #display-widget): applies to every currently-visible
// render object that supports it, and is re-applied by showStructure() whenever a
// new structure is loaded, so dragging the slider then loading a different
// structure keeps the same transparency -- a quick way to see the
// weighted-blended OIT pipeline (viewer.ts's _draw()) composite overlapping
// translucent cartoon/sphere geometry correctly regardless of draw order.
var currentOpacity = 1.0;
function applyOpacity(val) {
  currentOpacity = val;
  viewer.forEach(function(go) {
    if (typeof go.setOpacity === 'function') {
      go.setOpacity(val);
    }
  });
  viewer.requestRedraw();
}

function points() {
  viewer.clear();
  addLigands();
  viewer.points('structure', structure, {
                         color: color.byResidueProp('num'),
                         showRelated : related() });
}

function lines() {
  viewer.clear();
  var go = viewer.lines('structure', structure, {
              color: color.byResidueProp('num'),
              showRelated : related() });
  go.setSelection(go.select({rnumRange : [15,20]}));
  go.setOpacity(0.5, go.select({rnumRange : [25,30]}));
  addLigands();
}

function cartoon() {
  viewer.clear();
  var go = viewer.cartoon('structure', structure, {
      color : color.ssSuccession(), showRelated : related(), baseSticks : false,
  });
  var rotation = viewpoint.principalAxes(go);
  addLigands(true);
  //go.setSelection(go.select({rtype : 'C' }));
  viewer.setRotation(rotation)
}

function lineTrace() {
  viewer.clear();
  addLigands(true);
  viewer.lineTrace('structure', structure, { showRelated : related() });
}

function spheres() {
  viewer.clear();
  addLigands();
  viewer.spheres('structure', structure, { showRelated : related() });
}

function sline() {
  viewer.clear();
  addLigands(true);
  viewer.sline('structure', structure,
      { color : color.uniform('red'), showRelated : related() });
}

function tube() {
  viewer.clear();
  addLigands(true);
  viewer.tube('structure', structure, { showRelated : related(), baseSticks : false });
}

function trace() {
  viewer.clear();
  addLigands(true);
  viewer.trace('structure', structure, { showRelated : related() });

}
function ballsAndSticks() {
  viewer.clear();
  addLigands();
  viewer.ballsAndSticks('structure', structure, { showRelated : related() });
}

// a surface over the protein only; DNA/RNA chains are drawn as a cartoon
// instead (backbone tube, plus the bases from addLigands), which keeps
// strands, grooves and bases readable where a surface would merge them
// into the protein's.
function surface() {
  viewer.clear();
  viewer.cartoon('structure.nucleic',
                 structure.residueSelect(function(r) { return r.isNucleotide(); }),
                 { showRelated : related(), baseSticks : false });
  addLigands(true);
  var protein = structure.select('protein');
  // a trace-only protein (one CA per residue, see getFromRcsb()) has CAs
  // 3.8 A apart: inflated by 2 A their spheres merge into a closed, coarse
  // surface, instead of a thin tube along each chain
  var traceOnly = protein.atomCount() === protein.residueCount();
  viewer.surface('structure', protein, {
    color: color.ssSuccession(), showRelated : related(),
    radiusOffset : traceOnly ? 2 : 0,
  }).then(function(go) {
    if (go) {
      // the surface arrives after showStructure() has already recolored,
      // so re-apply the remembered color scheme now that it exists.
      if (currentColor) {
        currentColor();
      }
      go.setOpacity(currentOpacity);
    }
  });
}

function preset() {
  viewer.clear();
  viewer.cartoon('structure.protein', structure, { showRelated : related(), baseSticks : false });
  addLigands(true);
}

// the last style and color scheme picked from the menus. Loading a new
// structure goes through showStructure(), which redraws it with both, so
// switching structures keeps the look. currentColor stays null until a
// color is picked, leaving each style's own default coloring in place.
var currentStyle = preset;
var currentColor = null;

function showStructure() {
  currentStyle();
  if (currentColor) {
    currentColor();
  }
  applyOpacity(currentOpacity);
}

function useStyle(style) {
  return function() {
    currentStyle = style;
    showStructure();
  };
}

function useColor(scheme) {
  return function() {
    currentColor = scheme;
    scheme();
  };
}

// the ligands: everything but amino acids, water and the nucleotides of
// DNA/RNA chains (which pv's 'ligand' selection includes), so a free
// nucleotide such as ATP or SAH counts but a chain's bases don't.
function ligands() {
  const nucleicChains = new Map();
  return structure.residueSelect(function(r) {
    if (r.isAminoacid() || r.isWater()) return false;
    if (!r.isNucleotide()) return true;
    const chain = r.chain();
    if (!nucleicChains.has(chain)) {
      nucleicChains.set(chain, chain.residues().filter((x) => x.isNucleotide()).length > 1);
    }
    return !nucleicChains.get(chain);
  });
}

// ligands (sugars included) as balls and sticks, plus the add-ons' overlays
// as toggled in the display widget: 3D-SNFG symbols on glycans (pv.snfg)
// and filled rings (pv.rings). With withBases (the cartoon-like styles,
// which then leave out their own grey base sticks), DNA and RNA bases also
// get filled, outlined rings on a stick from the backbone tube in the
// base's color (pv.rings.drawBases).
function addLigands(withBases) {
  viewer.ballsAndSticks('structure.ligand', ligands(), { showRelated : related() });
  if (withBases) {
    pv.rings.drawBases(viewer, 'structure.bases', structure,
                       { sticks : true, showRelated : related() });
  }
  addLigandOverlays();
}

function addLigandOverlays() {
  viewer.rm('structure.glycans');
  viewer.rm('structure.rings');
  // only on top of a structure shown by one of the styles above
  if (viewer.get('structure.ligand') === null) return;
  if (document.getElementById('snfg-toggle').checked &&
      structure.select('carbohydrate').residueCount() > 0) {
    pv.snfg.draw(viewer, 'structure.glycans', structure, { showRelated : related() });
  }
  if (document.getElementById('rings-toggle').checked) {
    pv.rings.draw(viewer, 'structure.rings', ligands(), { showRelated : related() });
  }
  applyOpacity(currentOpacity);
}

// loads a structure from its local mmCIF fixture (structures/<id>.cif).
function load(cif_id) {
  document.getElementById('traj-widget').style.display = 'none';
  io.fetchCif('structures/'+cif_id+'.cif').then(function(s) {
    structure = s;
    showStructure();
    viewer.autoZoom();
  }, function(error) {
    showWarning('Could not load structure "' + cif_id + '": ' + error.message);
  });
}

function trajectory() {
  viewer.clear();
  document.getElementById('traj-widget').style.display = 'block';
  var theTimeOut;
  var intervalFunc;
  var button = document.getElementById('traj-button');
  button.onclick = function(event) {
    event.preventDefault();
    if (button.textContent === 'Start') {
      button.textContent = 'Stop';
      theTimeOut = setInterval(intervalFunc, 1000.0/15.0);
    } else {
      clearInterval(theTimeOut);
      button.textContent = 'Start';
    }
  };
  pv.io.fetchCrd('structures/trj.crd', function(s) {
    structure = s;
    viewer.ballsAndSticks('trajectory', structure);
    viewer.autoZoom();
    pv.traj.fetchDcd('structures/trj.dcd', s, function(cg) {
      var frameId = 0;
      intervalFunc = function() {
        cg.useFrame(frameId);
        frameId += 1;
        frameId = frameId % 32;
        viewer.clear();
        viewer.ballsAndSticks('trajectory', structure);
      };
    });
  });
}

function kinase() {
  load('1ake');
}

// titin Z1Z2 domains bound by telethonin: six protein chains whose author
// chain names differ from the label ones, so the hover labels show
// "[auth ...]". Its assembly 1 is one telethonin with its two titin chains.
function telethonin() { load('2f8v'); }

// a bacterial porin: one chain in the file, the trimer built from its
// symmetry operators (biological assembly 1, shown by related()).
function porin() {
  load('2por');
}

// MELK kinase bound to a small-molecule inhibitor (ligand 47W) whose
// bond orders come straight from the mmCIF chem_comp_bond table: an
// alkyne (triple bond), plus the aromatic isoquinoline and benzyl rings.
function melkInhibitor() {
  load('4umt');
}

// sialylated human IgG1 Fc: two complex N-glycans, one on Asn297 of each
// heavy chain, packed between the CH2 domains. Each is a branched tree of
// GlcNAc, Man, Gal, core Fuc and a terminal sialic acid (Neu5Ac), stored
// as one label chain per glycan (C, D) and linked to the protein and to
// each other through _struct_conn.
function iggFcGlycans() {
  load('4byh');
}

// Shiga-like toxin I B subunit bound to an analogue of its receptor, the
// glycolipid Gb3: four B5 pentamers in the asymmetric unit, 20 copies of one
// entity, each binding Gb3 trisaccharides (Gal-alpha1,4-Gal-beta1,4-Glc) as
// branched oligosaccharide chains. Shows the SNFG glycan symbols on many
// copies at once, and byEntity coloring of a homo-oligomer.
function shigaToxinGb3() {
  load('1bos');
}

// two nucleosomes with the linker histone H1x, at 2.7 A: each core is an
// H3/H4/H2A/H2B octamer wrapped by a 169 bp DNA duplex, with H1x bound
// where the DNA enters and leaves the core. Protein and DNA in one view,
// and a good case for byEntity coloring (7 polymer entities, 22 chains).
function nucleosomeH1x() {
  load('8yti');
}

// AlphaFold DB model AF-A0A4Y8AT86-F1 (UniProt A0A4Y8AT86, a "4-fold beta
// flower domain-containing protein" from Gramella jeungdoensis): four
// beta-hairpins radiating out of a small helical hub, forming a flower-like
// rosette in cartoon view. AlphaFold's own mmCIF already carries DSSP-derived
// secondary structure in _struct_conf (including the beta strands, tagged
// conf_type_id 'STRN'), but pv only reads strands from the separate
// _struct_sheet_range category the way RCSB depositions lay it out -- so the
// local fixture (structures/a0a4y8at86.cif) adds a _struct_sheet_range loop built
// from those same STRN rows. Without it every strand falls back to a plain
// coil tube and the "flower" is invisible.
function betaFlower() {
  document.getElementById('traj-widget').style.display = 'none';
  io.fetchCif('structures/a0a4y8at86.cif', function(s) {
    structure = s;
    showStructure();
    var go = viewer.get('structure') || viewer.get('structure.protein');
    // orient along the principal axes so the propeller's flattest axis
    // faces the camera, showing the radiating hairpins face-on instead of
    // edge-on -- AlphaFold models have no canonical orientation to fall
    // back on the way a crystal structure's deposited frame might.
    if (go) {
      viewer.setRotation(viewpoint.principalAxes(go));
    }
    viewer.autoZoom();
  });
}

function ssSuccession() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand' && typeof go.colorBy === 'function')
      go.colorBy(color.ssSuccession());
  });
  viewer.requestRedraw();
}

function uniform() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand' && typeof go.colorBy === 'function')
      go.colorBy(color.uniform([0,1,0]));
  });
  viewer.requestRedraw();
}
function byElement() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand' && typeof go.colorBy === 'function')
      go.colorBy(color.byElement());
  });
  viewer.requestRedraw();
}

function ss() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand' && typeof go.colorBy === 'function')
      go.colorBy(color.bySS());
  });
  viewer.requestRedraw();
}

function proInRed() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand' && typeof go.colorBy === 'function')
      go.colorBy(color.uniform('red'), go.select({rname : 'PRO'}));
  });
  viewer.requestRedraw();
}
function rainbow() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand' && typeof go.colorBy === 'function')
      go.colorBy(color.rainbow());
  });
  viewer.requestRedraw();
}

function byChain() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand' && typeof go.colorBy === 'function')
      go.colorBy(color.byChain());
  });
  viewer.requestRedraw();
}

function byEntity() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand' && typeof go.colorBy === 'function')
      go.colorBy(color.byEntity());
  });
  viewer.requestRedraw();
}

function polymerase() {
  load('4UBB');
};

// yeast tRNA-Phe at 1.93 A: an RNA chain with 14 kinds of modified
// nucleotides (pseudouridine PSU, dihydrouridine H2U, wybutosine YYG,
// 2'-O-methylated OMC/OMG, ...), which are drawn as part of the RNA chain,
// plus Mg2+ ions.
function trna() {
  load('1ehz');
}

// Pariacoto virus: 60 copies of the capsid's asymmetric unit, built from the
// icosahedral operators of biological assembly 1 -- about 520,000 atoms,
// the largest example here. Inside, a dodecahedral cage of 30 RNA double
// helices: each 25-nt strand of the file pairs with its copy across an
// icosahedral 2-fold axis. The RNA's sequence is a placeholder (mostly U),
// since the map is an average over many stretches of the genome.
function pariacoto() {
  load('1f8v');
}


// a gravel cyclist, side view (x forward, y up, z across), built from the
// three shapes the customMesh API draws -- addTube, addSphere and
// addTriangles (for any other solid: boxes, cones, hexagonal and toothed
// prisms) -- none of it derived from a molecular structure. This is the
// escape hatch for drawing arbitrary annotated geometry (markers,
// measurement lines, ...) alongside whatever else is in the scene. Every
// part carries a userData label, so hovering it names and highlights it.
function customMeshDemo() {
  viewer.clear();
  var go = viewer.customMesh('custom');
  var vec3 = pv.vec3;

  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function at(x, y, z) { return [x, y, z || 0]; }
  function onCircle(center, radius, angle, z) {
    return [center[0] + radius * Math.cos(angle),
            center[1] + radius * Math.sin(angle), center[2] + (z || 0)];
  }

  // a flat polygon (points in the xy plane around center, counter-
  // clockwise) extruded along z to thickness: a prism made of triangles
  function prism(center, points, thickness, color, label) {
    var h = thickness / 2, tris = [];
    function p(i, z) {
      var q = points[(i + points.length) % points.length];
      return [center[0] + q[0], center[1] + q[1], center[2] + z];
    }
    for (var i = 0; i < points.length; ++i) {
      tris.push(at(center[0], center[1], center[2] + h), p(i, h), p(i + 1, h));
      tris.push(at(center[0], center[1], center[2] - h), p(i + 1, -h), p(i, -h));
      tris.push(p(i, -h), p(i + 1, -h), p(i + 1, h));
      tris.push(p(i, -h), p(i + 1, h), p(i, h));
    }
    go.addTriangles([].concat.apply([], tris), { color : color, userData : label });
  }
  function regular(n, radius, start) {
    var pts = [];
    for (var i = 0; i < n; ++i) {
      var a = (start || 0) + i * 2 * Math.PI / n;
      pts.push([radius * Math.cos(a), radius * Math.sin(a)]);
    }
    return pts;
  }
  // a gear: teeth alternating between two radii
  function toothed(teeth, outer, inner) {
    var pts = [];
    for (var i = 0; i < teeth * 2; ++i) {
      var r = i % 2 === 0 ? outer : inner;
      pts.push([r * Math.cos(i * Math.PI / teeth), r * Math.sin(i * Math.PI / teeth)]);
    }
    return pts;
  }
  // an axis-aligned box
  function box(center, size, color, label) {
    prism(center, [[-size[0] / 2, -size[1] / 2], [size[0] / 2, -size[1] / 2],
                   [size[0] / 2, size[1] / 2], [-size[0] / 2, size[1] / 2]],
          size[2], color, label);
  }
  // a cone from the center of its base to its tip
  function cone(base, tip, radius, color, label) {
    var axis = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), tip, base));
    var u = vec3.normalize(vec3.create(),
      vec3.cross(vec3.create(), axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    var v = vec3.cross(vec3.create(), axis, u);
    var n = 20, tris = [];
    for (var i = 0; i < n; ++i) {
      var a0 = i * 2 * Math.PI / n, a1 = (i + 1) * 2 * Math.PI / n;
      var p0 = add(base, add(scale(u, radius * Math.cos(a0)), scale(v, radius * Math.sin(a0))));
      var p1 = add(base, add(scale(u, radius * Math.cos(a1)), scale(v, radius * Math.sin(a1))));
      tris.push(Array.from(tip), p0, p1, Array.from(base), p1, p0);
    }
    go.addTriangles([].concat.apply([], tris), { color : color, userData : label });
  }
  // a circle of tube segments around center, in the xy plane
  function ring(center, radius, tubeRadius, color, label) {
    var n = 48;
    for (var i = 0; i < n; ++i) {
      go.addTube(onCircle(center, radius, i * 2 * Math.PI / n),
                 onCircle(center, radius, (i + 1) * 2 * Math.PI / n),
                 tubeRadius, { color : color, userData : label });
      go.addSphere(onCircle(center, radius, i * 2 * Math.PI / n), tubeRadius,
                   { color : color, userData : label });
    }
  }
  // a limb: tube with round joints
  function limb(from, to, radius, color, label) {
    go.addTube(from, to, radius, { color : color, userData : label });
    go.addSphere(to, radius, { color : color, userData : label });
  }
  // the knee (or elbow) of a two-segment limb from hip to ankle, bending
  // towards forward
  function joint(hip, ankle, upper, lower, forward) {
    var d = vec3.distance(hip, ankle);
    var reach = Math.min(d, upper + lower - 0.01);
    var along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
    var out = Math.sqrt(Math.max(0, upper * upper - along * along));
    var dir = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), ankle, hip));
    var side = vec3.normalize(vec3.create(), [-dir[1], dir[0], 0]);
    if (vec3.dot(side, forward) < 0) vec3.scale(side, side, -1);
    return add(add(hip, scale(dir, along)), scale(side, out));
  }

  var frameColor = [0.42, 0.52, 0.38], tyre = [0.13, 0.12, 0.11];
  var gumwall = [0.66, 0.5, 0.32], rimColor = [0.16, 0.16, 0.17];
  var metal = [0.78, 0.8, 0.84], jersey = [0.85, 0.42, 0.12];
  var shorts = [0.1, 0.1, 0.12], skin = [0.93, 0.74, 0.6];

  // a dirt road, strewn with pebbles (a fixed pseudo-random scatter, so
  // the scene is the same every time)
  box(at(1, -0.6, 0), [80, 1.2, 16], [0.58, 0.48, 0.35], 'gravel road');
  var seed = 7;
  function random() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  for (var n = 0; n < 140; ++n) {
    var grey = 0.45 + 0.3 * random();
    go.addSphere(at(-38 + 78 * random(), 0, -7.5 + 15 * random()), 0.15 + 0.35 * random(),
                 { color : [grey, grey * 0.95, grey * 0.88], userData : 'pebble' });
  }

  // grass verges either side of the road, and pine trees along the way:
  // a trunk with four stacked cones narrowing towards the top
  box(at(1, -0.65, -17), [80, 1.2, 18], [0.36, 0.52, 0.26], 'grass');
  box(at(1, -0.65, 13), [80, 1.2, 10], [0.36, 0.52, 0.26], 'grass');
  function pine(x, z, height, shade) {
    var foot = at(x, 0, z);
    go.addTube(foot, add(foot, [0, height * 0.3, 0]), height * 0.035,
               { color : [0.4, 0.27, 0.16], userData : 'pine tree' });
    for (var t = 0; t < 4; ++t) {
      var base = height * (0.2 + t * 0.17), top = base + height * (0.38 - t * 0.04);
      cone(add(foot, [0, base, 0]), add(foot, [0, top, 0]), height * (0.24 - t * 0.045),
           [0.1 * shade, 0.36 * shade, 0.18 * shade], 'pine tree');
    }
  }
  pine(-28, -14, 30, 1.0);
  pine(-17, -20, 24, 0.85);
  pine(19, -16, 34, 0.95);
  pine(31, -22, 26, 0.8);
  pine(-36, 11, 16, 1.1);

  // wheels: fat knobbly tyres with tan sidewalls on black rims, 24 spokes
  // laced to either side of the hub, a hexagonal nut on the axle, and a
  // disc brake rotor on the left
  var wheelRadius = 7.0, tyreRadius = 0.7;
  var rear = at(-10.5, wheelRadius + tyreRadius), front = at(14.6, wheelRadius + tyreRadius);
  [[rear, 'rear wheel'], [front, 'front wheel']].forEach(function(w) {
    var c = w[0], label = w[1];
    ring(c, wheelRadius, tyreRadius, tyre, label + ' tyre');
    ring(c, wheelRadius - 0.5, 0.38, gumwall, label + ' tyre');
    for (var i = 0; i < 56; ++i) {
      var a = i * 2 * Math.PI / 56;
      go.addSphere(onCircle(c, wheelRadius + tyreRadius - 0.05, a, i % 2 ? 0.32 : -0.32), 0.16,
                   { color : tyre, userData : label + ' tyre' });
    }
    ring(c, wheelRadius - 1.0, 0.3, rimColor, label + ' rim');
    for (var i2 = 0; i2 < 24; ++i2) {
      go.addTube(at(c[0], c[1], i2 % 2 ? 1.1 : -1.1),
                 onCircle(c, wheelRadius - 1.05, i2 * 2 * Math.PI / 24), 0.07,
                 { color : metal, userData : label + ' spokes' });
    }
    prism(c, regular(6, 0.9), 2.8, [0.3, 0.3, 0.32], label + ' hub');
    prism(add(c, [0, 0, -1.9]), regular(28, 2.4), 0.12, metal, label + ' disc brake');
  });

  // the frame: a sloping top tube and tall head tube, the stays and a wide
  // fork in pairs either side of the fat tyres, with the brake calipers
  var bb = at(0, 6.7), seat = at(-2.9, 17.4);
  var headTop = at(8.75, 18.9), headBottom = at(9.7, 15.0);
  var frame = function(a, b, r) { go.addTube(a, b, r || 0.6, { color : frameColor, userData : 'frame' }); };
  frame(bb, seat, 0.65);
  frame(seat, headTop);
  frame(bb, headBottom, 0.75);
  frame(headBottom, headTop, 0.75);
  [-1.6, 1.6].forEach(function(z) {
    frame(add(bb, [0, 0, z * 0.5]), add(rear, [0, 0, z]), 0.42);
    frame(add(seat, [0, -1, z * 0.4]), add(rear, [0, 0, z]), 0.36);
    go.addTube(add(headBottom, [0, 0, z * 0.5]), add(front, [0, 0, z]), 0.45,
               { color : frameColor, userData : 'fork' });
  });
  go.addSphere(bb, 1.0, { color : metal, userData : 'bottom bracket' });
  box(add(rear, [-1.2, 1.8, -1.9]), [1.6, 1.0, 0.6], [0.2, 0.2, 0.22], 'brake caliper');
  box(add(front, [-1.0, 2.0, -1.9]), [1.6, 1.0, 0.6], [0.2, 0.2, 0.22], 'brake caliper');

  // seatpost and saddle (a flat wedge, wide at the back)
  var saddleAt = at(-4.6, 23.0);
  go.addTube(seat, saddleAt, 0.35, { color : metal, userData : 'seatpost' });
  prism(add(saddleAt, [0.4, 0.4, 0]),
        [[-2.6, -0.3], [3.2, -0.15], [3.4, 0.2], [-2.8, 0.4]], 2.2,
        [0.1, 0.1, 0.1], 'saddle');

  // stem and flared drop handlebars: the drops splay outwards as they
  // come down
  // a small frame: the bars stay where the rider's hands are, on a stack
  // of spacers above the head tube
  var stemEnd = at(11.8, 22.4), barColor = [0.15, 0.15, 0.15];
  var steererTop = at(8.4, 20.4);
  go.addTube(headTop, steererTop, 0.55, { color : [0.15, 0.15, 0.15], userData : 'spacers' });
  go.addTube(steererTop, stemEnd, 0.4, { color : metal, userData : 'stem' });
  go.addTube(add(stemEnd, [0, 0, -2.1]), add(stemEnd, [0, 0, 2.1]), 0.35,
             { color : barColor, userData : 'handlebar' });
  [-1, 1].forEach(function(side) {
    var p0 = add(stemEnd, [0, 0, side * 2.1]), p1 = add(stemEnd, [1.5, -1.0, side * 2.25]);
    var p2 = add(stemEnd, [1.0, -2.8, side * 2.6]), p3 = add(stemEnd, [-0.6, -3.0, side * 2.75]);
    [[p0, p1], [p1, p2], [p2, p3]].forEach(function(s) {
      limb(s[0], s[1], 0.35, barColor, 'handlebar');
    });
  });

  // drivetrain: one toothed chainring and a wide-range rear cassette, the
  // chain between them, and the cranks with their pedals at opposite angles
  var chainZ = 1.9;
  prism(add(bb, [0, 0, chainZ]), toothed(40, 3.9, 3.6), 0.3, [0.25, 0.25, 0.27], 'chainring');
  prism(add(rear, [0, 0, chainZ]), toothed(36, 2.5, 2.25), 0.3, [0.25, 0.25, 0.27], 'cassette');
  var chain = { color : [0.4, 0.4, 0.42], userData : 'chain' };
  go.addTube(add(bb, [0, 3.75, chainZ]), add(rear, [0, 2.4, chainZ]), 0.15, chain);
  go.addTube(add(bb, [0, -3.75, chainZ]), add(rear, [0, -2.4, chainZ]), 0.15, chain);
  var crankAngle = -0.2;
  var pedals = [];
  [[2.6, crankAngle, 'right'], [-2.6, crankAngle + Math.PI, 'left']].forEach(function(c) {
    var pedal = onCircle(bb, 3.6, c[1], c[0]);
    go.addTube(add(bb, [0, 0, c[0] * 0.8]), pedal, 0.4, { color : metal, userData : c[2] + ' crank' });
    box(add(pedal, [0, 0, c[0] * 0.25]), [2.2, 0.5, 1.4], [0.2, 0.2, 0.2], c[2] + ' pedal');
    pedals.push({ at : pedal, z : c[0], side : c[2] });
  });

  // a water bottle in its cage on top of the down tube: a tube with a cone
  // top
  var bottleBottom = at(1.1, 9.4, 0), bottleTop = at(4.3, 12.1, 0);
  go.addTube(bottleBottom, bottleTop, 1.0, { color : [0.2, 0.6, 0.85], userData : 'bottle' });
  cone(bottleTop, add(bottleTop, [0.76, 0.65, 0]), 0.95, [0.95, 0.95, 0.95], 'bottle');

  // the rider, on the hoods: torso, head with a helmet (a sphere and a
  // short cone at the back), arms to the brake hoods, legs to the pedals
  // with the knees and elbows solved for, and shoes
  var hip = at(-4.3, 25.0), shoulder = at(6.6, 30.6), head = at(10.3, 33.0);
  limb(hip, shoulder, 2.4, jersey, 'rider');
  go.addSphere(hip, 2.5, { color : shorts, userData : 'rider' });
  go.addSphere(shoulder, 2.2, { color : jersey, userData : 'rider' });
  go.addTube(shoulder, head, 0.9, { color : skin, userData : 'rider' });
  go.addSphere(head, 2.0, { color : skin, userData : 'rider' });
  go.addSphere(add(head, [-0.3, 0.6, 0]), 2.25, { color : [0.95, 0.95, 0.95], userData : 'helmet' });
  cone(add(head, [-1.2, 0.7, 0]), add(head, [-3.4, 0.2, 0]), 1.8, [0.95, 0.95, 0.95], 'helmet');
  // sunglasses: a dark bar across the front of the face (sitting on the
  // head's surface, so the head doesn't show through), and a faint smile
  // below them -- a thin, dark curve on the head's surface, just turned up
  // at the corners
  function onHead(r, y, z) {
    return add(head, [Math.sqrt(Math.max(0, r * r - y * y - z * z)), y, z]);
  }
  box(add(head, [1.9, 0.0, 0]), [0.5, 0.8, 3.4], [0.1, 0.1, 0.1], 'sunglasses');
  var smile = { color : [0.42, 0.18, 0.15], userData : 'smile' };
  for (var k2 = 0; k2 < 8; ++k2) {
    var z0 = -0.55 + k2 * 0.1375, z1 = z0 + 0.1375;
    var curve = function(z) { return -1.15 + 0.22 * (z / 0.55) * (z / 0.55); };
    go.addTube(onHead(2.03, curve(z0), z0), onHead(2.03, curve(z1), z1), 0.07, smile);
  }
  [-2.2, 2.2].forEach(function(z) {
    var s = add(shoulder, [0, -0.5, z]), hand = add(stemEnd, [1.3, -0.9, z * 1.05]);
    var elbow = joint(s, hand, 6.2, 5.8, [0, -1, 0]);
    limb(s, elbow, 0.85, skin, 'rider');
    limb(elbow, hand, 0.75, skin, 'rider');
    go.addSphere(hand, 0.85, { color : [0.1, 0.1, 0.12], userData : 'gloves' });
  });
  pedals.forEach(function(p) {
    var h = add(hip, [0, 0, p.z * 0.75]), ankle = add(p.at, [-0.3, 1.2, p.z * 0.9]);
    var knee = joint(h, ankle, 10.6, 10.0, [1, 0, 0]);
    limb(h, knee, 1.45, shorts, 'rider');
    limb(knee, ankle, 1.05, skin, 'rider');
    box(add(ankle, [0.6, -0.7, 0]), [3.4, 1.0, 1.3], [0.95, 0.95, 0.95], p.side + ' shoe');
  });

  // custom meshes report no extent to autoZoom(), so frame it by hand:
  // side on, the whole bike and rider in view
  viewer.setRotation(pv.mat4.create(), 0);
  viewer.setCenter([2, 16, 0], 0);
  viewer.setZoom(66, 0);
}

function ensemble() {
  document.getElementById('traj-widget').style.display = 'none';
  io.fetchCif('structures/1nmr.cif', function(structures) {
    viewer.clear()
    structure = structures[0];
    for (var i = 0; i < structures.length; ++i) {
      viewer.cartoon('ensemble_'+ i, structures[i]);
    }
    viewer.autoZoom();
  }, { loadAllModels : true } );
}
// menu behaviour, as Foundation's top-bar plugin used to provide it on top
// of the Foundation styles in index.html. On wide screens the dropdowns open
// on hover, which those styles key off the not-click class. On narrow
// screens the menu icon expands the bar, and a menu title slides in its
// entries with a Back link.
function initTopBar() {
  var bar = document.querySelector('.top-bar');
  var section = bar.querySelector('.top-bar-section');
  var narrow = window.matchMedia('(max-width: 40em)');
  var closeSubmenu = function() {
    bar.querySelectorAll('.has-dropdown.moved').forEach(function(item) {
      item.classList.remove('moved');
    });
    section.style.left = '';
    bar.style.height = '';
  };
  var collapse = function() {
    closeSubmenu();
    bar.classList.remove('expanded');
  };
  bar.querySelector('.toggle-topbar').addEventListener('click', function(event) {
    event.preventDefault();
    if (bar.classList.contains('expanded')) {
      collapse();
    } else {
      bar.classList.add('expanded');
    }
  });
  bar.querySelectorAll('.has-dropdown').forEach(function(item) {
    item.classList.add('not-click');
    var title = item.firstElementChild;
    var dropdown = item.querySelector('.dropdown');
    // same markup Foundation generates; the styles only show the
    // js-generated entries on narrow screens
    dropdown.insertAdjacentHTML('afterbegin',
      '<li class="title back js-generated"><h5><a href="#">Back</a></h5></li>' +
      '<li class="parent-link show-for-small"><a class="parent-link js-generated" href="#">' +
      title.textContent + '</a></li>');
    dropdown.querySelector('.back a').addEventListener('click', function(event) {
      event.preventDefault();
      closeSubmenu();
    });
    dropdown.querySelector('a.parent-link').addEventListener('click', function(event) {
      event.preventDefault();
    });
    title.addEventListener('click', function(event) {
      event.preventDefault();
      if (!narrow.matches) {
        return;
      }
      item.classList.add('moved');
      section.style.left = '-100%';
      bar.style.height = (bar.querySelector('.title-area').offsetHeight +
                          dropdown.offsetHeight) + 'px';
    });
  });
  // picking an entry closes the menu on narrow screens
  bar.querySelectorAll('.dropdown li:not(.title):not(.parent-link) > a').forEach(function(link) {
    link.addEventListener('click', collapse);
  });
  narrow.addEventListener('change', collapse);
}

function onClick(id, handler) {
  document.getElementById(id).addEventListener('click', function(event) {
    event.preventDefault();
    handler();
  });
}

initTopBar();
onClick('1ake', kinase);
onClick('4ubb', polymerase);
onClick('4umt', melkInhibitor);
onClick('4byh', iggFcGlycans);
onClick('1bos', shigaToxinGb3);
onClick('8yti', nucleosomeH1x);
onClick('beta-flower', betaFlower);
onClick('1ehz', trna);
onClick('1f8v', pariacoto);
onClick('2f8v', telethonin);
onClick('2por', porin);
onClick('ensemble', ensemble);
onClick('custom-mesh', customMeshDemo);
onClick('style-cartoon', useStyle(cartoon));
onClick('style-tube', useStyle(tube));
onClick('style-line-trace', useStyle(lineTrace));
onClick('style-sline', useStyle(sline));
onClick('style-trace', useStyle(trace));
onClick('style-lines', useStyle(lines));
onClick('style-balls-and-sticks', useStyle(ballsAndSticks));
onClick('style-surface', useStyle(surface));
onClick('style-points', useStyle(points));
onClick('style-spheres', useStyle(spheres));
onClick('color-uniform', useColor(uniform));
onClick('color-element', useColor(byElement));
onClick('color-chain', useColor(byChain));
onClick('color-entity', useColor(byEntity));
onClick('color-ss-succ', useColor(ssSuccession));
onClick('color-ss', useColor(ss));
onClick('trajectory', trajectory);
onClick('color-rainbow', useColor(rainbow));
onClick('color-pro-red', useColor(proInRed));
// fetches and renders a structure by PDB id from RCSB in mmCIF format, used
// by both pressing Enter/blurring the input (the 'change' event) and
// clicking the "Get" button next to it.
function getFromRcsb(pdbId) {
  if (!pdbId) {
    return;
  }
  var url = 'https://files.rcsb.org/download/' + pdbId + '.cif';
  // on any failure the current structure stays on screen.
  var fail = function() {
    showWarning('Could not load PDB entry "' + pdbId + '"');
  };
  // RCSB's entry metadata says how big the structure is before downloading
  // it; above HUGE_ATOM_COUNT only the polymers' central atoms (CA, C3') are
  // kept. When the metadata request fails, load in full.
  window.fetch('https://data.rcsb.org/rest/v1/core/entry/' + pdbId)
    .then(function(response) { return response.ok ? response.json() : null; })
    .catch(function() { return null; })
    .then(function(entry) {
      var atomCount = entry && entry.rcsb_entry_info ?
                      entry.rcsb_entry_info.deposited_atom_count : 0;
      var traceOnly = atomCount > HUGE_ATOM_COUNT;
      if (traceOnly) {
        showWarning(pdbId.toUpperCase() + ' has ' + atomCount.toLocaleString() +
                    ' atoms: loading CA/C3\' atoms only');
      }
      return io.fetchCif(url, undefined, { traceOnly : traceOnly });
    })
    .then(function(s) {
      structure = s;
      showStructure();
      viewer.autoZoom();
    }, fail);
}

// above this many atoms a structure is loaded trace-only (see getFromRcsb()):
// about where a full-atom model would take more than a gigabyte of memory
var HUGE_ATOM_COUNT = 500000;

var warningTimer = null;
function showWarning(text) {
  var el = document.getElementById('pv_warning');
  el.textContent = text;
  clearTimeout(warningTimer);
  warningTimer = setTimeout(function() { el.textContent = ''; }, 4000);
}

document.getElementById('load-from-pdb').addEventListener('change', function() {
  var pdbId = this.value;
  this.blur();
  getFromRcsb(pdbId);
});

document.getElementById('get-pdb-button').addEventListener('click', function(event) {
  event.preventDefault();
  var input = document.getElementById('load-from-pdb');
  var pdbId = input.value;
  input.value = '';
  input.blur();
  getFromRcsb(pdbId);
});

document.getElementById('opacity-slider').addEventListener('input', function() {
  var val = parseFloat(this.value);
  document.getElementById('opacity-value').textContent = val.toFixed(2);
  applyOpacity(val);
});

viewer = pv.Viewer(document.getElementById('viewer'), {
    width : 'auto', height: 'auto', 
    antialias : true, 
    fog : true,
    outline : true, 
    selectionColor : 'white',
    hoverColor: 'yellow',
    background : '#ccc', 
    animateTime: 500,
    doubleClick : null
});
window.viewer = viewer;

// fog and outline toggles, and a background slider running from white to
// black. All start from the viewer's current options.
function initDisplayControls() {
  var fog = document.getElementById('fog-toggle');
  var outline = document.getElementById('outline-toggle');
  var background = document.getElementById('background-slider');
  var spin = document.getElementById('spin-toggle');
  var rock = document.getElementById('rock-toggle');
  document.getElementById('snfg-toggle').addEventListener('change', addLigandOverlays);
  document.getElementById('rings-toggle').addEventListener('change', addLigandOverlays);
  var ssao = document.getElementById('ssao-toggle');
  var ssaoRadius = document.getElementById('ssao-radius-slider');
  var ssaoRadiusValue = document.getElementById('ssao-radius-value');
  var ssaoIntensity = document.getElementById('ssao-intensity-slider');
  var ssaoIntensityValue = document.getElementById('ssao-intensity-value');
  fog.checked = viewer.options('fog');
  outline.checked = viewer.options('outline');
  spin.checked = viewer.spin();
  rock.checked = viewer.rockAndRoll();
  background.value = 1 - viewer.options('background')[0];
  ssao.checked = viewer.options('ssao');
  ssaoRadius.value = viewer.options('ssaoRadius');
  ssaoRadiusValue.textContent = parseFloat(ssaoRadius.value).toFixed(1);
  ssaoIntensity.value = viewer.options('ssaoIntensity');
  ssaoIntensityValue.textContent = parseFloat(ssaoIntensity.value).toFixed(1);
  ssaoRadius.disabled = !ssao.checked;
  ssaoIntensity.disabled = !ssao.checked;
  fog.addEventListener('change', function() {
    viewer.options('fog', fog.checked);
  });
  outline.addEventListener('change', function() {
    viewer.options('outline', outline.checked);
  });
  spin.addEventListener('change', function() {
    viewer.spin(spin.checked);
  });
  rock.addEventListener('change', function() {
    viewer.rockAndRoll(rock.checked);
  });
  background.addEventListener('input', function() {
    var grey = 1 - parseFloat(background.value);
    viewer.options('background', [grey, grey, grey, 1]);
  });
  ssao.addEventListener('change', function() {
    viewer.options('ssao', ssao.checked);
    ssaoRadius.disabled = !ssao.checked;
    ssaoIntensity.disabled = !ssao.checked;
  });
  ssaoRadius.addEventListener('input', function() {
    var val = parseFloat(ssaoRadius.value);
    ssaoRadiusValue.textContent = val.toFixed(1);
    viewer.options('ssaoRadius', val);
  });
  ssaoIntensity.addEventListener('input', function() {
    var val = parseFloat(ssaoIntensity.value);
    ssaoIntensityValue.textContent = val.toFixed(1);
    viewer.options('ssaoIntensity', val);
  });
}
initDisplayControls();

viewer.addListener('viewerReady', melkInhibitor );

// A single click only selects; double-click moves the camera, onto the
// residue and its surroundings, or out to the whole structure.
viewer.on('doubleClick', function(picked) {
  picked = resolvePick(picked);
  if (picked === null) {
    viewer.fitTo(structure);
    return;
  }
  const target = picked.target();
  if (target === null || typeof target.residue !== 'function') {
    viewer.setCenter(picked.pos(), 500);   // not an atom, e.g. a custom mesh
    return;
  }
  const full = picked.node().structure().full();
  const around = full.selectWithin(target.residue(), { radius: 8 });
  // in a symmetry assembly the atoms are those of the asymmetric unit:
  // move them to the copy that was clicked
  const transform = picked.transform();
  if (transform === null) {
    viewer.fitTo(around);
    return;
  }
  const pos = pv.vec3.create();
  viewer.fitTo({
    eachAtom: (callback) => around.eachAtom((atom) =>
      callback({ pos: () => pv.vec3.transformMat4(pos, atom.pos(), transform) })),
  });
});

window.addEventListener('resize', function() {
      viewer.fitParent();
});


///////////////////////////////////////////





// Residue annotations come from the host app; the demo has none.
function resAnnoLabel() { return ''; }

// Hover and selection are pv tints (the viewer's hoverColor and
// selectionColor) that leave the atoms' colours alone, so they work in every
// representation and colour scheme.
const selected = new Map();   // geom -> Set of selected residues
let hovered = null;           // { node, residue, symIndex } under the mouse
let anchor = null;            // { node, residue } shift-click ranges start from
let lastClickTime = -Infinity;

function residueView(node, residues) {
  const view = node.structure().createEmptyView();
  view.addResidues([...residues], true);
  return view;
}

function updateSelection(node) {
  node.setSelection(residueView(node, selected.get(node) || []));
}

// The add-ons' custom meshes (DNA/RNA bases, SNFG symbols, filled rings)
// tag each shape with one of its residue's atoms; they're tinted along
// with that residue through customMesh.setHover()/setSelection().
function overlays() {
  return ['structure.bases', 'structure.glycans', 'structure.rings']
    .map((name) => viewer.get(name)).filter((mesh) => mesh !== null);
}

function residueOf(userData) {
  return userData && typeof userData.residue === 'function'
    ? userData.residue().full() : null;
}

function updateOverlaySelection() {
  const all = new Set();
  selected.forEach((residues) => residues.forEach((r) => all.add(r)));
  overlays().forEach((mesh) =>
    mesh.setSelection(all.size > 0 ? (ud) => all.has(residueOf(ud)) : null));
}

// symIndex: the symmetry copy under the mouse (picked.symIndex(), null
// outside of assemblies); only that copy is tinted, while the selection
// shows in all of them.
function setHovered(node, residue, symIndex) {
  if (hovered !== null) hovered.node.setHover(null);
  hovered = node !== null ? { node, residue, symIndex } : null;
  if (node !== null) node.setHover(residueView(node, [residue]), symIndex);
  overlays().forEach((mesh) =>
    mesh.setHover(node !== null ? (ud) => residueOf(ud) === residue : null, symIndex));
}

// With add (ctrl/cmd) the residues are added to the selection, and a single
// residue that is already selected is removed again; otherwise they replace
// the selection.
function selectResidues(node, residues, add) {
  const nodes = new Set(add ? [node] : [...selected.keys(), node]);
  if (!add) selected.clear();
  const current = selected.get(node) || new Set();
  if (add && residues.length === 1 && current.has(residues[0])) {
    current.delete(residues[0]);
  } else {
    residues.forEach((r) => current.add(r));
  }
  selected.set(node, current);
  nodes.forEach(updateSelection);
  updateOverlaySelection();
}

// The amino acids or nucleotides from one residue to another in chain
// order, so insertion codes and gaps in the numbering don't matter.
function residueRange(from, to) {
  const residues = from.chain().residues();
  const a = residues.indexOf(from), b = residues.indexOf(to);
  return residues.slice(Math.min(a, b), Math.max(a, b) + 1)
                 .filter((r) => r.isAminoacid() || r.isNucleotide());
}

// True while a mouse button is held, i.e. pv is rotating or panning.
function isDragging() {
  const mh = viewer._mouseHandler;
  return mh._lastMouseDownTime && !(mh._lastMouseUpTime >= mh._lastMouseDownTime);
}

// A short press that isn't the second half of a double-click.
function isFastClick(event) {
  const mh = viewer._mouseHandler;
  const fast = mh._lastMouseUpTime - mh._lastMouseDownTime < 300 &&
               event.timeStamp - lastClickTime > 300;
  lastClickTime = event.timeStamp;
  return fast;
}

function setStatus(html) {
  document.getElementById('pv_status').innerHTML = html;
}

function residueInfo(picked, atom) {
  const res = atom.residue();
  const insCode = res.insCode() !== '\0' ? res.insCode() : '';
  return {
    strucId: picked.object().geom.name(),
    chain: res.chain().name(),
    resno: res.num(),
    insCode,
  };
}

// "GLU 6 A" from the label_* ids mmCIF chains and residues are named by.
// The parser keeps the author (PDB-style) ids only where they differ, and
// each follows the value it qualifies, the way RCSB writes them:
// "GLU 6 [auth 7] A", "SO4 901 B [auth A]", "47W 1 [auth 1335] C [auth A]".
function residueLabel(res, resno, insCode, chain) {
  // prop() returns 0 for a property that was never set.
  const authNum = res.prop('authSeqId');
  const authChain = res.prop('authAsymId');
  return `${res.name()} ${resno}${insCode}` +
         (authNum ? ` [auth ${authNum}]` : '') + ` ${chain}` +
         (authChain ? ` [auth ${authChain}]` : '');
}

// the full name shown first: a ligand's chemical name (chem_comp.name),
// else its chain's entity description (_entity.pdbx_description), e.g. the
// protein's name. Both come from mmCIF; nothing is shown for PDB input.
// Escaped, since the status bar is set through innerHTML.
function nameLabel(res) {
  const name = res.prop('compName') || res.chain().prop('entityDescription');
  if (!name) return '';
  const div = document.createElement('div');
  div.textContent = name;
  return `${div.innerHTML} <br/> `;
}

function highlightAtom(picked, atom, event) {
  setHovered(picked.node(), atom.residue(), picked.symIndex());

  const { strucId, chain, resno, insCode } = residueInfo(picked, atom);
  setStatus(nameLabel(atom.residue()) +
            residueLabel(atom.residue(), resno, insCode, chain) +
            resAnnoLabel(strucId, chain, resno));

  event.target.dispatchEvent(new CustomEvent('highlightResidue', {
    bubbles: true,
    detail: {
      src: 'structure', struc_id: strucId, chain, resno,
      ...(insCode && { insCode }),
    },
  }));
}

// Click selects the residue, or deselects it if it's already selected;
// ctrl/cmd-click toggles it. Shift-click selects everything from the last
// non-shift click to here in the same chain (shift+ctrl adds that range).
function selectResidue(picked, atom, event) {
  if (typeof atom.residue !== 'function') return;   // a labelled shape
  const node = picked.node(), residue = atom.residue();
  if (!residue.isAminoacid() && !residue.isNucleotide()) return;
  const isSelected = selected.has(node) && selected.get(node).has(residue);
  // clicking a selected residue toggles it off, like ctrl-click
  const ctrl = event.ctrlKey || event.metaKey || (!event.shiftKey && isSelected);
  let residues = [residue];
  if (event.shiftKey && anchor !== null && anchor.node === node &&
      anchor.residue.chain() === residue.chain()) {
    residues = residueRange(anchor.residue, residue);
  } else {
    anchor = { node, residue };
  }
  selectResidues(node, residues, ctrl);

  // action says what happened to the selection, so listeners needn't track
  // it themselves: 'replace' (it is now exactly these residues), 'add' or
  // 'remove'. ctrl is kept for existing listeners.
  const action = !ctrl ? 'replace' :
                 residues.length === 1 && isSelected ? 'remove' : 'add';
  document.body.dispatchEvent(new CustomEvent('selectResidues', {
    detail: {
      src: 'structure',
      struc_id: node.name(),
      action,
      residues: residues.map((r) => {
        const insCode = r.insCode() !== '\0' ? r.insCode() : '';
        return { chain: r.chain().name(), resno: r.num(), ...(insCode && { insCode }) };
      }),
      ctrl,
    },
  }));
}

// A pick on an SNFG symbol, a filled ring or a base returns one of its
// atoms; treat it as a pick on that residue in the object it belongs to,
// so hover and selection highlight it there (the overlays' custom meshes
// have no hover or selection of their own).
function resolvePick(picked) {
  if (picked === null) return null;
  // the bases belong to the cartoon ('structure.protein' for the default
  // style, 'structure' for the others), the other overlays to the ligands
  const name = picked.node().name();
  let node;
  if (name === 'structure.bases') {
    node = viewer.get('structure.protein') || viewer.get('structure');
  } else if (name === 'structure.glycans' || name === 'structure.rings') {
    node = viewer.get('structure.ligand');
  } else {
    return picked;
  }
  if (node === null) return null;
  const symIndex = picked.symIndex();
  return {
    node: () => node,
    object: () => ({ geom: node }),
    target: () => picked.target(),
    pos: () => picked.pos(),
    // the overlays draw the copies of an assembly themselves and tag the
    // shapes with theirs, in the same order as the node's
    symIndex: () => symIndex,
    transform: () => (symIndex !== null ? node.symWithIndex(symIndex) : null),
  };
}

// Shows what's under picked/atom in the status bar and arms the hover
// highlight -- the information mousemove shows on desktop, also used for a
// touch tap below, since touch has no hover of its own.
function showResidueInfo(picked, atom, event) {
  setHovered(null);
  if (atom === null) {
    setStatus('');
    return;
  }
  // a custom mesh shape tagged with a label rather than an atom, like the
  // parts of the custom mesh demo: name it and highlight it (and every
  // other shape with the same label)
  if (typeof atom.residue !== 'function') {
    const node = picked.node();
    hovered = { node, residue: atom, symIndex: picked.symIndex() };
    node.setHover((userData) => userData === atom);
    const div = document.createElement('div');
    div.textContent = String(atom);
    setStatus(div.innerHTML);
    return;
  }
  const res = atom.residue();
  const isPolymer = res.chain().name()[0] !== '_' &&
                    (res.isAminoacid() || res.isNucleotide());
  if (isPolymer) {
    highlightAtom(picked, atom, event);
  } else {
    setHovered(picked.node(), res, picked.symIndex());
    const { chain, resno, insCode } = residueInfo(picked, atom);
    setStatus(nameLabel(res) + residueLabel(res, resno, insCode, chain));
  }
}

function doPVMouse(event) {
  if (isDragging()) return;

  const fastClick = event.type === 'click' && isFastClick(event);
  const rect = viewer.boundingClientRect();
  const picked = resolvePick(viewer.pick({ x: event.clientX - rect.left,
                                              y: event.clientY - rect.top }));
  const atom = picked !== null ? picked.target() : null;

  // Still over the highlighted residue (or labelled shape): nothing changes
  // unless it's clicked.
  const isAtom = atom !== null && typeof atom.residue === 'function';
  if (atom !== null && hovered !== null && hovered.node === picked.node() &&
      (isAtom ? atom.residue() : atom) === hovered.residue &&
      picked.symIndex() === hovered.symIndex) {
    if (fastClick && isAtom) selectResidue(picked, atom, event);
    viewer.requestRedraw();
    return;
  }

  showResidueInfo(picked, atom, event);
  viewer.requestRedraw();
}

document.body.addEventListener('mousemove',
  (e) => e.target.matches('#viewer canvas') ? doPVMouse(e) : null, true);
document.body.addEventListener('click',
  (e) => e.target.matches('#viewer canvas') ? doPVMouse(e) : null, true);

// Touch gets none of the above: there's no hover, and touch.ts's
// preventDefault() calls suppress the synthetic mouse/click events a tap
// would otherwise generate. Its 'click' (tap) and 'longPress' events are
// pv's internal dispatch (see touch.ts), so they're wired up here instead:
// a tap shows residue info like mousemove does, and a long press selects
// like a mouse click; double-tap-to-zoom is unaffected, registered
// separately above via 'doubleClick'.
viewer.on('click', function(picked, event) {
  if (!event.type.startsWith('touch')) return;  // desktop handled above
  picked = resolvePick(picked);
  const atom = picked !== null ? picked.target() : null;
  showResidueInfo(picked, atom, event);
  viewer.requestRedraw();
});

viewer.on('longPress', function(picked, event) {
  picked = resolvePick(picked);
  const atom = picked !== null ? picked.target() : null;
  if (atom === null) return;
  showResidueInfo(picked, atom, event);
  selectResidue(picked, atom, event);
  viewer.requestRedraw();
});
