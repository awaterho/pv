const viewer = pv.Viewer(document.getElementById('viewer'), {
  width: 'auto', height: 400, antialias: true,
});

pv.io.fetchCif('https://files.rcsb.org/download/1AKE.cif').then(function (structure) {
  viewer.cartoon('protein', structure, { color: pv.color.byChain() });
  // label the two ends of each protein chain, which are on the outside
  structure.select('polymer').eachChain(function (chain) {
    const residues = chain.residues();
    const first = residues[0], last = residues[residues.length - 1];
    viewer.label('label.' + chain.name() + '.N', chain.name() + ': N ' + first.num(),
                 first.centralAtom().pos(), { fontSize: 14, fontStyle: 'bold', fontColor: '#333' });
    viewer.label('label.' + chain.name() + '.C', chain.name() + ': C ' + last.num(),
                 last.centralAtom().pos(),
                 { fontSize: 14, fontColor: '#fff', fillStyle: '#444', backgroundAlpha: 0.8 });
  });
  viewer.autoZoom();
});
