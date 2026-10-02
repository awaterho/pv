// 3D-SNFG glycan display, an add-on built only on pv's public API: a
// symbol (sphere, cube, cone, diamond, ...) in the SNFG shape and color
// for every sugar residue, centered and laid flat on its ring, with sticks
// along the glycosidic links and to the amino acid the glycan is attached
// to. Plus an SNFG color scheme for coloring the sugars' atoms the same
// way in any other representation.
//
//   pv.snfg.draw(viewer, 'glycans', structure);
//   viewer.ballsAndSticks('sugars', structure.select('carbohydrate'),
//                         { color: pv.snfg.color() });
import { vec3 } from 'gl-matrix';
import color, { ColorOp } from '../color';
import { shapeGeometry } from './shapes';
import { symbolFor, CCD_TO_SNFG, COLORS, type SnfgSymbol } from './symbols';
import { findRings } from '../rings/find';
import { copiesFor, transformed } from '../rings/copies';

// only what's used here of pv's atoms, residues and structures (or views)
interface SAtom {
  name(): string;
  element(): string;
  pos(): vec3;
  residue(): SResidue;
  bonds(): { atom_one(): SAtom; atom_two(): SAtom }[];
  full(): SAtom;
}
interface SResidue {
  name(): string;
  chain(): { name(): string };
  atoms(): SAtom[];
  prop(name: string): unknown;
  full(): SResidue;
}
interface SStructure {
  eachResidue(callback: (residue: SResidue) => void): void;
}
interface SMesh {
  addSphere(center: vec3, radius: number, options?: Record<string, unknown>): void;
  addTube(start: vec3, end: vec3, radius: number, options?: Record<string, unknown>): void;
  addTriangles(positions: ArrayLike<number>, options?: Record<string, unknown>): void;
}
interface SViewer {
  customMesh(name: string, options?: Record<string, unknown>): SMesh;
  requestRedraw(): void;
}

// the residue's SNFG name ('GlcNAc', ...): the one its mmCIF file gave
// (the reader's 'snfg' prop), else the one for its PDB component id.
// Undefined for residues that aren't sugars; null for sugars SNFG has no
// symbol for.
export function snfgName(residue: SResidue): string | null | undefined {
  const fromFile = residue.prop('snfg');
  if (typeof fromFile === 'string' && fromFile !== '') {
    return fromFile;
  }
  const fromCcd = CCD_TO_SNFG[residue.name()];
  if (fromCcd !== undefined) {
    return fromCcd;
  }
  return residue.prop('isCarbohydrate') === true ? null : undefined;
}

export function isSugar(residue: SResidue): boolean {
  return snfgName(residue) !== undefined;
}

// the SNFG symbol of a sugar residue, or null for anything else
export function symbol(residue: SResidue): SnfgSymbol | null {
  const name = snfgName(residue);
  return name === undefined ? null : symbolFor(name);
}

// colors the atoms of sugars by their SNFG color, everything else with
// otherAtoms (by element when not given).
function snfgColor(otherAtoms?: ColorOp): ColorOp {
  const fallback = otherAtoms || color.byElement();
  return new ColorOp(function(atom, out, index) {
    const sym = symbol((atom as unknown as SAtom).residue());
    if (sym === null) {
      fallback.colorFor(atom, out, index);
      return;
    }
    out[index + 0] = sym.color[0];
    out[index + 1] = sym.color[1];
    out[index + 2] = sym.color[2];
    out[index + 3] = 1.0;
  }, function(obj) {
    fallback.begin(obj);
  }, function() {
    fallback.end();
  });
}

interface RingFrame {
  center: vec3;
  // y along the symbol, pointing away from the sugar's parent: a cone's
  // tip, the SNFG triangle's apex, points along +y. z is the ring normal
  // made perpendicular to y, and x completes the frame, so flat symbols lie
  // about in the ring's plane.
  x: vec3;
  y: vec3;
  z: vec3;
  // the anomeric carbon (C1, or C2 of sialic acids and other ulosonic
  // acids), and the atom of the parent residue it's bonded to, if any
  anomeric: SAtom | null;
  parentAtom: SAtom | null;
  // the atom picking the symbol returns, so a hover or click can be
  // treated like one on the residue's atoms
  atom: SAtom;
}

// the sugar ring: a 5- or 6-membered ring with a single oxygen, rotated
// to start at that oxygen
function findRing(residue: SResidue): SAtom[] | null {
  for (const ring of findRings(residue as never, 6) as unknown as SAtom[][]) {
    const oxygens = ring.filter((a) => a.element() === 'O');
    if (ring.length >= 5 && oxygens.length === 1) {
      const start = ring.indexOf(oxygens[0]!);
      return ring.slice(start).concat(ring.slice(0, start));
    }
  }
  return null;
}

