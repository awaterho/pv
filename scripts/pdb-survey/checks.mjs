// The checks of the PDB survey (see survey.mjs). Each looks at what pv made
// of one entry -- the Mol io.cif returned -- and returns the problems it
// finds as flags { check, key, detail }: `key` groups the same problem
// across entries (usually a component id), `detail` says where it is.
// Nothing here renders; the checks compare pv's view of the structure with
// what the file and the wwPDB Chemical Component Dictionary (CCD) say.
import { vec3 } from 'gl-matrix';
import rings from '../../src/rings';

export const CHECKS = {
  'parse-error': 'io.cif threw on the entry.',
  'bad-coords': 'Atoms with non-finite coordinates.',
  'not-shown': 'A residue that the demo\'s cartoon display shows neither in the backbone ' +
    'trace nor as a ball-and-stick ligand: it is invisible.',
  'base-on-ligand': 'pv.rings.drawBases drew a DNA/RNA base for a residue that is not part ' +
    'of a polymer.',
  'long-base-stick': 'A base stick of pv.rings.drawBases longer than 6 Å.',
  'extra-bond': 'A bond pv draws inside a residue that the CCD doesn\'t have (pv bonds by ' +
    'distance unless the file has a chem_comp_bond table).',
  'missing-bond': 'A CCD bond, with both atoms present, that pv doesn\'t draw (usually ' +
    'distorted geometry in the model).',
  'long-bond': 'A bond between residues (peptide/phosphodiester link or _struct_conn) ' +
    'much longer than covalent.',
  'valence': 'An atom with more bonds than its element allows (C, N > 4, O > 2, H > 1).',
  'trace-gap': 'Consecutive residues of a backbone trace whose central atoms are too far ' +
    'apart to be linked: the cartoon bridges a gap.',
};

// covalent radii of the non-metals, as pv's own table in src/mol/mol.ts;
// bonds to anything else (metals) aren't length-checked
const RADII = {
  H: 0.31, D: 0.31, B: 0.84, C: 0.76, N: 0.71, O: 0.66, F: 0.57, SI: 1.11, P: 1.07,
  S: 1.05, CL: 1.02, AS: 1.19, SE: 1.20, BR: 1.20, TE: 1.38, I: 1.39,
};
const MAX_BONDS = { C: 4, N: 4, O: 2, H: 1, D: 1 };

const element = (atom) => atom.element().toUpperCase();
const isHydrogen = (atom) => element(atom) === 'H' || element(atom) === 'D';

export function residueLabel(residue) {
  const chain = residue.chain();
  // no insertion code is '\0'; the auth ids are only set (as strings) where
  // they differ from the label ones, and an unset prop reads as 0
  const insCode = residue.insCode() === '\0' ? '' : residue.insCode();
  let label = `${residue.name()} ${chain.name()}/${residue.num()}${insCode}`;
  const authAsym = typeof residue.prop('authAsymId') === 'string' ? residue.prop('authAsymId') : undefined;
  const authSeq = typeof residue.prop('authSeqId') === 'string' ? residue.prop('authSeqId') : undefined;
  if (authAsym !== undefined || authSeq !== undefined) {
    label += ` (auth ${authAsym ?? chain.name()}/${authSeq ?? residue.num()})`;
  }
  return label;
}

// entity id -> _entity.type ('polymer', 'non-polymer', 'branched', 'water')
export function entityTypes(doc) {
  const types = new Map();
  for (const row of doc.loopRows('entity')) {
    // lower case: some entries write 'POLYMER'
    types.set(row.get('id'), (row.get('type') || '').toLowerCase());
  }
  return types;
}

function entityType(residue, entities) {
  return entities.get(residue.chain().prop('entityId'));
}

export function checkCoords(structure) {
  const flags = [];
  structure.eachAtom((atom) => {
    const p = atom.pos();
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) {
      flags.push({ check: 'bad-coords', key: atom.residue().name(),
                   detail: residueLabel(atom.residue()) + ' ' + atom.name() });
    }
  });
  return flags;
}

// the demo shows the backbone traces as cartoon and select('ligand') as
// balls and sticks
export function checkShown(structure, entities) {
  const shown = new Set();
  structure.eachChain((chain) => {
    chain.eachBackboneTrace((trace) => {
      for (let i = 0; i < trace.length(); ++i) shown.add(trace.residueAt(i));
    });
  });
  structure.select('ligand').eachResidue((r) => { shown.add(r.full()); });
  const flags = [];
  structure.eachResidue((residue) => {
    if (residue.isWater() || shown.has(residue)) {
      return;
    }
    const kind = residue.isAminoacid() ? 'amino acid' : residue.isNucleotide() ? 'nucleotide' : 'residue';
    flags.push({ check: 'not-shown', key: residue.name(),
                 detail: `${residueLabel(residue)}: ${kind} of a ` +
                         `${entityType(residue, entities) ?? 'unknown'} entity, outside any trace` });
  });
  return flags;
}

export function checkBases(structure, entities) {
  const tubes = [];
  const viewer = {
    customMesh: () => ({
      addTriangles: () => {},
      addTube: (start, end, radius, options) => tubes.push({ start, end, radius, options }),
    }),
    requestRedraw: () => {},
  };
  rings.drawBases(viewer, 'bases', structure, { sticks: true });
  const flags = [];
  const seen = new Set();
  for (const tube of tubes) {
    const residue = tube.options.userData.residue().full();
    if (!seen.has(residue)) {
      seen.add(residue);
      const type = entityType(residue, entities);
      if (type !== undefined && type !== 'polymer') {
        flags.push({ check: 'base-on-ligand', key: residue.name(),
                     detail: `${residueLabel(residue)}, a ${type}` });
      }
    }
    const length = vec3.distance(tube.start, tube.end);
    if (tube.radius === 0.3 && length > 6) {
      flags.push({ check: 'long-base-stick', key: residue.name(),
                   detail: `${residueLabel(residue)}: ${length.toFixed(1)} Å` });
    }
  }
  return flags;
}

