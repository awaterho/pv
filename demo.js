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
// structure defines one, e.g. entries fetched from RCSB, and just the
// asymmetric unit otherwise. The local fixtures carry no assembly records.
function related() {
  return structure.assembly('1') ? '1' : 'asym';
}

// opacity slider (in #display-widget): applies to every currently-visible
// render object that supports it, and is re-applied by preset() whenever a
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
      color : color.ssSuccession(), showRelated : related(),
  });
  var rotation = viewpoint.principalAxes(go);
  addLigands();
  //go.setSelection(go.select({rtype : 'C' }));
  viewer.setRotation(rotation)
}

function lineTrace() {
  viewer.clear();
  addLigands();
  viewer.lineTrace('structure', structure, { showRelated : related() });
}

function spheres() {
  viewer.clear();
  addLigands();
  viewer.spheres('structure', structure, { showRelated : related() });
}

function sline() {
  viewer.clear();
  addLigands();
  viewer.sline('structure', structure,
      { color : color.uniform('red'), showRelated : related() });
}

function tube() {
  viewer.clear();
  addLigands();
  viewer.tube('structure', structure, { showRelated : related() });
  viewer.lines('structure.ca', structure.select({aname :'CA'}),
            { color: color.uniform('blue'), lineWidth : 1,
              showRelated : related() });
}

function trace() {
  viewer.clear();
  addLigands();
  viewer.trace('structure', structure, { showRelated : related() });

}
function ballsAndSticks() {
  viewer.clear();
  addLigands();
  viewer.ballsAndSticks('structure', structure, { showRelated : related() });
}

function surface() {
  viewer.clear();
  addLigands();
  viewer.surface('structure', structure.select('protein'), {
    color: color.ssSuccession()
  }).then(function(go) {
    if (go) {
      go.setOpacity(currentOpacity);
    }
  });
}

function preset() {
  viewer.clear();
  viewer.cartoon('structure.protein', structure);
  addLigands();
  applyOpacity(currentOpacity);
}

function addLigands() {
  const ligand = structure.select('ligand');
  viewer.ballsAndSticks('structure.ligand', ligand);
}

// loads a structure from its local mmCIF fixture (pdbs/<id>.cif).
function load(cif_id) {
  document.getElementById('traj-widget').style.display = 'none';
  io.fetchCif('pdbs/'+cif_id+'.cif', function(s) {
    structure = s;
    preset();
    viewer.autoZoom();
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
  pv.io.fetchCrd('pdbs/trj.crd', function(s) {
    structure = s;
    viewer.ballsAndSticks('trajectory', structure);
    viewer.autoZoom();
    pv.traj.fetchDcd('pdbs/trj.dcd', s, function(cg) {
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

function crambin() {
  load('1crn');
}

function transferase() {
  load('1r6a');
}

function telethonin() { load('2f8v'); }

function porin() {
  load('2por');
}

// MELK kinase bound to a small-molecule inhibitor (ligand 47W) whose
// bond orders come straight from the mmCIF chem_comp_bond table: an
// alkyne (triple bond), plus the aromatic isoquinoline and benzyl rings.
function melkInhibitor() {
  load('4umt');
}

// AlphaFold DB model AF-A0A4Y8AT86-F1 (UniProt A0A4Y8AT86, a "4-fold beta
// flower domain-containing protein" from Gramella jeungdoensis): four
// beta-hairpins radiating out of a small helical hub, forming a flower-like
// rosette in cartoon view. AlphaFold's own mmCIF already carries DSSP-derived
// secondary structure in _struct_conf (including the beta strands, tagged
// conf_type_id 'STRN'), but pv only reads strands from the separate
// _struct_sheet_range category the way RCSB depositions lay it out -- so the
// local fixture (pdbs/a0a4y8at86.cif) adds a _struct_sheet_range loop built
// from those same STRN rows. Without it every strand falls back to a plain
// coil tube and the "flower" is invisible.
function betaFlower() {
  document.getElementById('traj-widget').style.display = 'none';
  io.fetchCif('pdbs/a0a4y8at86.cif', function(s) {
    structure = s;
    viewer.clear();
    var go = viewer.cartoon('structure.protein', structure, {
        color : color.ssSuccession(),
    });
    addLigands();
    applyOpacity(currentOpacity);
    // orient along the principal axes so the propeller's flattest axis
    // faces the camera, showing the radiating hairpins face-on instead of
    // edge-on -- AlphaFold models have no canonical orientation to fall
    // back on the way a crystal structure's deposited frame might.
    viewer.setRotation(viewpoint.principalAxes(go));
    viewer.autoZoom();
  });
}

function ssSuccession() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand')
      go.colorBy(color.ssSuccession());
  });
  viewer.requestRedraw();
}

function uniform() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand')
      go.colorBy(color.uniform([0,1,0]));
  });
  viewer.requestRedraw();
}
function byElement() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand')
      go.colorBy(color.byElement());
  });
  viewer.requestRedraw();
}

