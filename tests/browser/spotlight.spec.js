import { test, expect } from '@playwright/test';

// Viewer.spotlight(): the shader fade of shaders.ts's SPOTLIGHT, the spheres
// of spotlight.ts and the transparent-pass gating in BaseGeom/CustomMesh.draw().
async function setUp(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/tests/browser/harness.html');
  return errors;
}

// two red spheres 20 A apart, at canvas x 60 and 140 (y 100), and a blue one
// in a mesh of its own over the right one, further back
async function renderBalls(page, spotlight) {
  await page.evaluate(async (spotlight) => {
    const pv = (await import('/src/index.ts')).default;
    const viewer = pv.Viewer(document.getElementById('viewer'), {
      width: 200, height: 200, background: '#fff', outline: false, fog: false,
      antialias: false, ssao: false,
    });
    window.__viewer = viewer;
    const balls = viewer.customMesh('balls');
    balls.addSphere([-10, 0, 0], 4, { color: [1, 0, 0, 1] });
    balls.addSphere([10, 0, 0], 4, { color: [1, 0, 0, 1] });
    viewer.customMesh('other').addSphere([10, 10, -5], 3, { color: [0, 0, 1, 1] });
    viewer.setCenter([0, 0, 0]);
    viewer.setZoom(60);
    if (spotlight) {
      viewer.spotlight([-10, 0, 0], { radius: 5, falloff: 1, opacity: 0.2,
                                      objects: 'balls' });
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }, spotlight);
}

async function pixel(page, x, y) {
  return page.evaluate(([x, y]) => {
    const gl = window.__viewer.gl();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const pixels = new Uint8Array(4);
    // readPixels counts rows from the bottom
    gl.readPixels(x, 200 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return Array.from(pixels);
  }, [x, y]);
}

const isOpaqueRed = (p) => p[0] > 100 && p[1] < 60 && p[2] < 60;
const isFadedRed = (p) => p[0] > 200 && p[1] > 150 && p[1] < 245;

test('fades what is outside the spotlight, keeps what is inside', async ({ page }) => {
  const errors = await setUp(page);
  await renderBalls(page, true);
  const inside = await pixel(page, 60, 100);
  const outside = await pixel(page, 140, 100);
  expect(errors).toEqual([]);
  expect(isOpaqueRed(inside), String(inside)).toBe(true);
  expect(isFadedRed(outside), String(outside)).toBe(true);
});

test('leaves objects not matching objects alone', async ({ page }) => {
  const errors = await setUp(page);
  await renderBalls(page, true);
  // the top of the blue sphere, clear of the red one below it
  const blue = await pixel(page, 140, 66);
  expect(errors).toEqual([]);
  expect(blue[2] > 100 && blue[0] < 60, String(blue)).toBe(true);
});

test('spotlight(null) turns it off', async ({ page }) => {
  const errors = await setUp(page);
  await renderBalls(page, true);
  await page.evaluate(async () => {
    window.__viewer.spotlight(null);
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  const outside = await pixel(page, 140, 100);
  expect(errors).toEqual([]);
  expect(isOpaqueRed(outside), String(outside)).toBe(true);
});

test('compiles for every render style, with outlines', async ({ page }) => {
  const errors = await setUp(page);
  await page.evaluate(async () => {
    const pv = (await import('/src/index.ts')).default;
    const viewer = pv.Viewer(document.getElementById('viewer'), {
      width: 200, height: 200, outline: true,
    });
    const structure = await pv.io.fetchCif('/structures/1ake.cif.gz');
    viewer.cartoon('cartoon', structure);
    viewer.lines('lines', structure);
    viewer.ballsAndSticks('bs', structure.select({ rnumRange: [1, 20] }));
    viewer.spheres('spheres', structure.select({ rnumRange: [30, 40] }));
    viewer.licorice('licorice', structure.select({ rnumRange: [50, 60] }));
    viewer.trace('trace', structure);
    viewer.spotlight(structure.select({ rnumRange: [10, 14] }));
    viewer.autoZoom(0);
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  expect(errors).toEqual([]);
});
