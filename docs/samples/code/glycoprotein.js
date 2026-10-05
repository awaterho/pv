const viewer = pv.Viewer(document.getElementById('viewer'), { width: 'auto', height: 400 });

// the Fc of human IgG1 with its two N-glycans
pv.io.fetchCif('https://files.rcsb.org/download/4BYH.cif').then(function (structure) {
  viewer.cartoon('protein', structure, { color: pv.color.uniform('lightgrey') });
  viewer.licorice('glycans', structure.select('carbohydrate'), { color: pv.snfg.color() });
  pv.snfg.draw(viewer, 'symbols', structure);
  viewer.fitTo(structure.select('carbohydrate'));
});
