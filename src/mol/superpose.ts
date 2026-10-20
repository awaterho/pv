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
import { vec3, mat3, mat4, quat } from 'gl-matrix';

// Structural typing for the mol data model (Mol/MolView/Chain/Residue/Atom):
// superpose() and the matchResidues* helpers work polymorphically over
// either a full structure or a view, so these describe just what's used
// rather than importing the concrete classes.
interface SPAtom {
  name(): string;
  pos(): vec3;
  setPos(pos: vec3): void;
}
interface SPResidue {
  num(): number;
  atoms(): SPAtom[];
}
interface SPChain {
  name(): string;
  residues(): SPResidue[];
  residueByRnum(num: number): SPResidue | null;
}
interface SPStructureView {
  addChain(chain: SPChain): SPChainView;
}
interface SPChainView {
  addResidue(residue: SPResidue): SPResidueView;
}
interface SPResidueView {
  addAtom(atom: SPAtom): void;
}
interface SPStructure {
  atoms(): SPAtom[];
  chains(): SPChain[];
  full(): { atoms(): SPAtom[]; createEmptyView(): SPStructureView };
}

export interface SuperposeResult {
  // Root-mean-square deviation of the matched atoms after superposition, in A.
  rmsd: number;
  // The transform that was applied, mapping the subject's original
  // coordinates into the reference frame. Useful to move other structures
  // (or cameras) the same way without superposing them again.
  transform: mat4;
  // Number of atom pairs the superposition was computed from.
  atomCount: number;
}

// Optimal superposition follows Horn's quaternion method (J. Opt. Soc. Am. A
// 4, 629-642, 1987): the rotation minimising the RMSD is the eigenvector
// belonging to the largest eigenvalue of a symmetric 4x4 matrix built from
// the correlation of the two centred coordinate sets.
//
// The textbook SVD/Kabsch route computes the same thing, but needs an
// explicit determinant correction to return a rotation rather than a
// mirroring. That correction is easy to get subtly wrong and only misbehaves
// on rank-deficient input, which is exactly what a minimal three-residue
// selection produces: three points, once centred, always lie in a plane. A
// unit quaternion is a proper rotation by construction, so the correction and
// the entire class of bug that comes with it simply does not arise here. The
// RMSD also falls out of the largest eigenvalue, without a second pass over
// the atoms.

const calculateCenter = function(atoms: SPAtom[], center: vec3): void {
  vec3.set(center, 0, 0, 0);
  if (atoms.length === 0) {
    return;
  }
  // Accumulated as doubles: gl-matrix' vec3 is a Float32Array, which loses
  // digits summing thousands of coordinates far from the origin.
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < atoms.length; ++i) {
    const pos = atoms[i]!.pos();
    x += pos[0]; y += pos[1]; z += pos[2];
  }
  vec3.set(center, x/atoms.length, y/atoms.length, z/atoms.length);
};

const MAX_JACOBI_SWEEPS = 50;

