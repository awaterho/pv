// Surveys PDB entries for problems in what pv makes of them, without
// rendering: each entry of survey/ids.txt (see sample.mjs) is downloaded
// from RCSB, loaded with pv's own mmCIF reader and run through the checks
// in checks.mjs. Results go to survey/results.jsonl (one line per entry; a
// rerun skips the entries already there) and survey/report.html, which
// groups the flags by check and component, with links that open each entry
// in the demo. Downloads (entries and CCD components) are cached under
// survey/cache.
//
//   npm run survey -- [--ids survey/ids.txt] [--limit N] [--fresh] [--report]
//
// --fresh discards earlier results, --report only rebuilds the report.
// Open the report through the dev server (npm run dev) at
// http://localhost:5173/survey/report.html so its links reach the demo.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import io from '../../src/io';
import { parseCIF } from '../../src/cif';
import { CHECKS, entityTypes, bondKey, runChecks } from './checks.mjs';
import { writeReport } from './report.mjs';

const root = resolve(import.meta.dirname, '../..');
const outDir = resolve(root, 'survey');
const cacheDir = resolve(outDir, 'cache');
const resultsPath = resolve(outDir, 'results.jsonl');

const args = process.argv.slice(2);
function option(name, fallback) {
  const i = args.indexOf('--' + name);
  return i === -1 ? fallback : args[i + 1];
}
const flag = (name) => args.includes('--' + name);

// the demo's threshold for loading CA/C3' atoms only
const HUGE_ATOM_COUNT = 500000;
const CONCURRENCY = 6;

function readResults() {
  if (!existsSync(resultsPath)) return [];
  return readFileSync(resultsPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

async function download(url, path) {
  if (existsSync(path)) return readFileSync(path);
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  return data;
}

async function entryText(id) {
  const lower = id.toLowerCase();
  const data = await download(`https://files.rcsb.org/download/${lower}.cif.gz`,
                              resolve(cacheDir, 'entries', lower.slice(1, 3), lower + '.cif.gz'));
  if (data === null) throw new Error('not found on RCSB');
  return gunzipSync(data).toString('utf8');
}

// component id -> its CCD heavy-atom bonds (see checks.mjs), or null
const ccdCache = new Map();
function ccdBonds(comp) {
  if (!ccdCache.has(comp)) {
    ccdCache.set(comp, (async () => {
      const path = resolve(cacheDir, 'ccd', comp + '.cif');
      let text;
      if (existsSync(path)) {
        text = readFileSync(path, 'utf8');
      } else {
        const response = await fetch(`https://files.rcsb.org/ligands/download/${comp}.cif`);
        // remembered as an empty file, so a component missing from the CCD
        // isn't asked for again
        text = response.ok ? await response.text() : '';
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, text);
      }
      if (text === '') return null;
      const doc = parseCIF(text);
      const hydrogens = new Set(doc.loopRows('chem_comp_atom')
        .filter((r) => r.get('type_symbol') === 'H' || r.get('type_symbol') === 'D')
        .map((r) => r.get('atom_id')));
      const bonds = new Set();
      for (const row of doc.loopRows('chem_comp_bond')) {
        const a = row.get('atom_id_1'), b = row.get('atom_id_2');
        if (!hydrogens.has(a) && !hydrogens.has(b)) bonds.add(bondKey(a, b));
      }
      return bonds;
    })().catch(() => null));
  }
  return ccdCache.get(comp);
}

async function survey(id, categories) {
  const result = { id, categories, flags: [] };
  let text;
  try {
    text = await entryText(id);
  } catch (error) {
    return { ...result, download: String(error.message || error) };
  }
  // everything but the atoms: entities and components
  const meta = parseCIF(text, { keepRow: (category) => category !== 'atom_site' });
  const comps = meta.loopRows('chem_comp').map((r) => r.get('id'));
  const ccd = new Map();
  await Promise.all(comps.map(async (comp) => ccd.set(comp, await ccdBonds(comp))));

  result.atoms = (text.match(/^(ATOM|HETATM) /gm) || []).length;
  result.traceOnly = result.atoms > HUGE_ATOM_COUNT;
  const start = performance.now();
  let structure;
  try {
    structure = io.cif(text, { traceOnly: result.traceOnly });
  } catch (error) {
    result.flags.push({ check: 'parse-error', key: String(error.message || error).slice(0, 80),
                        detail: String(error.stack || error).split('\n').slice(0, 3).join(' ') });
    return result;
  }
  result.loadMs = Math.round(performance.now() - start);
  if (Array.isArray(structure)) structure = structure[0];
  if (!structure) {
    result.flags.push({ check: 'parse-error', key: 'no structure', detail: 'io.cif returned nothing' });
    return result;
  }
  try {
    result.flags = runChecks(structure, entityTypes(meta), ccd, result.traceOnly);
  } catch (error) {
    result.flags.push({ check: 'parse-error', key: 'check crashed: ' + String(error.message || error).slice(0, 60),
                        detail: String(error.stack || error).split('\n').slice(0, 3).join(' ') });
  }
  return result;
}

if (flag('fresh')) rmSync(resultsPath, { force: true });

if (!flag('report')) {
  const idsPath = resolve(root, option('ids', 'survey/ids.txt'));
  if (!existsSync(idsPath)) {
    console.error(`${idsPath} not found: run "npm run survey:sample" first`);
    process.exit(1);
  }
  const done = new Set(readResults().map((r) => r.id));
  let todo = readFileSync(idsPath, 'utf8').split('\n').filter(Boolean)
    .map((line) => line.split('\t'))
    .map(([id, categories]) => ({ id: id.toUpperCase(), categories: (categories || '').split(',') }))
    .filter((e) => !done.has(e.id));
  const limit = Number(option('limit', Infinity));
  todo = todo.slice(0, limit);
  console.log(`${todo.length} entries to survey (${done.size} done before)`);

  let next = 0, finished = 0;
  async function worker() {
    while (next < todo.length) {
      const { id, categories } = todo[next++];
      const result = await survey(id, categories);
      appendFileSync(resultsPath, JSON.stringify(result) + '\n');
      finished += 1;
      const summary = result.download ? 'download failed: ' + result.download
        : `${result.atoms} atoms, ${result.loadMs ?? '-'} ms, ${result.flags.length} flags`;
      console.log(`[${finished}/${todo.length}] ${id} ${summary}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

const reportPath = resolve(outDir, 'report.html');
writeReport(readResults(), CHECKS, reportPath);
console.log('report: ' + reportPath);
