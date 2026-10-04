// Picks the PDB entries for the survey (see survey.mjs): a random sample of
// the whole archive plus samples of the kinds of entry that exercise
// particular parts of pv -- nucleic acids, glycans, NMR ensembles, cryo-EM
// giants, ligand-rich entries. Writes survey/ids.txt, one "ID<tab>categories"
// line per entry. Seeded, so the same seed gives the same sample.
//
//   node scripts/pdb-survey/sample.mjs [--seed 1] [--scale 1]
//
// --scale multiplies every category's count (0.1 for a quick run).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const outDir = resolve(root, 'survey');

const args = process.argv.slice(2);
function option(name, fallback) {
  const i = args.indexOf('--' + name);
  return i === -1 ? fallback : Number(args[i + 1]);
}
const seed = option('seed', 1);
const scale = option('scale', 1);

const CATEGORIES = [
  { name: 'random', count: 800 },
  { name: 'nucleic', count: 250,
    query: { attribute: 'rcsb_entry_info.polymer_entity_count_nucleic_acid',
             operator: 'greater', value: 0 } },
  { name: 'glycan', count: 200,
    query: { attribute: 'rcsb_entry_info.branched_entity_count',
             operator: 'greater', value: 0 } },
  { name: 'nmr', count: 150,
    query: { attribute: 'exptl.method', operator: 'exact_match', value: 'SOLUTION NMR' } },
  { name: 'em', count: 150,
    query: { attribute: 'exptl.method', operator: 'exact_match', value: 'ELECTRON MICROSCOPY' } },
  { name: 'ligands', count: 250,
    query: { attribute: 'rcsb_entry_info.nonpolymer_entity_count',
             operator: 'greater_or_equal', value: 3 } },
];

// mulberry32: a small seeded PRNG
function random(seed) {
  let a = seed >>> 0;
  return function() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// count distinct elements of ids, by a partial Fisher-Yates shuffle
function pick(ids, count, rand) {
  const a = ids.slice();
  const n = Math.min(count, a.length);
  for (let i = 0; i < n; ++i) {
    const j = i + Math.floor(rand() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

async function allIds(query) {
  if (!query) {
    const response = await fetch('https://data.rcsb.org/rest/v1/holdings/current/entry_ids');
    if (!response.ok) throw new Error('holdings: HTTP ' + response.status);
    return response.json();
  }
  const response = await fetch('https://search.rcsb.org/rcsbsearch/v2/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: { type: 'terminal', service: 'text', parameters: query },
      return_type: 'entry',
      request_options: { return_all_hits: true },
    }),
  });
  if (!response.ok) throw new Error('search: HTTP ' + response.status);
  const result = await response.json();
  return result.result_set.map((hit) => hit.identifier);
}

const categoriesOf = new Map();
for (const [index, category] of CATEGORIES.entries()) {
  const ids = await allIds(category.query);
  // one stream per category, so changing one count leaves the others alone
  const chosen = pick(ids.sort(), Math.round(category.count * scale), random(seed * 1000 + index));
  console.log(`${category.name}: ${chosen.length} of ${ids.length}`);
  for (const id of chosen) {
    if (!categoriesOf.has(id)) categoriesOf.set(id, []);
    categoriesOf.get(id).push(category.name);
  }
}

mkdirSync(outDir, { recursive: true });
const lines = [...categoriesOf].map(([id, names]) => id + '\t' + names.join(','));
writeFileSync(resolve(outDir, 'ids.txt'), lines.join('\n') + '\n');
console.log(`${lines.length} entries written to survey/ids.txt`);
