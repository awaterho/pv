const viewer = pv.Viewer(document.getElementById('viewer'), {
  width: 'auto', height: 400, antialias: true,
});

pv.io.fetchCif('https://files.rcsb.org/download/1AKE.cif').then(function (structure) {
  const chainA = structure.select({ cname: 'A' });
  viewer.cartoon('protein', chainA);
  // the inhibitor bound to chain A, whose author chain name is A
  viewer.licorice('ligand', structure.residueSelect(function (r) {
    return r.name() === 'AP5' && r.prop('authAsymId') === 'A';
  }));
  viewer.autoZoom();
  // computed in the background; arrives when it's ready
  viewer.surface('surface', chainA.select('protein'), { color: pv.color.uniform('lightblue') })
    .then(function (surface) {
      if (surface === null) return;
      surface.setOpacity(0.5);
      viewer.requestRedraw();
    });
});