// Cyclic Jacobi eigenvalue iteration for the symmetric 4x4 key matrix. `a`
// (row-major, overwritten) comes back diagonalised; the columns of `v` are
// the eigenvectors and `d` holds the matching eigenvalues. Four by four and
// symmetric is the easy case for Jacobi, so this converges in a handful of
// sweeps and needs no pivoting strategy beyond the cyclic sweep.
function jacobiEigen4(a: Float64Array, d: Float64Array, v: Float64Array): void {
  v.fill(0);
  v[0] = 1; v[5] = 1; v[10] = 1; v[15] = 1;
  for (let sweep = 0; sweep < MAX_JACOBI_SWEEPS; ++sweep) {
    let offDiagonal = 0;
    for (let p = 0; p < 3; ++p) {
      for (let q = p + 1; q < 4; ++q) {
        offDiagonal += a[p*4 + q]! * a[p*4 + q]!;
      }
    }
    if (offDiagonal < 1e-32) {
      break;
    }
    for (let p = 0; p < 3; ++p) {
      for (let q = p + 1; q < 4; ++q) {
        const apq = a[p*4 + q]!;
        if (apq === 0) {
          continue;
        }
        // Rotate by the angle that zeroes a[p][q], in the numerically stable
        // form that avoids cancellation when the diagonal entries are close.
        const theta = (a[q*4 + q]! - a[p*4 + p]!)/(2*apq);
        const t = (theta >= 0 ? 1 : -1)/
                  (Math.abs(theta) + Math.sqrt(theta*theta + 1));
        const c = 1/Math.sqrt(t*t + 1);
        const s = t*c;
        for (let k = 0; k < 4; ++k) {
          const akp = a[k*4 + p]!, akq = a[k*4 + q]!;
          a[k*4 + p] = c*akp - s*akq;
          a[k*4 + q] = s*akp + c*akq;
        }
        for (let k = 0; k < 4; ++k) {
          const apk = a[p*4 + k]!, aqk = a[q*4 + k]!;
          a[p*4 + k] = c*apk - s*aqk;
          a[q*4 + k] = s*apk + c*aqk;
        }
        for (let k = 0; k < 4; ++k) {
          const vkp = v[k*4 + p]!, vkq = v[k*4 + q]!;
          v[k*4 + p] = c*vkp - s*vkq;
          v[k*4 + q] = s*vkp + c*vkq;
        }
      }
    }
  }
  d[0] = a[0]!; d[1] = a[5]!; d[2] = a[10]!; d[3] = a[15]!;
}

const superpose = (function() {
  const referenceCenter = vec3.create();
  const subjectCenter = vec3.create();
  const shiftedPos = vec3.create();
  const rotation = mat3.create();
  const rotationQuat = quat.create();
  const keyMatrix = new Float64Array(16);
  const eigenvalues = new Float64Array(4);
  const eigenvectors = new Float64Array(16);
  return function(
    structure: SPStructure, reference: SPStructure
  ): SuperposeResult | null {
    const subjectAtoms = structure.atoms();
    const referenceAtoms = reference.atoms();
    if (subjectAtoms.length !== referenceAtoms.length) {
      console.error('atom counts do not match (' +
                    subjectAtoms.length + ' in structure vs ' +
                    referenceAtoms.length + ' in reference)');
      return null;
    }
    const atomCount = subjectAtoms.length;
    if (atomCount < 3) {
      console.error('at least 3 atoms are required for superposition');
      return null;
    }
    calculateCenter(referenceAtoms, referenceCenter);
    calculateCenter(subjectAtoms, subjectCenter);

    // Correlation of the two centred coordinate sets, s[i][j] summing
    // subject[i]*reference[j], together with the summed squared radii of
    // gyration the RMSD is derived from. Kept in doubles for the same reason
    // as the centre above.
    let sxx = 0, sxy = 0, sxz = 0;
    let syx = 0, syy = 0, syz = 0;
    let szx = 0, szy = 0, szz = 0;
    let residual = 0;
    for (let i = 0; i < atomCount; ++i) {
      const p = subjectAtoms[i]!.pos();
      const q = referenceAtoms[i]!.pos();
      const px = p[0] - subjectCenter[0];
      const py = p[1] - subjectCenter[1];
      const pz = p[2] - subjectCenter[2];
      const qx = q[0] - referenceCenter[0];
      const qy = q[1] - referenceCenter[1];
      const qz = q[2] - referenceCenter[2];
      residual += px*px + py*py + pz*pz + qx*qx + qy*qy + qz*qz;
      sxx += px*qx; sxy += px*qy; sxz += px*qz;
      syx += py*qx; syy += py*qy; syz += py*qz;
      szx += pz*qx; szy += pz*qy; szz += pz*qz;
    }

    keyMatrix[0]  = sxx + syy + szz;
    keyMatrix[1]  = syz - szy;
    keyMatrix[2]  = szx - sxz;
    keyMatrix[3]  = sxy - syx;
    keyMatrix[4]  = syz - szy;
    keyMatrix[5]  = sxx - syy - szz;
    keyMatrix[6]  = sxy + syx;
    keyMatrix[7]  = szx + sxz;
    keyMatrix[8]  = szx - sxz;
    keyMatrix[9]  = sxy + syx;
    keyMatrix[10] = -sxx + syy - szz;
    keyMatrix[11] = syz + szy;
    keyMatrix[12] = sxy - syx;
    keyMatrix[13] = szx + sxz;
    keyMatrix[14] = syz + szy;
    keyMatrix[15] = -sxx - syy + szz;
    jacobiEigen4(keyMatrix, eigenvalues, eigenvectors);

    let best = 0;
    for (let i = 1; i < 4; ++i) {
      if (eigenvalues[i]! > eigenvalues[best]!) {
        best = i;
      }
    }
    // Horn orders the quaternion (w, x, y, z); gl-matrix stores (x, y, z, w).
    quat.set(rotationQuat,
             eigenvectors[1*4 + best]!, eigenvectors[2*4 + best]!,
             eigenvectors[3*4 + best]!, eigenvectors[0*4 + best]!);
    quat.normalize(rotationQuat, rotationQuat);
    mat3.fromQuat(rotation, rotationQuat);

    const rmsd = Math.sqrt(
      Math.max(0, residual - 2*eigenvalues[best]!)/atomCount);
    // Coincident atoms, or any other input that leaves the key matrix without
    // a usable eigenvector, would otherwise write NaN over every position.
    if (!isFinite(rmsd) || !isFinite(rotation[0]!) || !isFinite(rotation[4]!) ||
        !isFinite(rotation[8]!)) {
      console.error('superposition is degenerate; structure left unchanged');
      return null;
    }

    // apply transformation to all atoms
    const allAtoms = structure.full().atoms();
    for (let i = 0; i < allAtoms.length; ++i) {
      const atom = allAtoms[i]!;
      vec3.sub(shiftedPos, atom.pos(), subjectCenter);
      vec3.transformMat3(shiftedPos, shiftedPos, rotation);
      vec3.add(shiftedPos, referenceCenter, shiftedPos);
      atom.setPos(shiftedPos);
    }

    // The same thing as a single matrix, for callers that want to move
    // something else along: rotate about the subject centre, then land on the
    // reference centre.
    const transform = mat4.create();
    mat4.fromQuat(transform, rotationQuat);
    const offset = vec3.create();
    vec3.transformMat3(offset, subjectCenter, rotation);
    vec3.sub(offset, referenceCenter, offset);
    transform[12] = offset[0];
    transform[13] = offset[1];
    transform[14] = offset[2];
    return { rmsd : rmsd, transform : transform, atomCount : atomCount };
  };
})();