function neighbors(atom: SAtom): SAtom[] {
  return atom.bonds().map((bond) => {
    const a = bond.atom_one().full();
    return a === atom ? bond.atom_two().full() : a;
  });
}

// the anomeric carbon is one of the two ring carbons next to the ring
// oxygen: the one bonded to another residue (the glycosidic bond to its
// parent: a parent sugar's oxygen, or the Asn ND2/Ser OG of the protein),
// else the one carrying a second oxygen or nitrogen (a free reducing end,
// a methyl glycoside), else the one named C1 or C2.
function findAnomeric(ring: SAtom[], residue: SResidue): { anomeric: SAtom | null; parentAtom: SAtom | null } {
  const candidates = [ring[1]!, ring[ring.length - 1]!].filter((a) => a.element() === 'C');
  for (const c of candidates) {
    const outside = neighbors(c).find((n) => n.residue().full() !== residue && n.element() !== 'H');
    if (outside !== undefined) {
      return { anomeric: c, parentAtom: outside };
    }
  }
  for (const c of candidates) {
    const heteroatoms = neighbors(c).filter((n) => n !== ring[0] &&
      (n.element() === 'O' || n.element() === 'N'));
    if (heteroatoms.length > 0) {
      return { anomeric: c, parentAtom: null };
    }
  }
  const named = candidates.find((c) => c.name() === 'C1' || c.name() === 'C2');
  return { anomeric: named || null, parentAtom: null };
}

// the frame's center, normal and anomeric carbon; its in-plane axes are
// set by orient() once the frames of all sugars (the parents) are known.
function ringFrame(residue: SResidue): RingFrame | null {
  const ring = findRing(residue);
  const atoms = ring || residue.atoms().map((a) => a.full())
    .filter((a) => a.element() !== 'H');
  if (atoms.length === 0) {
    return null;
  }
  const center = vec3.create();
  for (const a of atoms) {
    vec3.add(center, center, a.pos());
  }
  vec3.scale(center, center, 1 / atoms.length);
  const z = vec3.create();
  if (ring !== null) {
    // the ring's normal from the cross products of consecutive atoms
    const u = vec3.create();
    const v = vec3.create();
    const cross = vec3.create();
    for (let i = 0; i < ring.length; ++i) {
      vec3.sub(u, ring[i]!.pos(), center);
      vec3.sub(v, ring[(i + 1) % ring.length]!.pos(), center);
      vec3.add(z, z, vec3.cross(cross, u, v));
    }
  }
  if (vec3.length(z) < 1e-6) {
    vec3.set(z, 0, 0, 1);
  }
  vec3.normalize(z, z);
  const { anomeric, parentAtom } = ring !== null ? findAnomeric(ring, residue)
                                                 : { anomeric: null, parentAtom: null };
  return {
    center, z, x: vec3.create(), y: vec3.create(), anomeric, parentAtom,
    atom: ring !== null ? ring[0]! : atoms[0]!,
  };
}

