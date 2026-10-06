const viewer = pv.Viewer(document.getElementById('viewer'), { width: 'auto', height: 400 });

// the membrane of the porin 2POR, as SWISS-MODEL predicts it: the two
// planes bounding the hydrophobic core, their normal (axis) and the radius
// of the protein's cross-section in them
const membrane = {
  axis: [-0.0007900018244981766, -6.797679816372693e-5, 0.9999997019767761],
  width: 22.9416,
  plane_one_center: [-2.7041256427764893, -4.52432918548584, 30.987205505371094],
  plane_two_center: [-2.6859991550445557, -4.522764682769775, 8.045629501342773],
  radius: 48.8543,
  // a rotation that shows the membrane edge-on, its axis pointing up
  viewTransform: [
    0.9999997019767761, -0.0007900018244981766, 0.0, 0.0,
    -5.3714597214593596e-8, -6.799298716941848e-5, -1.0, 0.0,
    0.0007900018244981766, 0.9999997019767761, -6.799300899729133e-5, 0.0,
    0.0, 0.0, 0.0, 1.0,
  ],
};

const STYLES = [
  { label: 'Dots', style: 'dots' },
  { label: 'Flat dots', style: 'flatDots' },
  { label: 'Plane', style: 'plane' },
  { label: 'Depth color', style: null },
  { label: 'Slab', style: 'slab' },
  { label: 'Rings', style: 'rings' },
];

// a row of buttons above the viewer, one per style
const buttons = document.createElement('div');
buttons.className = 'pv-sample-buttons';
document.getElementById('viewer').before(buttons);

// the file holds one chain of the porin; its biological assembly 1 is the
// trimer in the membrane. Each chain is a barrel around a pore.
pv.io.fetchCif('https://files.rcsb.org/download/2POR.cif').then(function (structure) {
  const protein = structure.select('protein');
  // detergent molecules (C8E) where the lipids would be, and calcium ions
  const ligands = structure.select('ligand');
  // everything but the waters cuts the membrane where it crosses it
  const solid = structure.residueSelect(function (r) { return !r.isWater(); });

  function show(choice) {
    viewer.rm('protein');
    viewer.rm('membrane*');
    // depth color shows the membrane on the protein itself; the other
    // styles draw it around the protein
    const color = choice.style === null ? pv.membrane.color(membrane) : pv.color.ssSuccession();
    viewer.cartoon('protein', protein, { color: color, showRelated: '1' });
    if (choice.style !== null) {
      // the whole trimer cuts the membrane, not only the chain in the file
      pv.membrane.draw(viewer, 'membrane', solid, membrane,
                       { style: choice.style, showRelated: '1' });
    }
    buttons.querySelectorAll('button').forEach(function (button) {
      button.classList.toggle('active', button.textContent === choice.label);
    });
    viewer.requestRedraw();
  }

  STYLES.forEach(function (choice) {
    const button = document.createElement('button');
    button.textContent = choice.label;
    button.addEventListener('click', function () { show(choice); });
    buttons.appendChild(button);
  });

  viewer.ballsAndSticks('ligands', ligands, { showRelated: '1' });
  show(STYLES[0]);
  // the membrane tilted 50° from edge-on, so the planes and the pores
  // show, zoomed to the protein
  const tilt = pv.mat4.fromXRotation(pv.mat4.create(), 50 * Math.PI / 180);
  viewer.setRotation(pv.mat4.multiply(pv.mat4.create(), tilt, membrane.viewTransform));
  viewer.fitTo(viewer.get('protein'));
});
