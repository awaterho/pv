const viewer = pv.Viewer(document.getElementById('viewer'), {
  width: 'auto', height: 400, antialias: true,
});

// Pariacoto virus: one copy of the coat protein and its RNA in the file,
// 60 copies in biological assembly 1
pv.io.fetchCif('https://files.rcsb.org/download/1F8V.cif').then(function (structure) {
  viewer.cartoon('capsid', structure, { color: pv.color.byChain(), showRelated: '1' });
  viewer.autoZoom();
});
