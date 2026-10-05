const viewer = pv.Viewer(document.getElementById('viewer'), {
  width: 'auto', height: 400, antialias: true,
});

// the bounding box of a protein, with clickable corners and a
// half-transparent plane through its middle
pv.io.fetchCif('https://files.rcsb.org/download/1AKE.cif').then(function (structure) {
  const protein = structure.select({ cname: 'A' });
  viewer.cartoon('protein', protein, { color: pv.color.uniform('lightgrey') });

  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  protein.eachAtom(function (atom) {
    pv.vec3.min(min, min, atom.pos());
    pv.vec3.max(max, max, atom.pos());
  });
  // corner i of the box: bit 1 picks max x, bit 2 max y, bit 4 max z
  function corner(i) {
    return [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]];
  }

  const box = viewer.customMesh('box');
  for (let i = 0; i < 8; ++i) {
    box.addSphere(corner(i), 1, { color: 'orange', userData: i });
    [1, 2, 4].forEach(function (bit) {
      if (!(i & bit)) box.addTube(corner(i), corner(i | bit), 0.2, { color: 'grey' });
    });
  }
  // two triangles make the plane; the color's alpha makes it transparent
  const z = (min[2] + max[2]) / 2;
  viewer.customMesh('plane').addTriangles([
    min[0], min[1], z, max[0], min[1], z, max[0], max[1], z,
    min[0], min[1], z, max[0], max[1], z, min[0], max[1], z,
  ], { color: [0.3, 0.5, 0.9, 0.4] });

  // clicking a corner selects it
  viewer.on('click', function (picked) {
    const index = picked !== null && picked.node() === box ? picked.target() : null;
    box.setSelection(index === null ? null : function (data) { return data === index; });
    viewer.requestRedraw();
  });
  viewer.autoZoom();
});
