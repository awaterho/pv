import { defineConfig } from 'vitepress';

// Published with the demo on GitHub Pages, at <site>/pv/ (see
// scripts/build-pages.mjs), so the base is /pv/ in development too. The docs
// home page (index.md) is the site root; the demo is a separate static
// build placed under /pv/demo/ by build-pages.mjs, outside this app.
export default defineConfig({
  title: 'PV',
  description: 'Documentation of PV, a WebGL2 protein viewer',
  base: '/pv/',
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
          { text: 'pv.rings and pv.snfg', link: '/api/addons' },
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
          { text: 'NMR ensemble', link: '/samples/ensemble' },
          { text: 'Color by a custom property', link: '/samples/custom-property' },
          { text: 'Measure a distance', link: '/samples/measure-distance' },
          { text: 'Labels', link: '/samples/labels' },
          { text: 'Custom mesh', link: '/samples/custom-mesh' },
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
