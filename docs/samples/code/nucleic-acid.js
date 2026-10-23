const viewer = pv.Viewer(document.getElementById('viewer'), { width: 'auto', height: 400 });

// yeast tRNA-Phe: the backbone as a tube, the bases as filled rings
pv.io.fetchCif('../structures/1ehz.cif.gz').then(function (structure) {
  viewer.cartoon('trna', structure, { color: pv.color.uniform('lightgrey'), baseSticks: false });
  pv.rings.drawBases(viewer, 'bases', structure, { sticks: true });
  viewer.autoZoom();
});
