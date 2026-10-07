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
  viewer.cartoon('structure', structure, {
      color : color.ssSuccession(), showRelated : related(), baseSticks : false,
  });
  addLigands(true);
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

function licorice() {
  viewer.clear();
  addLigands();
  viewer.licorice('structure', structure, { showRelated : related() });
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
// switching structures keeps the look. Colors start out as secondary
// structure succession, for every style.
var currentStyle = preset;
var currentColor = ssSuccession;

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

// the ligands: everything but water that the cartoon doesn't draw, so a
// free nucleotide such as ATP or a free amino acid counts but a chain's
// bases don't.
function ligands() {
  return structure.select('ligand');
}

// ligands (sugars included) as balls and sticks, plus the add-ons' overlays
// as toggled in the display widget: 3D-SNFG symbols on glycans (pv.snfg)
// and filled rings (pv.rings). With withBases (the cartoon-like styles,
// which then leave out their own grey base sticks), DNA and RNA bases also
// get filled, outlined rings on a stick from the backbone tube in the
// base's color (pv.rings.drawBases).
function addLigands(withBases) {
  viewer.licorice('structure.ligand', ligands(), { showRelated : related() });
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
  io.fetchCif('structures/'+cif_id+'.cif').then(function(s) {
    structure = s;
    showStructure();
    viewer.autoZoom();
  }, function(error) {
    showWarning('Could not load structure "' + cif_id + '": ' + error.message);
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
      go.colorBy(color.uniform([0.55, 0.65, 0.78]));
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


// two Kandinskys as reliefs, back to back on a free-standing wall: Swinging
// (Schaukeln, 1925) on the front and Delicate Tension (Zarte Spannung,
// 1923) on the back, for whoever turns it round. The paintings' circles
// become spheres, their triangles slabs and cones, their lines tubes,
// stacked at different depths in front of the canvas, so turning it shows
// the compositions in 3D. None of it is derived from a molecular structure:
// customMesh is the escape hatch for drawing arbitrary annotated geometry
// (markers, measurement lines, ...) alongside whatever else is in the scene.
// addSphere and addTube tessellate coarsely (they are meant for small
// markers), so the large curved shapes here are addTriangles with per-vertex
// normals for smooth shading. Every part carries a userData label, so
// hovering it names and highlights it.
function customMeshDemo() {
  viewer.clear();
  var go = viewer.customMesh('custom');
  // setOpacity() applies to a whole mesh, so the translucent pink fan gets
  // one of its own
  var glass = viewer.customMesh('custom.glass');

  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function norm(a) { return scale(a, 1 / (Math.sqrt(dot(a, a)) || 1)); }
  // a point given in pixels of the painting's reproduction (y down), at
  // depth z in front of its canvas, which is 68 units wide: see painting()
  var pixel = 0.2, imageWidth = 340, imageHeight = 485;
  function P(px, py, z) {
    return [(px - imageWidth / 2) * pixel, (imageHeight - py) * pixel, z || 0];
  }
  // where solid() puts what is built: turned by angle about the y axis,
  // after moving it up by lift and out of the wall by out
  var place = { cos : 1, sin : 0, lift : 0, out : 0 };
  function placed(p, isNormal) {
    var x = p[0], y = p[1] + (isNormal ? 0 : place.lift), z = p[2] + (isNormal ? 0 : place.out);
    return [place.cos * x + place.sin * z, y, place.cos * z - place.sin * x];
  }
  // draws a painting reproduced at width x height pixels on one side of
  // the wall
  function painting(width, height, angle, out, draw) {
    imageWidth = width;
    imageHeight = height;
    pixel = 68 / width;
    place = { cos : Math.cos(angle), sin : Math.sin(angle), lift : 6, out : out };
    draw();
  }
  // two unit vectors perpendicular to axis, and the axis itself
  function frame(axis) {
    var w = norm(axis);
    var u = norm(cross(w, Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    return [u, cross(w, u), w];
  }
  function local(f, x, y, z) {
    return add(add(scale(f[0], x), scale(f[1], y)), scale(f[2], z));
  }

  // one pickable shape: build() emits its triangles through tri(a, b, c,
  // na, nb, nc), in either winding -- each one is turned to face the way
  // its normals point
  function solid(label, color, build, mesh) {
    var pos = [], nrm = [];
    build(function(a, b, c, na, nb, nc) {
      if (dot(cross(sub(b, a), sub(c, a)), add(add(na, nb), nc)) < 0) {
        var t = b; b = c; c = t;
        t = nb; nb = nc; nc = t;
      }
      pos.push.apply(pos, placed(a).concat(placed(b), placed(c)));
      nrm.push.apply(nrm, placed(na, true).concat(placed(nb, true), placed(nc, true)));
    });
    (mesh || go).addTriangles(pos, { color : color, normals : nrm, userData : label });
  }
  // a smooth surface f(u, v) -> [point, normal] over the unit square
  function grid(tri, f, nu, nv) {
    for (var i = 0; i < nu; ++i) {
      for (var j = 0; j < nv; ++j) {
        var a = f(i / nu, j / nv), b = f((i + 1) / nu, j / nv);
        var c = f((i + 1) / nu, (j + 1) / nv), d = f(i / nu, (j + 1) / nv);
        tri(a[0], b[0], c[0], a[1], b[1], c[1]);
        tri(a[0], c[0], d[0], a[1], c[1], d[1]);
      }
    }
  }
  // a flat fan from center to a closed loop of points
  function fan(tri, center, n, loop) {
    for (var i = 0; i < loop.length; ++i) {
      tri(center, loop[i], loop[(i + 1) % loop.length], n, n, n);
    }
  }
  function circle(center, f, r, n) {
    var pts = [];
    for (var i = 0; i < n; ++i) {
      var a = i * 2 * Math.PI / n;
      pts.push(add(center, local(f, r * Math.cos(a), r * Math.sin(a), 0)));
    }
    return pts;
  }

  // a sphere, an ellipsoid (r as [rx, ry, rz]) or, with half, a dome on a
  // flat base, bulging along axis
  function ball(c, r, color, label, opts) {
    opts = opts || {};
    var rr = typeof r === 'number' ? [r, r, r] : r;
    var f = frame(opts.axis || [0, 1, 0]);
    var top = opts.half ? Math.PI / 2 : Math.PI;
    solid(label, color, function(tri) {
      grid(tri, function(u, v) {
        var phi = u * 2 * Math.PI, theta = v * top;
        var d = local(f, Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi),
                      Math.cos(theta));
        return [add(c, [d[0] * rr[0], d[1] * rr[1], d[2] * rr[2]]),
                norm([d[0] / rr[0], d[1] / rr[1], d[2] / rr[2]])];
      }, 64, opts.half ? 16 : 32);
      if (opts.half) {
        fan(tri, c, scale(f[2], -1), circle(c, f, rr[0], 64));
      }
    }, opts.mesh);
  }
  function cylinder(a, b, r, color, label) {
    var f = frame(sub(b, a)), axis = sub(b, a);
    solid(label, color, function(tri) {
      grid(tri, function(u, v) {
        var d = local(f, Math.cos(u * 2 * Math.PI), Math.sin(u * 2 * Math.PI), 0);
        return [add(add(a, scale(axis, v)), scale(d, r)), d];
      }, 64, 1);
      fan(tri, a, scale(f[2], -1), circle(a, f, r, 64));
      fan(tri, b, f[2], circle(b, f, r, 64));
    });
  }
  function cone(base, tip, r, color, label) {
    var f = frame(sub(tip, base)), axis = sub(tip, base);
    var h = Math.sqrt(dot(axis, axis));
    solid(label, color, function(tri) {
      grid(tri, function(u, v) {
        var d = local(f, Math.cos(u * 2 * Math.PI), Math.sin(u * 2 * Math.PI), 0);
        return [add(add(base, scale(axis, v)), scale(d, r * (1 - v))),
                norm(add(scale(d, h), scale(f[2], r)))];
      }, 64, 1);
      fan(tri, base, scale(f[2], -1), circle(base, f, r, 64));
    });
  }
  // a ring of radius R around axis, its tube of radius r
  function torus(c, axis, R, r, color, label) {
    var f = frame(axis);
    solid(label, color, function(tri) {
      grid(tri, function(u, v) {
        var d = local(f, Math.cos(u * 2 * Math.PI), Math.sin(u * 2 * Math.PI), 0);
        var n = add(scale(d, Math.cos(v * 2 * Math.PI)), scale(f[2], Math.sin(v * 2 * Math.PI)));
        return [add(add(c, scale(d, R)), scale(n, r)), n];
      }, 96, 12);
    });
  }
  // a tube of radius r along a polyline, its cross-sections carried along
  // without twisting (parallel transport)
  function tube(pts, r, color, label) {
    var last = pts.length - 1, t = [], n = [], b = [];
    for (var i = 0; i <= last; ++i) {
      t[i] = norm(sub(pts[Math.min(i + 1, last)], pts[Math.max(i - 1, 0)]));
      var prev = i === 0 ? frame(t[0])[0] : n[i - 1];
      n[i] = norm(sub(prev, scale(t[i], dot(prev, t[i]))));
      b[i] = cross(t[i], n[i]);
    }
    var m = 20;
    function around(i, k) {
      var a = k * 2 * Math.PI / m;
      var d = add(scale(n[i], Math.cos(a)), scale(b[i], Math.sin(a)));
      return [add(pts[i], scale(d, r)), d];
    }
    solid(label, color, function(tri) {
      for (var i = 0; i < last; ++i) {
        for (var k = 0; k < m; ++k) {
          var p = around(i, k), q = around(i + 1, k);
          var s = around(i + 1, k + 1), o = around(i, k + 1);
          tri(p[0], q[0], s[0], p[1], q[1], s[1]);
          tri(p[0], s[0], o[0], p[1], s[1], o[1]);
        }
      }
      var ends = [[0, scale(t[0], -1)], [last, t[last]]];
      ends.forEach(function(e) {
        var loop = [];
        for (var k = 0; k < m; ++k) loop.push(around(e[0], k)[0]);
        fan(tri, pts[e[0]], e[1], loop);
      });
    });
  }
  // a flat, convex outline (points in the xy plane) extruded from depth z0
  // to z1
  function slab(pts, z0, z1, color, label, mesh) {
    var c = [0, 0];
    pts.forEach(function(p) { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; });
    solid(label, color, function(tri) {
      var front = [], back = [];
      pts.forEach(function(p) { back.push([p[0], p[1], z0]); front.push([p[0], p[1], z1]); });
      fan(tri, [c[0], c[1], z0], [0, 0, -1], back);
      fan(tri, [c[0], c[1], z1], [0, 0, 1], front);
      for (var i = 0; i < pts.length; ++i) {
        var j = (i + 1) % pts.length;
        var side = norm([pts[j][1] - pts[i][1], pts[i][0] - pts[j][0], 0]);
        if (dot(side, [pts[i][0] - c[0], pts[i][1] - c[1], 0]) < 0) side = scale(side, -1);
        tri(back[i], back[j], front[j], side, side, side);
        tri(back[i], front[j], front[i], side, side, side);
      }
    }, mesh);
  }
  // a rectangle between two corners given in pixels
  function block(px0, py0, px1, py1, z0, z1, color, label) {
    slab([P(px0, py0), P(px1, py0), P(px1, py1), P(px0, py1)], z0, z1, color, label);
  }
  // a quadratic Bezier curve through n + 1 points
  function curve(p0, p1, p2, n) {
    var pts = [];
    for (var i = 0; i <= n; ++i) {
      var s = i / n;
      pts.push(add(add(scale(p0, (1 - s) * (1 - s)), scale(p1, 2 * s * (1 - s))),
                   scale(p2, s * s)));
    }
    return pts;
  }

  var cream = [0.93, 0.91, 0.85], black = [0.07, 0.07, 0.08];
  var yellow = [0.95, 0.77, 0.18], ochre = [0.86, 0.6, 0.22];
  var orange = [0.94, 0.47, 0.1], red = [0.78, 0.13, 0.11];
  var blue = [0.13, 0.3, 0.64], slate = [0.4, 0.49, 0.63];
  var green = [0.27, 0.58, 0.3], pink = [0.95, 0.66, 0.72];
  var grey = [0.56, 0.58, 0.62], white = [0.96, 0.95, 0.92];
  var seed = 11;
  function random() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  // a thin line between two points given in pixels, at depths z0 and z1
  function line(px0, py0, px1, py1, z0, z1, color, r) {
    tube([P(px0, py0, z0), P(px1, py1, z1)], r || 0.13, color || black, 'line');
  }

  // the wall: Swinging on its front (+z), Delicate Tension on its back
  place = { cos : 1, sin : 0, lift : 0, out : 0 };
  slab([[-40, 0], [40, 0], [40, 112], [-40, 112]], -12, -10, [0.24, 0.24, 0.26], 'wall');
  cylinder([0, -1.5, -11], [0, 0, -11], 75, [0.8, 0.79, 0.77], 'floor');

  painting(340, 485, 0, 0, function() {
    // the canvas, and the soft washes of color the forms float in front of
    slab([P(0, 0), P(340, 0), P(340, 485), P(0, 485)], -10, -9, cream, 'canvas');
    [[250, 255, [9, 7], [0.62, 0.76, 0.87]], [312, 400, [6, 10], [0.6, 0.73, 0.84]],
     [28, 385, [5, 8], [0.33, 0.6, 0.55]], [205, 172, [6.5, 5.5], [0.84, 0.27, 0.2]],
     [240, 35, [11, 5], [0.72, 0.77, 0.82]], [235, 432, [9, 3.5], [0.28, 0.22, 0.34]],
     [95, 235, [7, 6], [0.9, 0.74, 0.45]]].forEach(function(w) {
      ball(P(w[0], w[1], -8.6), [w[2][0], w[2][1], 0.4], w[3], 'wash');
    });

    // top left: three wavy lines on a black panel
    block(18, 0, 78, 165, -8, -7, black, 'black panel');
    [[32, yellow], [50, orange], [66, ochre]].forEach(function(l, k) {
      var pts = [];
      for (var py = 6; py <= 158; py += 2) {
        pts.push(P(l[0] + 5 * Math.sin(py / 40 * 2 * Math.PI + k * 0.6), py, -6.4));
      }
      tube(pts, 0.55, l[1], 'wavy line');
    });
    tube(curve(P(40, 138, -5), P(55, 185, -4), P(118, 192, -3), 24), 0.5, pink, 'pink arc');

    // the big yellow triangle, a grey one over its foot, and the blue-grey
    // ray from the top right corner: a long cone narrowing to a point
    slab([P(115, 38), P(55, 197), P(186, 176)], -5, -3.5, yellow, 'yellow triangle');
    slab([P(140, 96), P(92, 197), P(186, 190)], -3.5, -2.5, grey, 'grey triangle');
    cone(P(336, 4, -3), P(178, 140, -3), 4, slate, 'ray');

    // the black, orange and green circles of the top half
    ball(P(190, 75, 1), 4.4, black, 'black circle');
    ball(P(293, 97, 0), 5, orange, 'orange circle');
    ball(P(215, 170, 1.5), 4, green, 'green circle');
    torus(P(215, 170, 1.5), [0, 0, 1], 5.3, 0.16, black, 'green circle');

    // top right: red and yellow stripes, stepping in and out
    [red, yellow, red, orange, red].forEach(function(c, k) {
      block(266, 168 + k * 7.5, 340, 175 + k * 7.5, -6, k % 2 ? -3 : -4.5, c, 'stripes');
    });

    // the dark plane under the triangles with its little squares, a ball
    // half red and half blue, and two black spikes pointing down
    slab([P(55, 197), P(135, 190), P(150, 312), P(70, 330)], -6, -5, black, 'dark plane');
    block(118, 196, 138, 214, -5, -4, yellow, 'square');
    block(124, 222, 140, 238, -5, -3.6, blue, 'square');
    block(112, 246, 128, 262, -5, -4.4, red, 'square');
    ball(P(158, 228, 2), 1.7, red, 'red and blue ball', { axis : [1, 0, 0], half : true });
    ball(P(158, 228, 2), 1.7, blue, 'red and blue ball', { axis : [-1, 0, 0], half : true });
    cone(P(180, 224, 2), P(186, 270, 2), 1.4, black, 'spike');
    cone(P(201, 232, 1), P(197, 274, 1), 1.1, black, 'spike');

    // the left column: a pale pillar topped with a dome, carrying a red,
    // a black and a pale orange circle and a yellow half circle
    block(18, 252, 62, 440, -7, -5, white, 'pillar');
    ball(P(40, 250, -3), 5, [0.88, 0.88, 0.9], 'dome', { half : true });
    cylinder(P(40, 254, -3), P(40, 250, -3), 5.8, [0.3, 0.3, 0.33], 'dome');
    ball(P(40, 286, -2), 2.8, red, 'red circle');
    torus(P(40, 286, -2), [0, 0, 1], 3.4, 0.18, black, 'red circle');
    ball(P(40, 352, -2), 4.3, black, 'black disc');
    ball(P(40, 403, -2), 3, [0.96, 0.7, 0.4], 'pale orange circle');
    var half = [];
    for (var a = 0; a <= 24; ++a) {
      half.push(add(P(40, 440), [3.6 * Math.cos(a * Math.PI / 24), 3.6 * Math.sin(a * Math.PI / 24), 0]));
    }
    slab(half, -4, -2.5, yellow, 'yellow half circle');

    // the checkerboard: colored blocks of different heights (a fixed pseudo-
    // random choice, so the scene is the same every time)
    var tiles = [yellow, blue, red, white, green, pink, slate, orange, black, ochre];
    for (var row = 0; row < 5; ++row) {
      for (var col = 0; col < 6; ++col) {
        var x0 = 84 + col * 14, y0 = 312 + row * 14.5;
        block(x0 + 0.5, y0 + 0.5, x0 + 13.5, y0 + 14, -5, -4 + 3.5 * random(),
              tiles[Math.floor(random() * tiles.length)], 'checkerboard');
      }
    }
    block(76, 385, 170, 391, -5, -3, white, 'white bar');

    // the pink fan, translucent, over the blocks and bars below it
    var fanPts = [P(146, 335)];
    for (var a2 = 0; a2 <= 32; ++a2) {
      var ang = -Math.PI / 2 + a2 * Math.PI / 64;
      fanPts.push(add(P(146, 335), [21 * Math.cos(ang), 21 * Math.sin(ang), 0]));
    }
    slab(fanPts, 1.5, 2.3, pink, 'pink fan', glass);
    glass.setOpacity(0.7);

    // bottom right: two blue arcs swinging out of the picture plane, little
    // domes at their feet, a black post and the bars it crosses
    tube(curve(P(216, 322, -1), P(222, 212, 9), P(302, 208, 2), 32), 0.55, blue, 'blue arc');
    tube(curve(P(258, 322, -1), P(266, 232, 7), P(336, 232, 2), 32), 0.55, blue, 'blue arc');
    ball(P(226, 324, -2), 2.4, pink, 'pink dome', { half : true });
    ball(P(268, 324, -2), 2.4, [0.66, 0.8, 0.9], 'blue dome', { half : true });
    block(160, 324, 332, 328, -4, -1.5, black, 'bar');
    block(165, 343, 336, 348, -4, 0, black, 'bar');
    block(172, 351, 300, 354, -4, -1, red, 'red bar');
    cylinder(P(300, 445, -1), P(300, 210, -1), 0.75, black, 'post');

    // the black base everything stands on
    block(18, 440, 312, 452, -7, 1.5, black, 'base');
  });

  // Delicate Tension, turned half way round so it faces -z, its canvas on
  // the back of the wall
  painting(1024, 1463, Math.PI, 22, function() {
    function px(n) { return n * pixel; }
    var paper = [0.94, 0.93, 0.89], olive = [0.66, 0.6, 0.34];
    var crimson = [0.74, 0.1, 0.33], rose = [0.86, 0.25, 0.42];
    slab([P(0, 0), P(1024, 0), P(1024, 1463), P(0, 1463)], -10, -9, paper, 'paper');

    // the lance: black from its point at the bottom, olive through the
    // middle, black again with a red stretch near the top, and a blue bead
    // where the pink lines cross it. It leans out of the picture towards
    // the bottom.
    cone(P(500, 1075, 2), P(400, 1340, 5), px(26), black, 'lance');
    cylinder(P(500, 1075, 2), P(648, 595, -2), px(20), olive, 'lance');
    cone(P(648, 595, -2), P(792, 42, -5), px(19), black, 'lance');
    cylinder(P(716, 318, -3.7), P(762, 172, -4.6), px(9), red, 'lance');
    ball(P(695, 355, -3.5), px(17), blue, 'blue bead');
    [[1030, 1050], [1060, 1080]].forEach(function(b) {
      var s0 = (b[0] - 1075) / 265, s1 = (b[1] - 1075) / 265;
      cylinder(P(500 + 100 * s0, b[0], 2), P(500 + 100 * s1, b[1], 2), px(22), white, 'lance');
    });

    // the pink lines: a tall V through the lance, and rays fanning out
    // from the bowl to the left edge
    tube([P(285, 425, -6), P(585, 65, -4), P(778, 585, -1)], 0.16, rose, 'pink lines');
    [[80, 995, 590, 870], [100, 1130, 560, 905], [160, 1255, 590, 880],
     [565, 1210, 600, 900]].forEach(function(l) {
      line(l[0], l[1], l[2], l[3], -1, -3, rose, 0.12);
    });

    // top left: the grey triangle with its black and red cap, the yellow
    // disc over it and a small olive one, and the blue circle further down
    slab([P(240, 385), P(318, 165), P(350, 165), P(598, 452)], -8, -7, [0.68, 0.66, 0.63], 'grey triangle');
    slab([P(310, 178), P(352, 178), P(347, 192), P(305, 192)], -7, -6.5, black, 'grey triangle');
    slab([P(318, 160), P(350, 160), P(351, 166), P(316, 166)], -7, -6.5, red, 'grey triangle');
    ball(P(415, 315, -6), [px(72), px(72), px(24)], [0.95, 0.74, 0.14], 'yellow disc');
    for (var arc = 0; arc < 3; ++arc) {
      var cx = 375 + arc * 30, arcPts = [];
      for (var a = 0; a <= 16; ++a) {
        var t = Math.PI * a / 16;
        arcPts.push(P(cx + 32 * Math.cos(t), 345 - 32 * Math.sin(t), -6 + px(24) + 0.1));
      }
      tube(arcPts, 0.1, [0.4, 0.3, 0.1], 'yellow disc');
    }
    ball(P(470, 268, -4), px(24), [0.5, 0.52, 0.24], 'olive circle');
    ball(P(203, 430, -3), px(35), [0.13, 0.28, 0.68], 'blue circle');
    line(150, 348, 245, 512, -4, -2);
    line(155, 378, 330, 545, -4, -2);
    line(235, 130, 400, 435, -5, -6);
    line(310, 445, 570, 238, -6, -4);
    line(325, 110, 340, 230, -5, -5);
    [140, 150, 160].forEach(function(y) { line(312, y, 352, y - 6, -5, -5, black, 0.08); });

    // the black-ringed crimson target on the right, and the black bar on
    // the left
    torus(P(862, 595, -2), [0, 0, 1], px(34), px(12), black, 'target');
    ball(P(862, 595, -2), px(22), crimson, 'target');
    tube([P(48, 635, -4), P(153, 577, -3)], px(10), black, 'black bar');

    // the yellow A and its striped crossbar, and the pink stripes under it
    line(130, 620, 305, 915, -6, -4, yellow, 0.12);
    line(130, 620, 130, 980, -6, -5, yellow, 0.12);
    line(310, 650, 395, 940, -5, -3, yellow, 0.1);
    [0, 9, 18].forEach(function(d) {
      line(120, 742 - d, 272, 662 - d, -5, -5, ochre, 0.18);
      line(85, 788 + d, 215, 826 + d, -6, -6, rose, 0.1);
    });

    // the bowl: a yellow half disc with a ribbed rim, an orange and a blue
    // triangle in it, and a small green ring with an orange centre
    var bowl = [];
    for (var b = 0; b <= 32; ++b) {
      var ang = Math.PI + b * Math.PI / 32;
      bowl.push(add(P(540, 880), [px(232) * Math.cos(ang), px(232) * Math.sin(ang), 0]));
    }
    slab(bowl, -8, -7, [0.97, 0.8, 0.32], 'bowl');
    [238, 250, 262].forEach(function(r, k) {
      var rim = [];
      for (var b2 = 0; b2 <= 48; ++b2) {
        var ang2 = Math.PI + b2 * Math.PI / 48;
        rim.push(add(P(540, 880, -6.6 + k * 0.4), [px(r) * Math.cos(ang2), px(r) * Math.sin(ang2), 0]));
      }
      tube(rim, k === 1 ? 0.22 : 0.12, k === 1 ? [0.85, 0.6, 0.1] : black, 'bowl rim');
    });
    slab([P(305, 832), P(470, 895), P(305, 895)], -7, -6, orange, 'orange triangle');
    slab([P(412, 1050), P(510, 958), P(500, 1085)], -7, -5.8, [0.33, 0.55, 0.85], 'blue triangle');
    torus(P(392, 972, -4), [0, 0, 1], px(24), px(5), [0.2, 0.35, 0.2], 'green ring');
    ball(P(392, 972, -4), px(9), orange, 'green ring');

    // the chequered band slanting down to the right across the lance, and
    // the chequered block beside it: tiles of different heights
    var dtTiles = [white, white, black, [0.7, 0.7, 0.7], crimson, [0.12, 0.5, 0.6],
                   yellow, olive, pink, orange, [0.75, 0.75, 0.68]];
    var u = [0.87, 0.49], v = [-0.49, 0.87], size = 62;
    for (var i = 0; i < 9; ++i) {
      for (var j = 0; j < 3; ++j) {
        var o = [355 + (i * u[0] + j * v[0]) * size, 650 + (i * u[1] + j * v[1]) * size];
        var corner = function(du, dv) {
          return P(o[0] + (du * u[0] + dv * v[0]) * (size - 4),
                   o[1] + (du * u[1] + dv * v[1]) * (size - 4));
        };
        slab([corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)], -7, -6 + 2.5 * random(),
             dtTiles[Math.floor(random() * dtTiles.length)], 'chequered band');
      }
    }
    for (var r2 = 0; r2 < 5; ++r2) {
      for (var c2 = 0; c2 < 4; ++c2) {
        var x0 = 650 + c2 * 55 + r2 * 4, y0 = 665 + r2 * 58;
        block(x0, y0, x0 + 51, y0 + 54, -7.5, -6.5 + 2 * random(),
              dtTiles[Math.floor(random() * dtTiles.length)], 'chequered block');
      }
    }
    var arch = [];
    for (var h = 0; h <= 16; ++h) {
      arch.push(P(740 + 32 * Math.cos(Math.PI * h / 16), 720 - 32 * Math.sin(Math.PI * h / 16), -3));
    }
    tube(arch, 0.25, red, 'arch');

    // long thin lines running off to the right and across the picture
    line(80, 985, 862, 185, -7, -4);
    line(600, 735, 965, 945, -5, -5);
    line(575, 780, 985, 1000, -5, -5);
    line(560, 830, 1015, 1120, -5, -4);
    line(400, 1240, 455, 505, -3, -6);
    line(330, 735, 810, 1180, -6, -2);

    // top right: a pale green and an olive plane, and a red spike
    slab([P(698, 145), P(752, 125), P(778, 130), P(762, 156)], -6, -5, [0.82, 0.88, 0.78], 'pale green plane');
    slab([P(806, 142), P(842, 150), P(850, 170), P(810, 168)], -6, -5, olive, 'olive plane');
    cone(P(862, 172, -4), P(935, 190, -4), px(9), [0.92, 0.27, 0.15], 'red spike');
    line(715, 335, 885, 160, -4, -5);
    [0, 9, 18].forEach(function(d) { line(760 + d, 255, 815 + d, 300, -5, -5, black, 0.08); });

    // bottom right: crossings of thin lines with an orange, a red and a
    // green ring at them
    ball(P(790, 1188, -2), px(20), orange, 'orange dot');
    ball(P(748, 1255, -2), px(11), crimson, 'red dot');
    torus(P(828, 1312, -2), [0, 0, 1], px(10), px(3), [0.45, 0.6, 0.4], 'green dot');
    [0, 10, 20].forEach(function(d) {
      line(690, 1215 + d, 860, 1168 + d, -2.5, -2.5, black, 0.08);
      line(850 + d * 1.5, 1420, 1000 + d * 1.5, 1195, -3, -3, black, 0.08);
    });
    line(740, 1170, 740, 1368, -2, -2);
    line(760, 1112, 848, 1342, -2, -2);
    line(670, 1258, 790, 1262, -2, -2);
    line(795, 1305, 935, 1345, -2, -2);
  });

  // frame the front of the wall, turned a little to show the relief's
  // depth; the back is for whoever turns it round
  var rotation = pv.mat4.create();
  pv.mat4.rotateX(rotation, rotation, 0.08);
  pv.mat4.rotateY(rotation, rotation, -0.35);
  viewer.setRotation(rotation, 0);
  viewer.setCenter([0, 54, -8], 0);
  viewer.setZoom(150, 0);
}

// the 20 models of an NMR structure (the C-terminal domain of T. cruzi
// poly(A)-binding protein), colored by how much they disagree: for each
// residue, the RMS deviation of its CA from the mean over the models, from
// blue where they agree (the well-determined helices) to red where they
// fan out (the disordered ends). The first model is drawn as a cartoon,
// the others as thin tubes around it.
//
// The coloring is a custom pv.color.ColorOp: a function filling in the
// color of each atom, here looked up from the residue's spread.
function ensemble() {
  io.fetchCif('structures/1nmr.cif', function(structures) {
    viewer.clear();
    structure = structures[0];

    // each residue's CA positions over the models, by residue number
    var positions = new Map();
    structures.forEach(function(model) {
      model.eachResidue(function(residue) {
        var ca = residue.atom('CA');
        if (ca === null) return;
        if (!positions.has(residue.num())) positions.set(residue.num(), []);
        positions.get(residue.num()).push(ca.pos());
      });
    });
    var spread = new Map();
    positions.forEach(function(list, num) {
      var mean = [0, 0, 0];
      list.forEach(function(p) {
        for (var k = 0; k < 3; ++k) mean[k] += p[k] / list.length;
      });
      var sum = 0;
      list.forEach(function(p) {
        for (var k = 0; k < 3; ++k) sum += (p[k] - mean[k]) * (p[k] - mean[k]);
      });
      spread.set(num, Math.sqrt(sum / list.length));
    });

    // 0 A blue, 3 A pale, 6 A and more red
    var gradient = color.gradient(['#2f5fb3', '#e9e4dc', '#c8372d']);
    var maxSpread = 6.0;
    var rgba = [0, 0, 0, 1];
    var bySpread = new pv.color.ColorOp(function(atom, out, index) {
      var s = spread.get(atom.residue().num());
      gradient.colorAt(rgba, Math.min((s === undefined ? 0 : s) / maxSpread, 1));
      out[index] = rgba[0];
      out[index + 1] = rgba[1];
      out[index + 2] = rgba[2];
      out[index + 3] = rgba[3];
    }, null, null);

    viewer.cartoon('ensemble_0', structures[0], { color : bySpread });
    for (var i = 1; i < structures.length; ++i) {
      viewer.tube('ensemble_' + i, structures[i], { color : bySpread, radius : 0.12 });
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
  // pressing anywhere outside the bar closes its menus. A menu pinned open by
  // clicking its title stays open while the title has focus, and the viewer
  // prevents the default on mouse and touch down, so pressing it doesn't
  // move focus; drop it from the bar ourselves. Touch also leaves the last
  // tapped title in :hover, so the hover rule (keyed off not-click) is
  // switched off until a pointer comes back over the bar.
  var dropdowns = bar.querySelectorAll('.has-dropdown');
  document.addEventListener('pointerdown', function(event) {
    if (bar.contains(event.target)) {
      return;
    }
    var focused = document.activeElement;
    if (focused && bar.contains(focused)) {
      focused.blur();
    }
    dropdowns.forEach(function(item) {
      item.classList.remove('not-click');
    });
    if (bar.classList.contains('expanded')) {
      collapse();
    }
  }, true);
  bar.addEventListener('pointerover', function() {
    dropdowns.forEach(function(item) {
      item.classList.add('not-click');
    });
  });
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
onClick('style-licorice', useStyle(licorice));
onClick('style-surface', useStyle(surface));
onClick('style-points', useStyle(points));
onClick('style-spheres', useStyle(spheres));
onClick('color-uniform', useColor(uniform));
onClick('color-element', useColor(byElement));
onClick('color-chain', useColor(byChain));
onClick('color-entity', useColor(byEntity));
onClick('color-ss-succ', useColor(ssSuccession));
onClick('color-ss', useColor(ss));
onClick('color-rainbow', useColor(rainbow));
onClick('color-pro-red', useColor(proInRed));
// fetches and renders a structure by id in mmCIF format, used by both
// pressing Enter/blurring the input (the 'change' event) and clicking the
// "Get" button next to it. A URL loads that PDB or mmCIF file, ids starting
// "ma-" come from ModelArchive, ids starting "AF-" from the AlphaFold DB,
// all others are PDB ids fetched from RCSB.
var fetchingPdbId = null;
function getById(id) {
  id = (id || '').trim();
  // clicking Get blurs an edited input first, so 'change' has already
  // asked for the same id
  if (!id || id === fetchingPdbId) {
    return;
  }
  if (/^https?:\/\//i.test(id)) {
    getFromUrl(id);
  } else if (/^ma-/i.test(id)) {
    getFromModelArchive(id.toLowerCase());
  } else if (/^af-/i.test(id)) {
    getFromAlphaFold(id);
  } else {
    getFromRcsb(id);
  }
}

// ModelArchive's ids are lower case, e.g. ma-amun-bacp-03
function getFromModelArchive(maId) {
  fetchingPdbId = maId;
  io.fetchCif('https://modelarchive.org/doi/10.5452/' + maId + '.cif').then(function(s) {
    fetchingPdbId = null;
    if (!s || s.atomCount() === 0) {
      throw new Error('no atoms found');
    }
    assignMissingSS(s);
    structure = s;
    showStructure();
    viewer.autoZoom();
    showPdbId(maId);
  }).catch(function() {
    fetchingPdbId = null;
    showWarning('Could not load ModelArchive entry "' + maId + '"');
  });
}

// AlphaFold DB entries: AF-<UniProt accession>-F1 (e.g. AF-P69905-F1) or the
// newer numbered ones, which include heteromers (e.g. AF-0000000212009592),
// optionally with the model version, e.g. AF-0000000212009592-model-v1 (or
// -model_v1, as the files are named; classic ids look like
// AF-P24941-F1-model-v6). Without a version it is the latest. The entry's
// metadata says where the latest version's file is; the DB keeps no files
// of earlier versions, so asking for one says which version there is.
function getFromAlphaFold(afId) {
  var parts = /^(.*?)(?:-model[-_]v(\d+))?(?:\.cif)?$/i.exec(afId);
  var entry = parts[1].toUpperCase();
  var version = parts[2] === undefined ? null : parseInt(parts[2], 10);
  fetchingPdbId = afId;
  window.fetch('https://alphafold.ebi.ac.uk/api/prediction/' + entry)
    .then(function(response) {
      if (!response.ok) throw new Error('not found');
      return response.json();
    })
    .then(function(models) {
      var model = models[0];
      if (!model || !model.cifUrl) throw new Error('not found');
      if (version !== null && version !== model.latestVersion) {
        throw new Error('only version ' + model.latestVersion + ' is available');
      }
      return io.fetchCif(model.cifUrl);
    })
    .then(function(s) {
      fetchingPdbId = null;
      if (!s || s.atomCount() === 0) {
        throw new Error('no atoms found');
      }
      assignMissingSS(s);
      structure = s;
      showStructure();
      viewer.autoZoom();
      showPdbId(afId);
    })
    .catch(function(error) {
      fetchingPdbId = null;
      showWarning('Could not load AlphaFold DB entry "' + afId + '"' +
                  (/^only version/.test(error.message) ? ': ' + error.message : ''));
    });
}

function getFromRcsb(pdbId) {
  fetchingPdbId = pdbId;
  var url = 'https://files.rcsb.org/download/' + pdbId + '.cif';
  // on any failure the current structure stays on screen.
  var fail = function() {
    fetchingPdbId = null;
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
        showWarning(pdbId + ' has ' + atomCount.toLocaleString() +
                    ' atoms: loading CA/C3\' atoms only');
      }
      return io.fetchCif(url, undefined, { traceOnly : traceOnly });
    })
    .then(function(s) {
      structure = s;
      showStructure();
      viewer.autoZoom();
      fetchingPdbId = null;
      showPdbId(pdbId);
    }, fail);
}

// models (e.g. from SWISS-MODEL, AlphaFold or ModelArchive) often come
// without helix/sheet records; assign them from the CA trace so cartoons
// aren't all coil
function assignMissingSS(s) {
  var hasSS = false;
  s.eachResidue(function(residue) {
    if (residue.ss() === 'H' || residue.ss() === 'E') {
      hasSS = true;
      return false;
    }
  });
  if (!hasSS) {
    pv.mol.assignHelixSheet(s);
  }
}

// shows a structure from the text of a PDB or mmCIF file. The format comes
// from the file name (without any .gz), falling back to sniffing for
// mmCIF's leading "data_" block header; label names the file in messages.
function loadText(data, name, label) {
  var isCif = /\.(cif|mmcif)$/.test(name) ||
              (!/\.(pdb|ent)$/.test(name) && /^\s*data_/.test(data));
  var s;
  if (isCif) {
    var atomCount = (data.match(/^(ATOM|HETATM)/gm) || []).length;
    var traceOnly = atomCount > HUGE_ATOM_COUNT;
    if (traceOnly) {
      showWarning(label + ' has ' + atomCount.toLocaleString() +
                  ' atoms: loading CA/C3\' atoms only');
    }
    s = io.cif(data, { traceOnly : traceOnly });
  } else {
    s = io.pdb(data);
  }
  if (!s || s.atomCount() === 0) {
    throw new Error('no atoms found');
  }
  assignMissingSS(s);
  structure = s;
  showStructure();
  viewer.autoZoom();
}

// any URL of a PDB or mmCIF file, plain or gzipped (pv.io.fetchText unpacks
// it, see io.ts), e.g. a SWISS-MODEL model. The server has to allow
// cross-origin requests, as the PDB, the AlphaFold DB, ModelArchive and
// SWISS-MODEL do.
function getFromUrl(url) {
  fetchingPdbId = url;
  var name = (url.split(/[?#]/)[0].split('/').pop() || '').toLowerCase().replace(/\.gz$/, '');
  io.fetchText(url).then(function(data) {
    fetchingPdbId = null;
    loadText(data, name, url);
    showPdbId(url);
  }).catch(function(error) {
    fetchingPdbId = null;
    // a network error (no network, or a server without CORS headers) only
    // ever gives a generic "network error fetching ..." message
    var message = /network error/.test(error.message)
      ? 'the server could not be reached, or does not allow loading from other sites'
      : error.message;
    showWarning('Could not load "' + url + '": ' + message);
  });
}

// dropping a PDB or mmCIF file (optionally gzipped) anywhere on the page
// loads it. The format comes from the file name, falling back to sniffing
// for mmCIF's leading "data_" block header.
function loadDroppedFile(file) {
  var name = file.name.toLowerCase();
  var gzipped = /\.gz$/.test(name);
  name = name.replace(/\.gz$/, '');
  var text;
  if (gzipped) {
    var stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
    text = new Response(stream).text();
  } else {
    text = file.text();
  }
  text.then(function(data) {
    loadText(data, name, file.name);
    showFileName(file.name);
  }).catch(function(error) {
    showWarning('Could not load "' + file.name + '": ' + error.message);
  });
}

// only drags carrying files show the drop overlay; dragenter/dragleave fire
// for every child element crossed, so count them to know when the drag
// has left the window
var dragDepth = 0;
function isFileDrag(event) {
  return Array.prototype.indexOf.call(event.dataTransfer.types, 'Files') >= 0;
}
function setDropOverlay(visible) {
  document.getElementById('drop-overlay').style.display = visible ? 'flex' : 'none';
}
window.addEventListener('dragenter', function(event) {
  if (!isFileDrag(event)) return;
  dragDepth++;
  setDropOverlay(true);
});
window.addEventListener('dragleave', function(event) {
  if (!isFileDrag(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) setDropOverlay(false);
});
window.addEventListener('dragover', function(event) {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});
window.addEventListener('drop', function(event) {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  dragDepth = 0;
  setDropOverlay(false);
  var files = event.dataTransfer.files;
  if (files.length > 0) {
    loadDroppedFile(files[0]);
  }
});

// the PDB id of what's on screen goes in the input, empty when there's none
function showPdbId(pdbId) {
  document.getElementById('load-from-pdb').value = pdbId;
  droppedFileName = null;
}

// a dropped file's name goes in the input instead, as is. "Get" leaves it
// alone, since it isn't an id RCSB knows.
var droppedFileName = null;
function showFileName(name) {
  document.getElementById('load-from-pdb').value = name;
  droppedFileName = name;
}

// a Load menu entry's id is the one it shows (empty for entries without one)
function showMenuPdbId(entry) {
  var label = entry.querySelector('.pdb-id');
  showPdbId(label ? label.textContent : '');
}
document.querySelectorAll('.dropdown a').forEach(function(entry) {
  if (entry.querySelector('.pdb-id')) {
    entry.addEventListener('click', function() { showMenuPdbId(entry); });
  }
});

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

// focusing the input clears it for a new id; leaving it empty puts back the
// id of what's on screen
var pdbIdBeforeFocus = '';
document.getElementById('load-from-pdb').addEventListener('focus', function() {
  pdbIdBeforeFocus = this.value;
  this.value = '';
});
document.getElementById('load-from-pdb').addEventListener('blur', function() {
  if (!this.value) {
    this.value = pdbIdBeforeFocus;
  }
});

// PDB ids never contain whitespace, so drop any that is typed or pasted
document.getElementById('load-from-pdb').addEventListener('input', function() {
  var cleaned = this.value.replace(/\s+/g, '');
  if (cleaned !== this.value) {
    this.value = cleaned;
  }
});

document.getElementById('load-from-pdb').addEventListener('change', function() {
  var pdbId = this.value;
  this.blur();
  getById(pdbId);
});

document.getElementById('get-pdb-button').addEventListener('click', function(event) {
  event.preventDefault();
  var input = document.getElementById('load-from-pdb');
  var pdbId = input.value;
  input.blur();
  if (pdbId === droppedFileName) return;
  getById(pdbId);
});

document.getElementById('opacity-slider').addEventListener('input', function() {
  var val = parseFloat(this.value);
  document.getElementById('opacity-value').textContent = val.toFixed(2);
  applyOpacity(val);
});

viewer = pv.Viewer(document.getElementById('viewer'), {
    width : 'auto', height: 'auto', 
    fog : true,
    outline : true, 
    selectionColor : 'white',
    hoverColor: 'yellow',
    background : '#ccc', 
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

// a link to index.html#<id> (e.g. from the PDB survey's report) opens that
// entry instead of the default example
function linkedId() {
  return decodeURIComponent(window.location.hash.slice(1)).trim();
}

viewer.addListener('viewerReady', function() {
  if (linkedId()) {
    getById(linkedId());
    return;
  }
  melkInhibitor();
  showMenuPdbId(document.getElementById('4umt'));
});

window.addEventListener('hashchange', function() {
  if (linkedId()) getById(linkedId());
});

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
