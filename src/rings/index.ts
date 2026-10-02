// Filled rings, an add-on built only on pv's public API: every ring of a
// residue (sugar rings, aromatic rings of ligands and side chains, bases)
// filled with a flat polygon, the way VMD's PaperChain or Chimera's filled
// rings show them. Meant to go with a balls-and-sticks or lines display of
// the same atoms. drawBases() is the nucleic-acid variant, meant to go with
// a cartoon: each base as filled, outlined rings, optionally on a stick
// from the backbone tube (a "ladder" like Mol*'s or Chimera's).
//
//   pv.rings.draw(viewer, 'rings', structure.select('ligand'));
//   pv.rings.drawBases(viewer, 'bases', structure);
import { vec3 } from 'gl-matrix';
import color from '../color';
import snfg from '../snfg';
import { findRings, type RAtom, type RResidue } from './find';
import { copiesFor, transformed } from './copies';

// only what's used here of pv's residues, structures (or views) and viewer
interface RNucleotide extends RResidue {
  isNucleotide(): boolean;
  atom(name: string): RAtom | null;
}
interface RChained {
  chain(): { name(): string };
}
interface RStructure {
  eachResidue(callback: (residue: RResidue) => void): void;
}
interface RMesh {
  addTriangles(positions: ArrayLike<number>, options?: Record<string, unknown>): void;
  addTube(start: vec3, end: vec3, radius: number, options?: Record<string, unknown>): void;
}
interface RViewer {
  customMesh(name: string, options?: Record<string, unknown>): RMesh;
  requestRedraw(): void;
}

type ColorSpec = string | number[];

const fillRing = (function() {
  const center = vec3.create();
  const normal = vec3.create();
  const u = vec3.create();
  const v = vec3.create();
  const cross = vec3.create();
  return function(mesh: RMesh, ring: RAtom[], fillColor: ColorSpec, userData: unknown): void {
    vec3.zero(center);
    for (const a of ring) {
      vec3.add(center, center, a.pos());
    }
    vec3.scale(center, center, 1 / ring.length);
    // the ring's mean normal: puckered rings (a pyranose chair) aren't
    // flat, and shading each fan triangle by its own face normal would
    // show them as facets
    vec3.zero(normal);
    for (let i = 0; i < ring.length; ++i) {
      vec3.sub(u, ring[i]!.pos(), center);
      vec3.sub(v, ring[(i + 1) % ring.length]!.pos(), center);
      vec3.add(normal, normal, vec3.cross(cross, u, v));
    }
    vec3.normalize(normal, normal);
    // a fan from the center, both windings (with opposite normals) so it
    // shows from either side
    const positions: number[] = [];
    const normals: number[] = [];
    const [nx, ny, nz] = [normal[0]!, normal[1]!, normal[2]!];
    for (let i = 0; i < ring.length; ++i) {
      const p = ring[i]!.pos();
      const q = ring[(i + 1) % ring.length]!.pos();
      positions.push(center[0]!, center[1]!, center[2]!, p[0]!, p[1]!, p[2]!, q[0]!, q[1]!, q[2]!);
      normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      positions.push(center[0]!, center[1]!, center[2]!, q[0]!, q[1]!, q[2]!, p[0]!, p[1]!, p[2]!);
      normals.push(-nx, -ny, -nz, -nx, -ny, -nz, -nx, -ny, -nz);
    }
    mesh.addTriangles(positions, {
      color: color.forceRGB(fillColor as never),
      normals,
      userData,
    });
  };
})();

// calls draw(mesh, residue) for every residue of structure, once per
// symmetry copy of showRelated (see copies.ts) with mesh transformed to it
function eachCopy(mesh: RMesh, structure: RStructure, showRelated: string | undefined,
                  draw: (mesh: RMesh, residue: RResidue) => void): void {
  const residues: RResidue[] = [];
  structure.eachResidue((r) => { residues.push(r.full()); });
  const copies = copiesFor(structure, showRelated);
  copies.forEach(function(copy, index) {
    const target = copies.length === 1 && copy.chains === null ? mesh
                 : transformed(mesh, copy.matrix, index);
    for (const residue of residues) {
      if (copy.chains === null ||
          copy.chains.has((residue as unknown as RChained).chain().name())) {
        draw(target, residue);
      }
    }
  });
}

export interface DrawOptions {
  // the fill color: one for all rings, or a function of the residue.
  // By default sugars get their SNFG color and other rings grey.
  color?: ColorSpec | ((residue: RResidue) => ColorSpec);
  // the symmetry copies to draw, like pv's render styles' option: 'asym'
  // (the default) or the name of a biological assembly
  showRelated?: string;
}

