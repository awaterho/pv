const viewer = pv.Viewer(document.getElementById('viewer'), { width: 'auto', height: 400 });

// an NMR ensemble: every model, each as a smooth line in its own color
pv.io.fetchCif('https://files.rcsb.org/download/1NMR.cif', undefined, { loadAllModels: true })
  .then(function (models) {
    const gradient = pv.color.gradient('rainbow');
    models.forEach(function (model, i) {
      const rgba = gradient.colorAt([0, 0, 0, 1], i / (models.length - 1));
      viewer.sline('model.' + i, model, { color: pv.color.uniform(rgba) });
    });
    viewer.autoZoom();
  });
