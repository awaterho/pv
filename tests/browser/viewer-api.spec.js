import { test, expect } from '@playwright/test';

// Viewer API calls that used to throw or do nothing, each run in the page
// against a real WebGL context.
async function run(page, fn) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/tests/browser/harness.html');
  const result = await page.evaluate(fn);
  // let a frame or two be drawn with the changed state
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(errors, errors.join('\n')).toEqual([]);
  return result;
}

function newViewer(options) {
  return `(await import('/src/viewer.ts')).default.Viewer(document.getElementById('viewer'),
          Object.assign({ width: 300, height: 300 }, ${JSON.stringify(options || {})}))`;
}

test('fitTo centers on a render object', async ({ page }) => {
  const center = await run(page, new Function(`return (async () => {
    const viewer = ${newViewer()};
    const mesh = viewer.customMesh('mesh');
    mesh.addSphere([40, 50, 60], 2);
    viewer.fitTo(mesh);
    return Array.from(viewer.center());
  })()`));
  center.forEach((v, i) => expect(v).toBeCloseTo([40, 50, 60][i], 0));
});

test('outlineColor can be changed after creation', async ({ page }) => {
  const value = await run(page, new Function(`return (async () => {
    const viewer = ${newViewer()};
    viewer.options('outlineColor', 'red');
    return viewer.options('outlineColor');
  })()`));
  expect(value).toBe('red');
});

test('doubleClick: null turns the default centering off', async ({ page }) => {
  const counts = await run(page, new Function(`return (async () => {
    const off = ${newViewer({ doubleClick: null })};
    const on = ${newViewer()};
    const count = (v) => (v.listenerMap.doubleClick || []).length;
    return [count(off), count(on)];
  })()`));
  expect(counts).toEqual([0, 1]);
});

test('slab modes can be set through options and autoSlab', async ({ page }) => {
  await run(page, new Function(`return (async () => {
    const viewer = ${newViewer()};
    viewer.customMesh('mesh').addSphere([0, 0, 0], 2);
    viewer.options('slabMode', 'fixed');
    viewer.autoSlab();
    viewer.slabMode('auto');
    viewer.autoSlab();
    viewer.requestRedraw();
  })()`));
});

test('tube leaves the options it is given alone', async ({ page }) => {
  const options = await run(page, new Function(`return (async () => {
    const viewer = ${newViewer()};
    const io = (await import('/src/io.ts')).default;
    const structure = await io.fetchPdb('/tests/data/1r6a.pdb');
    const options = { radius: 0.5 };
    viewer.tube('tube', structure, options);
    return options;
  })()`));
  expect(options).toEqual({ radius: 0.5 });
});

test('the end caps of custom-mesh tubes can be picked', async ({ page }) => {
  const picked = await run(page, new Function(`return (async () => {
    const viewer = ${newViewer()};
    // a tube along the view direction, so only its cap faces the camera
    viewer.customMesh('mesh').addTube([0, 0, -5], [0, 0, 5], 3, { userData: 'tube' });
    viewer.setCamera([1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 0], 40);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const hit = viewer.pick({ x: 150, y: 150 });
    return hit === null ? null : hit.target();
  })()`));
  expect(picked).toBe('tube');
});
