import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        XMLHttpRequest: 'readonly',
        requestAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Image: 'readonly',
        CustomEvent: 'readonly',
        WebGL2RenderingContext: 'readonly',
        DecompressionStream: 'readonly',
        Response: 'readonly',
        Blob: 'readonly',
        TextDecoder: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
  {
    // the docs' samples run in the page, with PV loaded as the global pv
    files: ['docs/samples/code/**'],
    languageOptions: { globals: { pv: 'readonly' } },
  },
  {
    // the Node scripts (pages build, PDB survey)
    files: ['scripts/**'],
    languageOptions: {
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
        performance: 'readonly',
      },
    },
  },
  {
    // *.test.js and tests/browser/fixtures/** are mechanically-ported QUnit
    // test bodies (kept byte-for-byte identical to the originals apart from
    // the module wrapper); their pre-existing quality issues are left for a
    // later pass rather than papered over here.
    ignores: [
      'dist/**',
      'dist-debug/**',
      'pages-dist/**',
      'docs/.vitepress/cache/**',
      'node_modules/**',
      'snippets/**',
      'src/tests/**/*.test.js',
      'tests/browser/fixtures/**',
    ],
  },
);