// ccd: component id -> Set of 'A|B' heavy-atom bond keys (names sorted), or
// null when the component isn't in the CCD
export function bondKey(a, b) {
  return a < b ? a + '|' + b : b + '|' + a;
}

export function checkBonds(structure, ccd) {
  const flags = [];
  structure.eachResidue((residue) => {
    if (residue.isWater()) return;
    const expected = ccd.get(residue.name());
    // components without bonds in the CCD (UNL, an unknown ligand) can't be checked
    if (!expected || expected.size === 0) return;
    const atoms = new Map();
    for (const atom of residue.atoms()) {
      if (!isHydrogen(atom)) atoms.set(atom.name(), atom);
    }
    if (atoms.size < 2) return;
    const drawn = new Set();
    for (const atom of atoms.values()) {
      for (const bond of atom.bonds()) {
        const other = bond.atom_one() === atom ? bond.atom_two() : bond.atom_one();
        if (other.residue().full() === residue && atoms.get(other.name()) === other) {
          drawn.add(bondKey(atom.name(), other.name()));
        }
      }
    }
    const distance = (key) => {
      const [a, b] = key.split('|');
      return vec3.distance(atoms.get(a).pos(), atoms.get(b).pos()).toFixed(2);
    };
    for (const key of drawn) {
      if (!expected.has(key)) {
        flags.push({ check: 'extra-bond', key: residue.name(),
                     detail: `${residueLabel(residue)} ${key.replace('|', '-')} ${distance(key)} Å` });
      }
    }
    for (const key of expected) {
      const [a, b] = key.split('|');
      if (atoms.has(a) && atoms.has(b) && !drawn.has(key)) {
        flags.push({ check: 'missing-bond', key: residue.name(),
                     detail: `${residueLabel(residue)} ${a}-${b} ${distance(key)} Å` });
      }
    }
  });
  return flags;
}

export function checkLongBondsAndValence(structure) {
  const flags = [];
  structure.eachAtom((atom) => {
    const bonds = atom.bonds();
    const max = MAX_BONDS[element(atom)];
    // coordination bonds to metals (the V-O cage of decavanadate) don't count
    const partners = bonds.map((b) => (b.atom_one() === atom ? b.atom_two() : b.atom_one()))
      .filter((other) => RADII[element(other)] !== undefined)
      .map((other) => other.name());
    if (max !== undefined && partners.length > max) {
      flags.push({ check: 'valence', key: atom.residue().name(),
                   detail: `${residueLabel(atom.residue())} ${atom.name()} bonded to ` +
                           partners.join(', ') });
    }
    for (const bond of bonds) {
      const other = bond.atom_one() === atom ? bond.atom_two() : bond.atom_one();
      // each bond once, from its lower-index atom. Bonds within a residue
      // are left out: pv makes them only within covalent distance, or from
      // the file's chem_comp_bond table, where a long one is the model's
      // own distorted geometry
      if (other.index() < atom.index() || other.residue().full() === atom.residue().full()) continue;
      const r1 = RADII[element(atom)], r2 = RADII[element(other)];
      if (r1 === undefined || r2 === undefined) continue;
      const d = vec3.distance(atom.pos(), other.pos());
      if (d > r1 + r2 + 0.45) {
        const ra = atom.residue(), rb = other.residue();
        flags.push({ check: 'long-bond', key: ra.name() + '-' + rb.name(),
                     detail: `${residueLabel(ra)} ${atom.name()} - ${residueLabel(rb)} ` +
                             `${other.name()}: ${d.toFixed(2)} Å` });
      }
    }
  });
  return flags;
}

export function checkTraces(structure) {
  const flags = [];
  structure.eachChain((chain) => {
    chain.eachBackboneTrace((trace) => {
      const aa = trace.residueAt(0).isAminoacid();
      const max = aa ? 4.3 : 8.0;
      for (let i = 1; i < trace.length(); ++i) {
        const a = trace.residueAt(i - 1).centralAtom(), b = trace.residueAt(i).centralAtom();
        if (a === null || b === null) continue;
        const d = vec3.distance(a.pos(), b.pos());
        if (d > max) {
          flags.push({ check: 'trace-gap', key: aa ? 'protein' : 'nucleic acid',
                       detail: `${residueLabel(trace.residueAt(i - 1))} → ` +
                               `${residueLabel(trace.residueAt(i))}: ${d.toFixed(1)} Å` });
        }
      }
    });
  });
  return flags;
}

// all checks; traceOnly structures (huge entries, CA/C3' atoms only) get
// just the ones that make sense without the other atoms
export function runChecks(structure, entities, ccd, traceOnly) {
  if (traceOnly) {
    return [...checkCoords(structure), ...checkTraces(structure)];
  }
  return [
    ...checkCoords(structure),
    ...checkShown(structure, entities),
    ...checkBases(structure, entities),
    ...checkBonds(structure, ccd),
    ...checkLongBondsAndValence(structure),
    ...checkTraces(structure),
  ];
}
