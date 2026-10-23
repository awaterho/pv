import { defineConfig } from 'vitepress';
import { cpSync, createReadStream, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// structures/ in the repository root, the structure files the samples load.
// They are the same files the demo and the tests use, stored gzipped (pv.io
// unpacks them itself), so no sample depends on a download from the RCSB.
const structuresDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../structures');

// VitePress serves docs/public and nothing else, so structures/ is served
// from here in development. The built site gets its copy in buildEnd below.
function structuresPlugin() {
  return {
    name: 'pv-structures',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        const match = /^(?:\/pv)?\/structures\/([A-Za-z0-9_-]+\.(?:cif|pdb|sdf|crd)\.gz)$/.exec(path);
        const file = match && resolve(structuresDir, match[1]);
        if (!file || !existsSync(file)) {
          return next();
        }
        res.setHeader('Content-Type', 'application/gzip');
        createReadStream(file).pipe(res);
      });
    },
  };
}

// Published with the demo on GitHub Pages, at <site>/pv/ (see
// scripts/build-pages.mjs), so the base is /pv/ in development too. The docs
// home page (index.md) is the site root; the demo is a separate static
// build placed under /pv/demo/ by build-pages.mjs, outside this app.
export default defineConfig({
  title: 'PV',
  description: 'Documentation of PV, a WebGL2 protein viewer',
  base: '/pv/',
  vite: { plugins: [structuresPlugin()] },
  // the structure files the samples load, next to the pages in the built site
  buildEnd(siteConfig) {
    cpSync(structuresDir, resolve(siteConfig.outDir, 'structures'), { recursive: true });
  },
  outDir: '../pages-dist',
  cleanUrls: false,
  lastUpdated: false,
  head: [['link', { rel: 'icon', href: '/pv/pv-icon.png' }]],
  themeConfig: {
    logo: '/pv-icon.png',
    siteTitle: false,
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/viewer' },
      { text: 'Samples', link: '/samples/' },
      { text: 'Demo', link: 'https://awaterho.github.io/pv/demo/', target: '_self', noIcon: true },

    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Loading structures', link: '/guide/loading' },
          { text: 'Render styles', link: '/guide/render-styles' },
          { text: 'Coloring', link: '/guide/coloring' },
          { text: 'Selections', link: '/guide/selections' },
          { text: 'Picking, hover and selection', link: '/guide/interaction' },
          { text: 'Camera', link: '/guide/camera' },
          { text: 'Transparency and effects', link: '/guide/effects' },
          { text: 'Biological assemblies', link: '/guide/assemblies' },
          { text: 'Glycans and nucleic acids', link: '/guide/glycans-nucleic-acids' },
          { text: 'Surfaces', link: '/guide/surfaces' },
          { text: 'Custom meshes and labels', link: '/guide/custom-meshes' },
          { text: 'Large structures', link: '/guide/large-structures' },
          { text: 'Migrating from PV 1.x', link: '/guide/migrating' },
        ],
      },
      {
        text: 'API reference',
        items: [
          { text: 'pv.Viewer', link: '/api/viewer' },
          { text: 'Render objects', link: '/api/render-objects' },
          { text: 'pv.io', link: '/api/io' },
          { text: 'Molecules', link: '/api/mol' },
          { text: 'Selections', link: '/api/select' },
          { text: 'pv.color', link: '/api/color' },
          { text: 'Add-ons', link: '/api/addons' },
        ],
      },
      {
        text: 'Samples',
        link: '/samples/',
        items: [
          { text: 'Protein with ligands', link: '/samples/ligands' },
          { text: 'Hover and select', link: '/samples/hover-select' },
          { text: 'Glycoprotein', link: '/samples/glycoprotein' },
          { text: 'Nucleic acid', link: '/samples/nucleic-acid' },
          { text: 'Biological assembly', link: '/samples/assembly' },
          { text: 'Surface', link: '/samples/surface' },
          { text: 'Spotlight', link: '/samples/spotlight' },
          { text: 'NMR ensemble', link: '/samples/ensemble' },
          { text: 'Color by a custom property', link: '/samples/custom-property' },
          { text: 'Measure a distance', link: '/samples/measure-distance' },
          { text: 'Labels', link: '/samples/labels' },
          { text: 'Custom mesh', link: '/samples/custom-mesh' },
          { text: 'Membrane', link: '/samples/membrane' },
        ],
      },
      {
        text: 'Contributing',
        items: [{ text: 'Development', link: '/development' }],
      },
    ],
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/awaterho/pv' }],
    footer: {
      message: 'Released under the MIT license.',
      copyright: 'PV was created by Marco Biasini; this fork is maintained by Andrew Waterhouse.',
    },
  },
});
