# Docs

These are the VitePress sources for the PV docs site, including the samples under `samples/`.

## Running

From the repo root:

```bash
npm install
npm run docs:dev
```

This serves the docs at `http://localhost:5173`, with the samples running live against the TypeScript source — edit a sample or the source and reload to see the change.

For a static preview of the built site instead:

```bash
npm run docs:build
npx vitepress preview docs
```

## Samples

Each sample under `samples/` pairs a `.md` page with a `.js` file in `samples/code/` that the page embeds and runs. `samples/index.md` lists them all.

See [`../docs/development.md`](development.md) for the rest of the project's dev workflow (tests, linting, releases).
