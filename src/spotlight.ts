// Copyright (c) 2013-2015 Marco Biasini
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

// The spheres of Viewer.spotlight(), at most as many as the shader takes
// (shaders.ts's SPOTLIGHT), the distance to which stays close to the
// distance to the nearest atom: a point per atom when they fit, otherwise
// spheres enclosing runs of 2, 3, ... atoms of a residue (consecutive atoms
// of a residue are mostly bonded), then whole residues, then runs of
// neighbouring residues of a chain.

interface SpotlightAtom {
  pos(): ArrayLike<number>;
}
interface SpotlightResidue {
  eachAtom(callback: (atom: SpotlightAtom) => void): unknown;
  chain(): unknown;
}
interface SpotlightStructure {
  eachResidue(callback: (residue: SpotlightResidue) => void): unknown;
}

// a structure or selection, a point, or a list of them
export type SpotlightTarget =
  SpotlightStructure | ArrayLike<number> | (SpotlightStructure | ArrayLike<number>)[];

interface Sphere {
  x: number;
  y: number;
  z: number;
  r: number;
  // spheres are only merged with neighbours of the same group, their
  // chain (points are all one group), while there are few enough groups
  group: unknown;
}

function isPoint(target: unknown): target is ArrayLike<number> {
  const t = target as ArrayLike<unknown>;
  return t.length === 3 && typeof t[0] === 'number';
}

// one sphere enclosing all of the given ones: around their mean center,
// not the smallest such sphere, but close for neighbouring residues
function enclosing(spheres: Sphere[]): Sphere {
  let x = 0, y = 0, z = 0;
  for (const s of spheres) {
    x += s.x; y += s.y; z += s.z;
  }
  x /= spheres.length; y /= spheres.length; z /= spheres.length;
  let r = 0;
  for (const s of spheres) {
    r = Math.max(r, Math.hypot(s.x - x, s.y - y, s.z - z) + s.r);
  }
  return { x, y, z, r, group: spheres[0]!.group };
}

// merges runs of up to size neighbouring spheres, of the same group unless
// anyGroup
function merge(spheres: Sphere[], size: number, anyGroup: boolean): Sphere[] {
  const merged: Sphere[] = [];
  let run: Sphere[] = [];
  for (const s of spheres) {
    if (run.length === size ||
        (!anyGroup && run.length > 0 && run[0]!.group !== s.group)) {
      merged.push(enclosing(run));
      run = [];
    }
    run.push(s);
  }
  if (run.length > 0) {
    merged.push(enclosing(run));
  }
  return merged;
}

// splits each residue into runs of up to size atoms
function chunk(residues: Sphere[][], size: number): Sphere[] {
  const out: Sphere[] = [];
  for (const atoms of residues) {
    for (let i = 0; i < atoms.length; i += size) {
      out.push(enclosing(atoms.slice(i, i + size)));
    }
  }
  return out;
}

// the spheres of target as x, y, z, radius each, at most max of them
export function spotlightSpheres(target: SpotlightTarget, max: number): Float32Array {
  const targets = isPoint(target) || !Array.isArray(target) ? [target] : target;
  // the atoms of each residue, as spheres of radius 0; a point is a residue
  // of one atom
  const residues: Sphere[][] = [];
  const points = {};
  for (const t of targets) {
    if (isPoint(t)) {
      residues.push([{ x: t[0]!, y: t[1]!, z: t[2]!, r: 0, group: points }]);
      continue;
    }
    (t as SpotlightStructure).eachResidue((res) => {
      const atoms: Sphere[] = [];
      res.eachAtom((atom) => {
        const p = atom.pos();
        atoms.push({ x: p[0]!, y: p[1]!, z: p[2]!, r: 0, group: res.chain() });
      });
      if (atoms.length > 0) {
        residues.push(atoms);
      }
    });
  }
  let merged: Sphere[] | null = null;
  const largest = residues.reduce((n, atoms) => Math.max(n, atoms.length), 0);
  for (let size = 1; size < largest && merged === null; ++size) {
    const count = residues.reduce((n, atoms) => n + Math.ceil(atoms.length / size), 0);
    if (count <= max) {
      merged = chunk(residues, size);
    }
  }
  if (merged === null) {
    // whole residues, merged as needed. Runs break at chain ends, so a run
    // size of n / max can still leave more than max: grow it until they
    // fit, and with more chains than max, merge across them
    const spheres = chunk(residues, Math.max(largest, 1));
    merged = spheres;
    const minSize = Math.ceil(spheres.length / max);
    for (let size = minSize; merged.length > max; ++size) {
      merged = size <= spheres.length ? merge(spheres, size, false)
                                      : merge(spheres, minSize, true);
    }
  }
  const out = new Float32Array(merged.length * 4);
  merged.forEach((s, i) => out.set([s.x, s.y, s.z, s.r], i * 4));
  return out;
}
