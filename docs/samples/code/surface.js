const viewer = pv.Viewer(document.getElementById('viewer'), { width: 'auto', height: 400 });

Promise.all([
  pv.io.fetchCif('https://files.rcsb.org/download/1AKE.cif'),
  // the inhibitor's pocket, found by a cavity finder (KVFinder) as a set of
  // points filling the empty space
  pv.io.fetchPdb('data/1ake-pocket.pdb'),
]).then(function ([structure, cavity]) {
  const protein = structure.select({ cname: 'A' }).select('protein');
  // the inhibitor bound to chain A, whose author chain name is A
  const ligand = structure.residueSelect(function (r) {
    return r.name() === 'AP5' && r.prop('authAsymId') === 'A';
  });
  viewer.licorice('ligand', ligand);
  viewer.fitTo(protein.selectWithin(ligand, { radius: 8 }));
  // the cavity finder writes its points as hydrogens, which surfaces leave
  // out: copy them into a structure of their own, as carbons
  const pocket = new pv.mol.Mol();
  const points = pocket.addChain('P').addResidue('POC', 1);
  cavity.eachAtom(function (atom) { points.addAtom('C', atom.pos(), 'C'); });
  // surfaces are computed in the background, and arrive when they're ready
  viewer.surface('protein', protein, { color: pv.color.uniform('lightgrey') })
    .then(function (surface) {
      if (surface === null) return;
      surface.setOpacity(0.2);
      viewer.requestRedraw();
    });
  // a radius of 1.7 - 1 Å per point, about the spacing of the points: the
  // surface wraps the space they fill
  viewer.surface('pocket', pocket, {
    color: pv.color.uniform('#f39c12'), radiusOffset: -1,
  }).then(function (surface) {
    if (surface === null) return;
    surface.setOpacity(0.6);
    viewer.requestRedraw();
  });
});
