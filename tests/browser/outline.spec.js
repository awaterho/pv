import { test, expect } from '@playwright/test';

// A single grey sphere on a white background with a red outline, sampled
// along its middle row. Grey geometry and a red outline keep the two
// separable: a pixel is "outline" only if its red channel stands clearly
// above the other two.
async function middleRow(page, opacity, outline = true) {
  await page.goto('/tests/browser/harness.html');
  return page.evaluate(async ({ opacity, outline }) => {
    const pv = await import('/src/viewer.ts');
    const viewer = pv.default.Viewer(document.getElementById('viewer'), {
      width: 200, height: 200, background: '#fff', outline: true,
      outlineColor: 'red', outlineWidth: 4, fog: false,
      antialias: false, ssao: false,
    });
    const mesh = viewer.customMesh('s');
    mesh.addSphere([0, 0, 0], 8, { color: [0.5, 0.5, 0.5, opacity] });
    mesh.outline(outline);
    viewer.setZoom(40);
    viewer.setCenter([0, 0, 0]);
    await new Promise((r) => setTimeout(r, 300));
    const gl = viewer.gl();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const px = new Uint8Array(200 * 4);
    gl.readPixels(0, 100, 200, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const row = [];
    for (let i = 0; i < 200; ++i) {
      row.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
    }
    return row;
  }, { opacity, outline });
}

const outlineColumns = (row) =>
  row.filter(([r, g, b]) => r - Math.max(g, b) > 30).length;

// Regression test for the outline disappearing as soon as opacity dropped
// below 1: the outline pass runs inside the opaque pass, where PRELUDE_FS's
// opaqueOnly gate discards every non-opaque fragment, so translucent
// geometry lost its outline entirely. See Viewer._drawTransparentOutline().
test('translucent geometry keeps its outline', async ({ page }) => {
  const opaque = outlineColumns(await middleRow(page, 1.0));
  const translucent = outlineColumns(await middleRow(page, 0.5));
  // sanity check: the opaque case must actually have an outline to compare
  // against, otherwise the assertion below passes trivially
  expect(opaque).toBeGreaterThan(0);
  expect(translucent).toEqual(opaque);
});

// The outline is expanded backface geometry covering the object's whole
// silhouette, not just its rim, and OIT accumulation has no occlusion of
// its own. Without the depth prepass in Viewer._drawTransparentOutline()
// the outline colour washes over the entire object instead of rimming it.
test('a translucent outline does not wash over the object', async ({ page }) => {
  const row = await middleRow(page, 0.5);
  const [r, g, b] = row[100];
  expect(r - Math.max(g, b)).toBeLessThanOrEqual(2);
  // sanity check: the sample must be on the object, not on the background
  expect(r).toBeLessThan(250);
});

// SceneNode.outline(false) takes a node out of both outline passes, so the
// viewer's outline and outlineWidth leave it alone -- what the membrane
// add-on's planes, slab and rings want, being scenery rather than
// structure.
test('a node with outline(false) gets none, opaque or translucent', async ({ page }) => {
  for (const opacity of [1.0, 0.5]) {
    expect(outlineColumns(await middleRow(page, opacity, true))).toBeGreaterThan(0);
    expect(outlineColumns(await middleRow(page, opacity, false))).toEqual(0);
  }
});
