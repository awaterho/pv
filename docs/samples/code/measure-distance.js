const viewer = pv.Viewer(document.getElementById('viewer'), {
  width: 'auto', height: 400, antialias: true,
});

// click two atoms to measure the distance between them
pv.io.fetchCif('https://files.rcsb.org/download/1AKE.cif').then(function (structure) {
  viewer.ballsAndSticks('structure', structure.select({ cname: 'A' }));
  viewer.autoZoom();

  let first = null;
  viewer.on('click', function (picked) {
    // atoms only: not the background or the measuring marks
    if (picked === null || typeof picked.node().structure !== 'function') return;
    const pos = pv.vec3.clone(picked.pos());
    if (first === null) {
      viewer.rm('measure.*');
      first = pos;
      viewer.customMesh('measure.mark').addSphere(pos, 0.8, { color: 'orange' });
    } else {
      viewer.customMesh('measure.line').addTube(first, pos, 0.25, { color: 'orange' });
      const middle = pv.vec3.lerp(pv.vec3.create(), first, pos, 0.5);
      viewer.label('measure.label', pv.vec3.distance(first, pos).toFixed(2) + ' Å', middle,
                   { fontSize: 16, fontColor: '#c60' });
      first = null;
    }
    viewer.requestRedraw();
  });
});