// fills the rings of all residues in structure (a structure or a selection
// of one) as a custom mesh object called name, and returns it.
function draw(viewer: RViewer, name: string, structure: RStructure,
              options?: DrawOptions): RMesh {
  options = options || {};
  const colorOption = options.color;
  const colorFor = (residue: RResidue): ColorSpec => {
    if (typeof colorOption === 'function') {
      return colorOption(residue);
    }
    if (colorOption !== undefined) {
      return colorOption;
    }
    const sym = snfg.symbol(residue as never);
    return sym !== null ? sym.color : 'grey';
  };
  const mesh = viewer.customMesh(name);
  const ringsOf = new Map<RResidue, RAtom[][]>();
  eachCopy(mesh, structure, options.showRelated, function(target, residue) {
    let rings = ringsOf.get(residue);
    if (rings === undefined) {
      rings = findRings(residue);
      ringsOf.set(residue, rings);
    }
    for (const ring of rings) {
      fillRing(target, ring, colorFor(residue), ring[0]);
    }
  });
  viewer.requestRedraw();
  return mesh;
}

// the base colors: A red, G green, C yellow, U and T blue, as in many
// nucleic-acid viewers; modified bases are colored like their parent (the
// mmCIF reader's 'parentCompId' residue prop), anything else grey.
const BASE_COLORS: Record<string, ColorSpec> = {
  A: [0.90, 0.30, 0.30],
  G: [0.30, 0.72, 0.36],
  C: [0.98, 0.80, 0.25],
  U: [0.30, 0.55, 0.92],
  T: [0.30, 0.55, 0.92],
};

function baseLetter(residue: RResidue): string {
  const parent = residue.prop('parentCompId');
  const name = typeof parent === 'string' ? parent : residue.name();
  // DNA's DA, DG, DC, DT
  return name.length === 2 && name[0] === 'D' ? name[1]! : name;
}

export function baseColor(residue: RResidue): ColorSpec {
  return BASE_COLORS[baseLetter(residue)] ?? 'grey';
}

export interface BaseOptions {
  // the fill color: one for all bases, or a function of the residue
  // (baseColor() by default)
  color?: ColorSpec | ((residue: RResidue) => ColorSpec);
  // whether to join each base to the backbone tube with a stick (false),
  // its radius (0.3), and the radius of the rings' outline (0.12)
  sticks?: boolean;
  stickRadius?: number;
  outlineRadius?: number;
  // the symmetry copies to draw: 'asym' (the default) or an assembly name
  showRelated?: string;
}

// the bases of all nucleotides in structure as filled rings with an
// outline; with options.sticks each on a stick from its C3' (the atom pv's
// nucleic-acid tube runs through) to the base atom bonded to C1' -- N9 of a
// purine, N1 of a pyrimidine, C5 of pseudouridine. Returns the custom mesh
// object.
function drawBases(viewer: RViewer, name: string, structure: RStructure,
                   options?: BaseOptions): RMesh {
  options = options || {};
  const colorOption = options.color;
  const stickRadius = options.stickRadius ?? 0.3;
  const outlineRadius = options.outlineRadius ?? 0.12;
  const mesh = viewer.customMesh(name);
  eachCopy(mesh, structure, options.showRelated, function(target, r) {
    const residue = r as RNucleotide;
    const mesh = target;
    if (!residue.isNucleotide()) {
      return;
    }
    // the base's rings: the residue's rings without an oxygen, i.e. not
    // the ribose
    const rings = findRings(residue).filter((ring) => ring.every((a) => a.element() !== 'O'));
    if (rings.length === 0) {
      return;
    }
    const fill = typeof colorOption === 'function' ? colorOption(residue)
               : colorOption ?? baseColor(residue);
    const c1 = residue.atom('C1\'');
    const c3 = residue.atom('C3\'');
    const inBase = new Set(rings.flat().map((a) => a.full()));
    const glycosidic = c1 === null ? undefined : c1.full().bonds()
      .map((b) => (b.atom_one().full() === c1.full() ? b.atom_two() : b.atom_one()).full())
      .find((a) => inBase.has(a));
    const anchor = glycosidic ?? rings[0]![0]!;
    if (options!.sticks && c3 !== null) {
      mesh.addTube(c3.pos(), anchor.pos(), stickRadius, { color: fill, userData: anchor });
    }
    // the outline along the rings' bonds, the one shared by a purine's two
    // rings only once
    const outlined = new Set<RAtom>();
    for (const ring of rings) {
      fillRing(mesh, ring, fill, anchor);
      for (let i = 0; i < ring.length; ++i) {
        const a = ring[i]!, b = ring[(i + 1) % ring.length]!;
        if (outlined.has(a) && outlined.has(b) && rings.length > 1 && ring !== rings[0]) {
          continue;
        }
        mesh.addTube(a.pos(), b.pos(), outlineRadius, { color: 'grey', userData: anchor });
      }
      ring.forEach((a) => outlined.add(a));
    }
  });
  viewer.requestRedraw();
  return mesh;
}

export default {
  draw,
  drawBases,
  baseColor,
  findRings,
};