// points the frame's -y (the symbol's base) straight at its parent, along
// the stick drawn to it: the parent sugar's center, or the protein atom the
// glycan is attached to. A sugar without a parent faces its own anomeric
// carbon, the same side, and one without a known anomeric carbon faces its
// ring oxygen. Like Mol*, which aims its symbols at a linked sugar too.
function orient(frame: RingFrame, frames: Map<SResidue, RingFrame>): void {
  const target = vec3.create();
  if (frame.parentAtom !== null) {
    const parentFrame = frames.get(frame.parentAtom.residue().full());
    vec3.copy(target, parentFrame !== undefined ? parentFrame.center : frame.parentAtom.pos());
  } else if (frame.anomeric !== null) {
    vec3.copy(target, frame.anomeric.pos());
  } else {
    vec3.copy(target, frame.atom.pos());
  }
  const { center, x, y, z } = frame;
  vec3.sub(y, center, target);
  if (vec3.length(y) < 1e-6) {
    vec3.cross(y, z, Math.abs(z[0]!) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
  }
  vec3.normalize(y, y);
  vec3.scaleAndAdd(z, z, y, -vec3.dot(z, y));
  if (vec3.length(z) < 1e-6) {
    // the parent is straight above or below the ring
    vec3.cross(z, y, Math.abs(y[0]!) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
  }
  vec3.normalize(z, z);
  vec3.cross(x, y, z);
}

export interface DrawOptions {
  // the symbols' size, about their radius in Angstrom (default 1.5)
  size?: number;
  // radius and color of the sticks along the links (0.2, grey)
  linkRadius?: number;
  linkColor?: string | number[];
  // the symmetry copies to draw, like pv's render styles' option: 'asym'
  // (the default) or the name of a biological assembly
  showRelated?: string;
}

// draws the SNFG symbols of all sugars in structure (a structure or a
// selection of one) as a custom mesh object called name, and returns it.
function draw(viewer: SViewer, name: string, structure: SStructure,
              options?: DrawOptions): SMesh {
  options = options || {};
  const size = options.size ?? 1.5;
  const linkRadius = options.linkRadius ?? 0.2;
  const linkColor = options.linkColor ?? 'grey';
  const mesh = viewer.customMesh(name);

  const frames = new Map<SResidue, RingFrame>();
  const order = new Map<SResidue, number>();
  structure.eachResidue(function(r) {
    const residue = r.full();
    if (!isSugar(residue)) {
      return;
    }
    const frame = ringFrame(residue);
    if (frame !== null) {
      frames.set(residue, frame);
      order.set(residue, order.size);
    }
  });

  frames.forEach((frame) => orient(frame, frames));

  // the symbols and sticks, once per symmetry copy that covers the
  // sugar's chain
  copiesFor(structure, options.showRelated).forEach(function(copy, index) {
    const target = copy.chains === null ? mesh : transformed(mesh, copy.matrix, index);
    const inCopy = (residue: SResidue) =>
      copy.chains === null || copy.chains.has(residue.chain().name());
    addSymbols(target, frames, inCopy, size);
    addLinks(target, frames, order, inCopy, linkRadius, linkColor);
  });
  viewer.requestRedraw();
  return mesh;
}

function addSymbols(mesh: SMesh, frames: Map<SResidue, RingFrame>,
                    inCopy: (residue: SResidue) => boolean, size: number): void {
  frames.forEach(function(frame, residue) {
    if (!inCopy(residue)) {
      return;
    }
    const sym = symbol(residue)!;
    const geometry = shapeGeometry(sym.shape);
    const positions: number[] = [];
    const normals: number[] = [];
    const triangleColors: number[][] = [];
    const p = vec3.create();
    for (const tri of geometry.triangles) {
      for (const v of tri) {
        vec3.zero(p);
        vec3.scaleAndAdd(p, p, frame.x, v[0]);
        vec3.scaleAndAdd(p, p, frame.y, v[1]);
        vec3.scaleAndAdd(p, p, frame.z, v[2]);
        normals.push(p[0]!, p[1]!, p[2]!);
        vec3.scaleAndAdd(p, frame.center, p, size);
        positions.push(p[0]!, p[1]!, p[2]!);
      }
      const white = geometry.colored !== undefined && !geometry.colored(tri);
      triangleColors.push(white ? COLORS.white : sym.color);
    }
    mesh.addTriangles(positions, {
      triangleColors,
      normals: geometry.smooth ? normals : undefined,
      userData: frame.atom,
    });
  });
}

// the sticks: between the centers of two linked sugars, and from a sugar's
// center to the atom of whatever else it's bonded to (the Asn ND2 of an
// N-glycan, the Ser/Thr OG of an O-glycan)
function addLinks(mesh: SMesh, frames: Map<SResidue, RingFrame>,
                  order: Map<SResidue, number>, inCopy: (residue: SResidue) => boolean,
                  linkRadius: number, linkColor: string | number[]): void {
  frames.forEach(function(frame, residue) {
    if (!inCopy(residue)) {
      return;
    }
    for (const atom of residue.atoms()) {
      for (const bond of atom.full().bonds()) {
        const a = bond.atom_one().full();
        const other = a === atom.full() ? bond.atom_two().full() : a;
        const otherResidue = other.residue().full();
        if (otherResidue === residue) {
          continue;
        }
        const otherFrame = frames.get(otherResidue);
        if (otherFrame !== undefined) {
          // once per pair of sugars
          if (order.get(residue)! < order.get(otherResidue)!) {
            mesh.addTube(frame.center, otherFrame.center, linkRadius, { color: linkColor });
          }
        } else {
          mesh.addTube(frame.center, other.pos(), linkRadius, { color: linkColor });
        }
      }
    }
  });
}

export default {
  draw,
  color: snfgColor,
  symbol,
  snfgName,
  isSugar,
};
