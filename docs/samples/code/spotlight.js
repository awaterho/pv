const viewer = pv.Viewer(document.getElementById('viewer'), { width: 'auto', height: 400 });

// haemoglobin's four hemes sit in pockets far apart in the tetramer, one
// per chain: one spotlight can light them all, or a single one
const VIEWS = [
  { label: 'Four hemes', one: false, radius: 5, falloff: 4 },
  { label: 'One heme', one: true, radius: 5, falloff: 4 },
  { label: 'One heme, wide', one: true, radius: 12, falloff: 8 },
  { label: 'No spotlight', off: true },
];

// a row of buttons above the viewer, one per view
const buttons = document.createElement('div');
buttons.className = 'pv-sample-buttons';
document.getElementById('viewer').before(buttons);

pv.io.fetchCif('../structures/4hhb.cif.gz').then(function (structure) {
  const protein = structure.select('protein');
  const hemes = structure.select({ rname: 'HEM' });
  // the heme of the first alpha chain. In mmCIF files the ligands sit in
  // chains of their own, so this goes by the author chain name
  const hemeA = structure.residueSelect(function (r) {
    return r.name() === 'HEM' && r.prop('authAsymId') === 'A';
  });

  viewer.cartoon('protein', protein, { color: pv.color.byChain() });
  viewer.ballsAndSticks('hemes', hemes);
  // the residues lining the pockets, the proximal histidines among them
  viewer.licorice('pocket', protein.selectWithin(hemes, { radius: 4.5, matchResidues: true }));
  viewer.autoZoom();

  function show(view) {
    if (view.off) {
      viewer.spotlight(null);
    } else {
      // everything drawn fades together, from the distance of each point
      // to the nearest heme atom
      viewer.spotlight(view.one ? hemeA : hemes,
                       { radius: view.radius, falloff: view.falloff, opacity: 0.15 });
    }
    buttons.querySelectorAll('button').forEach(function (button) {
      button.classList.toggle('active', button.textContent === view.label);
    });
  }

  VIEWS.forEach(function (view) {
    const button = document.createElement('button');
    button.textContent = view.label;
    button.addEventListener('click', function () { show(view); });
    buttons.appendChild(button);
  });
  show(VIEWS[0]);
});