type AtomNameSet = Record<string, boolean> | null;

// Parses different representations of a list of atom names and returns a
// set (a dictionary actually with elements contained in the set set to
// true) that describes the list.
//
//  * undefined/null to null. This translates to match any atom
//  * 'all' to null
//  * 'backbone' to { 'N', 'CA', 'C', 'O' }
//  * 'aname1, aname2' to { 'aname1', 'aname2' }
//  * ['aname1', 'aname2']  to  { 'aname1', 'aname2' }
function parseAtomNames(atoms?: string | string[] | null): AtomNameSet {
  if (atoms === undefined || atoms === null || atoms === 'all') {
    return null;
  }
  if (atoms === 'backbone') {
    return { 'CA' : true, 'C' : true, 'O' : true, 'N' : true };
  }
  if (typeof atoms === 'string') {
    const results: Record<string, boolean> = {};
    const atomNames = atoms.split(',');
    for (let i = 0; i < atomNames.length; ++i) {
      results[atomNames[i]!.trim()] = true;
    }
    return results;
  } else {
    const results: Record<string, boolean> = {};
    for (let i = 0; i < atoms.length; ++i) {
      results[atoms[i]!] = true;
    }
    return results;
  }
}

function addAtomsPresentInBoth(
  inA: SPResidue, inB: SPResidue, outA: SPAtom[], outB: SPAtom[], atomSet: AtomNameSet
): void {
  const atomsA = inA.atoms();
  const atomsB = inB.atoms();
  for (let i = 0; i < atomsA.length; ++i) {
    const atomA = atomsA[i]!;
    if (atomSet !== null && atomSet[atomA.name()] !== true) {
      continue;
    }
    for (let j = 0; j < atomsB.length; ++j) {
      const atomB = atomsB[j]!;
      if (atomB.name() === atomA.name()) {
        outA.push(atomA);
        outB.push(atomB);
        break;
      }
    }
  }
}