function ss() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand')
      go.colorBy(color.bySS());
  });
  viewer.requestRedraw();
}

function proInRed() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand')
      go.colorBy(color.uniform('red'), go.select({rname : 'PRO'}));
  });
  viewer.requestRedraw();
}
function rainbow() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand')
      go.colorBy(color.rainbow());
  });
  viewer.requestRedraw();
}

function byChain() {
  viewer.forEach(function(go) {
    if(go.name()!=='structure.ligand')
      go.colorBy(color.byChain());
  });
  viewer.requestRedraw();
}

function polymerase() {
  load('4UBB');
};


// exercises every shape the customMesh API can draw -- addSphere and
// addTube -- none of it derived from a molecular structure. This is the
// escape hatch for drawing arbitrary annotated geometry (markers,
// measurement lines, axes, ...) alongside whatever else is in the scene.
function customMeshDemo() {
  viewer.clear();
  var go = viewer.customMesh('custom');

  var posX = [10, 0, 0], negX = [-10, 0, 0];
  var posY = [0, 10, 0], negY = [0, -10, 0];
  var posZ = [0, 0, 10], negZ = [0, 0, -10];

  // addSphere: a ball at each axis endpoint, colored and tagged with
  // userData so picking one of them identifies which.
  go.addSphere(posX, 2, { color : 'red', userData : 'x+' });
  go.addSphere(negX, 2, { color : 'red', userData : 'x-' });
  go.addSphere(posY, 2, { color : 'green', userData : 'y+' });
  go.addSphere(negY, 2, { color : 'green', userData : 'y-' });
  go.addSphere(posZ, 2, { color : 'blue', userData : 'z+' });
  go.addSphere(negZ, 2, { color : 'blue', userData : 'z-' });

  // addTube: a rod connecting each pair of spheres through the origin. The
  // X axis tube is left open (cap: false) to show that option too; Y and Z
  // use the default capped ends.
  go.addTube(negX, posX, 0.75, { color : 'red', cap : false, userData : 'x-axis' });
  go.addTube(negY, posY, 0.75, { color : 'green', userData : 'y-axis' });
  go.addTube(negZ, posZ, 0.75, { color : 'blue', userData : 'z-axis' });

  viewer.setCenter([0, 0, 0]);
  viewer.setZoom(20);
}

