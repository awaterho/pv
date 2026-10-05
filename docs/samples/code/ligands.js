const viewer = pv.Viewer(document.getElementById('viewer'), { width: 'auto', height: 400 });

// dengue virus methyltransferase with S-adenosyl homocysteine (SAH) and
// the inhibitor ribavirin 5'-triphosphate (RVP)
pv.io.fetchCif('https://files.rcsb.org/download/1R6A.cif').then(function (structure) {
  viewer.cartoon('protein', structure, { color: pv.color.uniform('lightgrey') });
  const ligands = structure.select({ rnames: ['SAH', 'RVP'] });
  viewer.ballsAndSticks('ligands', ligands);
  // the ligands and what is around them
  viewer.fitTo(structure.selectWithin(ligands, { radius: 8 }));
});
