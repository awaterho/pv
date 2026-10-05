// Assembles the static site published to GitHub Pages: the VitePress docs
// build (run separately, right before this script, see package.json
// "build:pages") already occupies pages-dist/ as its root, and this script
// adds the interactive demo under /demo/. It must run after the docs build,
// not before: vitepress always empties its outDir, which would otherwise
// wipe out the demo folder. It must also run after `npm run build` has
// produced dist/, since the demo page loads dist/pv.iife.js rather than
// transpiling TypeScript on the fly (which only works through the Vite dev
// server).
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, 'pages-dist');
const demoDir = resolve(outDir, 'demo');

rmSync(demoDir, { recursive: true, force: true });
mkdirSync(demoDir, { recursive: true });

// Demo page: same index.html used by `npm run dev`, but with dist/pv.iife.js
// loaded up front so demo.js's "import TypeScript source" fallback never
// triggers.
let demoHtml = readFileSync(resolve(root, 'index.html'), 'utf8');
demoHtml = demoHtml.replace(
  '<script type="module" src="./demo.js"></script>',
  '<script src="./dist/pv.iife.js"></script>\n    <script type="module" src="./demo.js"></script>',
);
writeFileSync(resolve(demoDir, 'index.html'), demoHtml);

cpSync(resolve(root, 'demo.js'), resolve(demoDir, 'demo.js'));
cpSync(resolve(root, 'favicon.ico'), resolve(demoDir, 'favicon.ico'));
cpSync(resolve(root, 'pv-icon.png'), resolve(demoDir, 'pv-icon.png'));
cpSync(resolve(root, 'dist'), resolve(demoDir, 'dist'), { recursive: true });
cpSync(resolve(root, 'structures'), resolve(demoDir, 'structures'), { recursive: true });

console.log(`Pages site assembled in ${outDir}`);
