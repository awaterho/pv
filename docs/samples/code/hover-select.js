const viewer = pv.Viewer(document.getElementById('viewer'), { width: 'auto', height: 400 });

pv.io.fetchCif('https://files.rcsb.org/download/1AKE.cif').then(function (structure) {
  const cartoon = viewer.cartoon('protein', structure);
  viewer.licorice('ligands', structure.select('ligand'));
  viewer.autoZoom();

  // the residue of a pick on one of the structure's render objects
  function residueOf(picked) {
    if (picked === null || typeof picked.node().structure !== 'function') return null;
    return picked.target().residue().full();
  }
  // that residue, as a selection of an object's own structure
  function selectionOf(obj, residue) {
    return obj.structure().residueSelect(function (r) { return r.full() === residue; });
  }

  // hover: tint the residue under the mouse and name it
  let hovered = null, hoveredResidue = null;
  viewer.on('mousemove', function (event) {
    const rect = viewer.boundingClientRect();
    const picked = viewer.pick({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    const residue = residueOf(picked);
    if (residue === hoveredResidue) return;
    if (hovered) hovered.setHover(null);
    viewer.rm('label');
    hovered = null;
    hoveredResidue = residue;
    if (residue) {
      hovered = picked.node();
      hovered.setHover(selectionOf(hovered, residue), picked.symIndex());
      viewer.label('label', residue.name() + ' ' + residue.num(),
                   pv.vec3.clone(picked.pos()), { fontSize: 14 });
    }
    viewer.requestRedraw();
  });

  // click: select the residue in the cartoon, or clear the selection
  viewer.on('click', function (picked) {
    const residue = residueOf(picked);
    cartoon.setSelection(residue ? selectionOf(cartoon, residue) : structure.createEmptyView());
    viewer.requestRedraw();
  });
});
