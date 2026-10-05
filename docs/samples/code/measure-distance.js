const viewer = pv.Viewer(document.getElementById('viewer'), {
  width: 'auto', height: 400, fog: true, antialias: true
});

// click two atoms to measure the distance between them
pv.io.fetchCif('https://files.rcsb.org/download/1AKE.cif').then(function (structure) {
  viewer.ballsAndSticks('structure', structure.select({ cname: 'A' }));
  viewer.autoZoom();

  // a translucent sphere around the picked atom, as its highlight. A real
  // surface() -- marching cubes over a 3D grid -- can't resolve something
  // this small without faceting (it's built for a whole pocket or protein,
  // not a single ball); a plain sphere, the same primitive the tube and the
  // old solid mark used, stays smooth at any size.
  function highlight(name, pos) {
    const mesh = viewer.customMesh(name);
    mesh.addSphere(pos, 0.6, { color: 'orange' });
    mesh.setOpacity(0.5);
  }

  let first = null;
  viewer.on('click', function (picked) {
    // atoms only: not the background or the measuring marks
    if (picked === null || typeof picked.node().structure !== 'function') return;
    const pos = pv.vec3.clone(picked.pos());
    if (first === null) {
      viewer.rm('measure.*');
      first = pos;
      highlight('measure.mark.1', pos);
    } else {
      highlight('measure.mark.2', pos);
      viewer.customMesh('measure.line').addTube(first, pos, 0.25, { color: 'orange' });
      const middle = pv.vec3.lerp(pv.vec3.create(), first, pos, 0.5);
      viewer.label('measure.label', pv.vec3.distance(first, pos).toFixed(2) + ' Å', middle,
                   { fontSize: 16, fontColor: '#c60' });
      first = null;
    }
    viewer.requestRedraw();
  });
});
