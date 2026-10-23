const viewer = pv.Viewer(document.getElementById('viewer'), { width: 'auto', height: 400 });

// Pariacoto virus: one copy of the coat protein and its RNA in the file,
// 60 copies in biological assembly 1
pv.io.fetchCif('../structures/1f8v.cif.gz').then(function (structure) {
  viewer.cartoon('capsid', structure, { color: pv.color.byChain(), showRelated: '1' });
  viewer.autoZoom();
});
