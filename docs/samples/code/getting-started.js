// a viewer as wide as its parent, 400 pixels high
const viewer = pv.Viewer(document.getElementById('viewer'), { width: 'auto', height: 400 });

// adenylate kinase with its inhibitor Ap5A, straight from the RCSB
pv.io.fetchCif('https://files.rcsb.org/download/1AKE.cif').then(function (structure) {
  viewer.cartoon('protein', structure);
  viewer.licorice('ligands', structure.select('ligand'));
  viewer.autoZoom();
});
