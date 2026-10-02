// Ring perception for the ring-based add-ons (filled rings, SNFG symbols).
import type { vec3 } from 'gl-matrix';

// only what's used here of pv's atoms and residues
export interface RAtom {
  element(): string;
  pos(): vec3;
  residue(): RResidue;
  bonds(): { atom_one(): RAtom; atom_two(): RAtom }[];
  full(): RAtom;
}
export interface RResidue {
  name(): string;
  atoms(): RAtom[];
  prop(name: string): unknown;
  full(): RResidue;
}

function heavyNeighbors(atom: RAtom, residue: RResidue): RAtom[] {
  const result: RAtom[] = [];
  for (const bond of atom.bonds()) {
    const a = bond.atom_one().full();
    const other = a === atom ? bond.atom_two().full() : a;
    if (other.element() !== 'H' && other.residue().full() === residue) {
      result.push(other);
    }
  }
  return result;
}

// the rings of a residue's heavy atoms, each as its atoms in ring order:
// for every bond, the shortest cycle through it (up to maxSize atoms).
// Fused rings (naphthalene, purines) come out as their small rings, not
// the large one around both.
export function findRings(residue: RResidue, maxSize?: number): RAtom[][] {
  const limit = maxSize ?? 8;
  const full = residue.full();
  const atoms = full.atoms().map((a) => a.full()).filter((a) => a.element() !== 'H');
  const rings: RAtom[][] = [];
  const seen = new Set<string>();
  const index = new Map(atoms.map((a, i) => [a, i]));
  for (const start of atoms) {
    for (const goal of heavyNeighbors(start, full)) {
      if (index.get(goal)! < index.get(start)!) {
        continue;
      }
      // breadth-first from start to goal, not across the start-goal bond
      const previous = new Map<RAtom, RAtom | null>([[start, null]]);
      let frontier = [start];
      for (let depth = 1; depth < limit && !previous.has(goal); ++depth) {
        const next: RAtom[] = [];
        for (const atom of frontier) {
          for (const n of heavyNeighbors(atom, full)) {
            if (previous.has(n) || (atom === start && n === goal)) {
              continue;
            }
            previous.set(n, atom);
            next.push(n);
          }
        }
        frontier = next;
      }
      if (!previous.has(goal)) {
        continue;
      }
      const ring: RAtom[] = [];
      for (let a: RAtom | null = goal; a !== null; a = previous.get(a)!) {
        ring.push(a);
      }
      const key = ring.map((a) => index.get(a)!).sort((x, y) => x - y).join();
      if (ring.length >= 3 && !seen.has(key)) {
        seen.add(key);
        rings.push(ring);
      }
    }
  }
  return rings;
}