// Pairs up the chains of two structures by name.
//
// Pairing by position instead silently matches unrelated chains whenever the
// two structures list their chains in a different order, which is common
// enough in deposited entries. The one case where names cannot be trusted is
// a lone chain on either side, since the same molecule is routinely called A
// in one file and B in another, so those are paired directly.
function matchChains(chainsA: SPChain[], chainsB: SPChain[]): [SPChain, SPChain][] {
  if (chainsA.length === 1 && chainsB.length === 1) {
    return [[chainsA[0]!, chainsB[0]!]];
  }
  const byName = new Map<string, SPChain>();
  for (let i = 0; i < chainsB.length; ++i) {
    byName.set(chainsB[i]!.name(), chainsB[i]!);
  }
  const pairs: [SPChain, SPChain][] = [];
  for (let i = 0; i < chainsA.length; ++i) {
    const chainB = byName.get(chainsA[i]!.name());
    if (chainB !== undefined) {
      pairs.push([chainsA[i]!, chainB]);
    }
  }
  return pairs;
}

function matchResidues(
  inA: SPStructure, inB: SPStructure, atoms: string | string[] | undefined,
  matchFn: (chainA: SPChain, chainB: SPChain) => [SPResidue[], SPResidue[]],
): [SPStructureView, SPStructureView] | null {
  const outA = inA.full().createEmptyView();
  const outB = inB.full().createEmptyView();
  const atomSet = parseAtomNames(atoms);
  const pairs = matchChains(inA.chains(), inB.chains());
  if (pairs.length === 0) {
    console.error('no chains with matching names in the two structures');
    return null;
  }

  for (let i = 0; i < pairs.length; ++i) {
    const chainA = pairs[i]![0];
    const chainB = pairs[i]![1];
    const matchedResidues = matchFn(chainA, chainB);
    const residuesA = matchedResidues[0];
    const residuesB = matchedResidues[1];
    if (residuesA.length !== residuesB.length) {
      console.error('chains', chainA.name(), ' and', chainB.name(),
                    ' do not contain the same number of residues.');
      return null;
    }

    const outChainA = outA.addChain(chainA);
    const outChainB = outB.addChain(chainB);
    for (let j = 0; j < residuesA.length; ++j) {
      const residueA = residuesA[j]!;
      const residueB = residuesB[j]!;
      const outAtomsA: SPAtom[] = [], outAtomsB: SPAtom[] = [];
      addAtomsPresentInBoth(residueA, residueB, outAtomsA, outAtomsB, atomSet);
      if (outAtomsA.length === 0) {
        continue;
      }
      const outResidueA = outChainA.addResidue(residueA);
      const outResidueB = outChainB.addResidue(residueB);
      for (let k = 0; k < outAtomsA.length; ++k) {
        outResidueA.addAtom(outAtomsA[k]!);
        outResidueB.addAtom(outAtomsB[k]!);
      }
    }
  }
  return [outA, outB];
}

function matchResiduesByIndex(
  inA: SPStructure, inB: SPStructure, atoms?: string | string[]
): [SPStructureView, SPStructureView] | null {
  return matchResidues(inA, inB, atoms, function(chainA, chainB) {
    return [chainA.residues(), chainB.residues()];
  });
}

function matchResiduesByNum(
  inA: SPStructure, inB: SPStructure, atoms?: string | string[]
): [SPStructureView, SPStructureView] | null {
  return matchResidues(inA, inB, atoms, function(chainA, chainB) {
    const outA: SPResidue[] = [], outB: SPResidue[] = [];
    const residuesA = chainA.residues();
    for (let i = 0; i < residuesA.length; ++i) {
      const resB = chainB.residueByRnum(residuesA[i]!.num());
      if (resB !== null) {
        outA.push(residuesA[i]!);
        outB.push(resB);
      }
    }
    return [outA, outB];
  });
}

export default {
  superpose : superpose,
  matchResiduesByNum : matchResiduesByNum,
  matchResiduesByIndex : matchResiduesByIndex,
  parseAtomNames : parseAtomNames,
  addAtomsPresentInBoth : addAtomsPresentInBoth
};
