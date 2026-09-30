import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { createReadStream, existsSync } from 'node:fs';

// Vite's dev server (via sirv) can't guess a MIME type for structure-fixture
// extensions like .cif and sends an empty Content-Type header. Firefox then
// tries to sniff/parse the response as XML and logs a spurious
// "XML Parsing Error: not well-formed" for these files. Serve them ourselves
// with an explicit text/plain type to avoid the sniffing.
function structureFixtureMimePlugin(): Plugin {
  const extensions = /\.(cif|pdb|sdf|crd)$/;
  return {
    name: 'pv-structure-fixture-mime',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!extensions.test(url)) return next();
        const filePath = resolve(server.config.root, '.' + url);
        if (!existsSync(filePath)) return next();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [structureFixtureMimePlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'pv',
      formats: ['es', 'cjs', 'iife'],
      fileName: (format) => {
        if (format === 'es') return 'pv.js';
        if (format === 'cjs') return 'pv.cjs';
        return 'pv.iife.js';
      },
    },
    sourcemap: true,
    minify: mode === 'debug' ? false : true,
    outDir: mode === 'debug' ? 'dist-debug' : 'dist',
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.js'],
    setupFiles: ['./src/tests/xhr-node-shim.js'],
  },
}));