function ensemble() {
  document.getElementById('traj-widget').style.display = 'none';
  io.fetchCif('pdbs/1nmr.cif', function(structures) {
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
onClick('1r6a', transferase);
onClick('1crn', crambin);
onClick('1ake', kinase);
onClick('4ubb', polymerase);
onClick('4umt', melkInhibitor);
onClick('beta-flower', betaFlower);
onClick('2f8v', telethonin);
onClick('2por', porin);
onClick('ensemble', ensemble);
onClick('custom-mesh', customMeshDemo);
onClick('style-cartoon', cartoon);
onClick('style-tube', tube);
onClick('style-line-trace', lineTrace);
onClick('style-sline', sline);
onClick('style-trace', trace);
onClick('style-lines', lines);
onClick('style-balls-and-sticks', ballsAndSticks);
onClick('style-surface', surface);
onClick('style-points', points);
onClick('style-spheres', spheres);
onClick('color-uniform', uniform);
onClick('color-element', byElement);
onClick('color-chain', byChain);
onClick('color-ss-succ', ssSuccession);
onClick('color-ss', ss);
onClick('trajectory', trajectory);
onClick('color-rainbow', rainbow);
onClick('color-pro-red', proInRed);
// fetches and renders a structure by PDB id from RCSB in mmCIF format, used
// by both pressing Enter/blurring the input (the 'change' event) and
// clicking the "Get" button next to it.
function getFromRcsb(pdbId) {
  if (!pdbId) {
    return;
  }
  var url = 'https://files.rcsb.org/download/' + pdbId + '.cif';
  io.fetchCif(url, function(s) {
    structure = s;
    cartoon();
    viewer.autoZoom();
  });
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
    quality : 'high',
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
  fog.checked = viewer.options('fog');
  outline.checked = viewer.options('outline');
  spin.checked = viewer.spin();
  rock.checked = viewer.rockAndRoll();
  background.value = 1 - viewer.options('background')[0];
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
}
initDisplayControls();

viewer.addListener('viewerReady', transferase);

// A single click only selects; double-click moves the camera, onto the
// residue and its surroundings, or out to the whole structure.
viewer.on('doubleClick', function(picked) {
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
  viewer.fitTo(full.selectWithin(target.residue(), { radius: 8 }));
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
let hovered = null;           // { node, residue } under the mouse
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

function setHovered(node, residue) {
  if (hovered !== null) hovered.node.setHover(null);
  hovered = node !== null ? { node, residue } : null;
  if (node !== null) node.setHover(residueView(node, [residue]));
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
}

// The amino acids from one residue to another in chain order, so insertion
// codes and gaps in the numbering don't matter.
function residueRange(from, to) {
  const residues = from.chain().residues();
  const a = residues.indexOf(from), b = residues.indexOf(to);
  return residues.slice(Math.min(a, b), Math.max(a, b) + 1)
                 .filter((r) => r.isAminoacid());
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

function highlightAtom(picked, atom, event) {
  setHovered(picked.node(), atom.residue());

  const { strucId, chain, resno, insCode } = residueInfo(picked, atom);
  setStatus(`${atom.residue().name()} ${resno}${insCode} ${chain}` +
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
  const node = picked.node(), residue = atom.residue();
  if (!residue.isAminoacid()) return;
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

function doPVMouse(event) {
  if (isDragging()) return;

  const fastClick = event.type === 'click' && isFastClick(event);
  const rect = viewer.boundingClientRect();
  const picked = viewer.pick({ x: event.clientX - rect.left,
                                  y: event.clientY - rect.top });
  const atom = picked !== null ? picked.target() : null;

  // Still over the highlighted residue: nothing changes unless it's clicked.
  if (atom !== null && hovered !== null && hovered.node === picked.node() &&
      atom.residue() === hovered.residue) {
    if (fastClick) selectResidue(picked, atom, event);
    viewer.requestRedraw();
    return;
  }

  setHovered(null);

  if (atom === null) {
    setStatus('');
  } else {
    const res = atom.residue();
    const isPolymer = res.chain().name()[0] !== '_' &&
                      (res.isAminoacid() || res.isNucleotide());
    if (isPolymer) {
      highlightAtom(picked, atom, event);
    } else {
      setHovered(picked.node(), res);
      setStatus(`${res.name()} ${res.num()}`);
    }
  }
  viewer.requestRedraw();
}

document.body.addEventListener('mousemove',
  (e) => e.target.matches('#viewer canvas') ? doPVMouse(e) : null, true);
document.body.addEventListener('click',
  (e) => e.target.matches('#viewer canvas') ? doPVMouse(e) : null, true);
