// Writes the survey's HTML report (see survey.mjs): per check, the flags
// grouped by key (usually the component id) with the entries they occur in,
// most widespread first. Entry links open the entry in the demo
// (index.html#ID) when the report is served by the dev server.
import { writeFileSync } from 'node:fs';

const MAX_KEYS = 200;
const MAX_ENTRIES = 12;
const MAX_DETAILS = 5;

const escape = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function entryLink(id, title) {
  return `<a href="../index.html#${id}" title="${escape(title)}">${id}</a>` +
         `<a class="rcsb" href="https://www.rcsb.org/structure/${id}" title="RCSB page">↗</a>`;
}

export function writeReport(results, checks, path) {
  const surveyed = results.filter((r) => !r.download);
  const failed = results.filter((r) => r.download);
  // check -> key -> id -> details
  const grouped = new Map(Object.keys(checks).map((c) => [c, new Map()]));
  for (const result of surveyed) {
    for (const f of result.flags) {
      if (!grouped.has(f.check)) grouped.set(f.check, new Map());
      const keys = grouped.get(f.check);
      if (!keys.has(f.key)) keys.set(f.key, new Map());
      const ids = keys.get(f.key);
      if (!ids.has(result.id)) ids.set(result.id, []);
      ids.get(result.id).push(f.detail);
    }
  }

  const summaryRows = [...grouped].map(([check, keys]) => {
    const entries = new Set([...keys.values()].flatMap((ids) => [...ids.keys()]));
    return `<tr><td><a href="#${check}">${check}</a></td><td>${entries.size}</td>` +
           `<td>${keys.size}</td><td>${escape(checks[check] ?? '')}</td></tr>`;
  }).join('');

  const sections = [...grouped].filter(([, keys]) => keys.size > 0).map(([check, keys]) => {
    const sorted = [...keys].sort((a, b) => b[1].size - a[1].size);
    const rows = sorted.slice(0, MAX_KEYS).map(([key, ids]) => {
      const flags = [...ids.values()].reduce((n, d) => n + d.length, 0);
      const examples = [...ids].slice(0, MAX_ENTRIES);
      const links = examples.map(([id, details]) => entryLink(id, details[0])).join(' ');
      const more = ids.size > MAX_ENTRIES ? ` <span class="dim">+${ids.size - MAX_ENTRIES}</span>` : '';
      const details = examples.slice(0, 3).flatMap(([id, d]) =>
        d.slice(0, MAX_DETAILS).map((x) => `<li>${id}: ${escape(x)}</li>`)).join('');
      return `<tr><td class="key">${escape(key)}</td><td>${ids.size}</td><td>${flags}</td>` +
             `<td>${links}${more}<details><summary>details</summary><ul>${details}</ul></details></td></tr>`;
    }).join('');
    const cut = sorted.length > MAX_KEYS ? `<p class="dim">${sorted.length - MAX_KEYS} more keys not shown</p>` : '';
    return `<h2 id="${check}">${check}</h2><p>${escape(checks[check] ?? '')}</p>` +
           `<table><tr><th>key</th><th>entries</th><th>flags</th><th>entries (hover for the first detail)</th></tr>` +
           `${rows}</table>${cut}`;
  }).join('');

  const slowest = surveyed.filter((r) => r.loadMs !== undefined)
    .sort((a, b) => b.loadMs - a.loadMs).slice(0, 15)
    .map((r) => `<tr><td>${entryLink(r.id, '')}</td><td>${r.atoms.toLocaleString()}</td>` +
                `<td>${r.loadMs}</td><td>${r.traceOnly ? 'trace only' : ''}</td></tr>`).join('');
  const categories = new Map();
  for (const r of results) for (const c of r.categories) categories.set(c, (categories.get(c) || 0) + 1);

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>pv PDB survey</title>
<style>
  body { font: 14px/1.45 system-ui, sans-serif; margin: 24px auto; max-width: 1200px; padding: 0 16px;
         color: #1d1d1f; background: #fff; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 24px; }
  th, td { text-align: left; vertical-align: top; padding: 4px 8px; border-bottom: 1px solid #e5e5e5; }
  td.key { font-family: ui-monospace, monospace; white-space: nowrap; }
  a { color: #0b62c4; text-decoration: none; margin-right: 2px; }
  a.rcsb { font-size: 11px; margin-right: 8px; color: #888; }
  .dim { color: #888; }
  details { margin-top: 4px; } summary { cursor: pointer; color: #888; font-size: 12px; }
  ul { margin: 4px 0; padding-left: 18px; font-size: 12px; }
</style></head><body>
<h1>pv PDB survey</h1>
<p>${surveyed.length} entries surveyed${failed.length ? `, ${failed.length} failed to download` : ''};
by sample category: ${[...categories].map(([c, n]) => `${escape(c)} ${n}`).join(', ')}.
Entry links open the entry in the demo (serve this page with <code>npm run dev</code>); ↗ opens its RCSB page.</p>
<table><tr><th>check</th><th>entries</th><th>keys</th><th>what it means</th></tr>${summaryRows}</table>
${sections}
<h2>Slowest loads</h2>
<table><tr><th>entry</th><th>atoms</th><th>io.cif ms</th><th></th></tr>${slowest}</table>
${failed.length ? `<h2>Failed downloads</h2><p>${failed.map((r) => `${r.id} (${escape(r.download)})`).join(', ')}</p>` : ''}
</body></html>
`;
  writeFileSync(path, html);
}
