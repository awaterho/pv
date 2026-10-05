const viewer = pv.Viewer(document.getElementById('viewer'), {
  width: 'auto', height: 400, antialias: true,
});

// the Kyte-Doolittle hydrophobicity of the amino acids
const HYDROPHOBICITY = {
  ILE: 4.5, VAL: 4.2, LEU: 3.8, PHE: 2.8, CYS: 2.5, MET: 1.9, ALA: 1.8,
  GLY: -0.4, THR: -0.7, SER: -0.8, TRP: -0.9, TYR: -1.3, PRO: -1.6,
  HIS: -3.2, GLU: -3.5, GLN: -3.5, ASP: -3.5, ASN: -3.5, LYS: -3.9, ARG: -4.5,
};

pv.io.fetchCif('https://files.rcsb.org/download/1AKE.cif').then(function (structure) {
  const protein = structure.select({ cname: 'A' });
  protein.eachResidue(function (residue) {
    residue.setProp('hydrophobicity', HYDROPHOBICITY[residue.name()] || 0);
  });
  // polar residues blue, hydrophobic ones orange
  const color = pv.color.byResidueProp('hydrophobicity',
      pv.color.gradient(['#2166ac', 'white', '#e08214']), [-4.5, 4.5]);
  viewer.licorice('protein', protein, { color: color });
  viewer.autoZoom();
});
