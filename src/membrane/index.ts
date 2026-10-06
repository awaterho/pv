// Membranes, an add-on built only on pv's public API: the lipid bilayer
// around a membrane protein, given as two parallel planes (the boundaries
// of its hydrophobic core, as predicted by e.g. PPM for the OPM database),
// drawn in one of several styles, and a color operation by depth in it.
//
//   pv.membrane.draw(viewer, 'membrane', structure, membrane, { style: 'plane' });
//   viewer.cartoon('protein', structure, { color: pv.membrane.color(membrane) });
//
// The planes are cut out where the protein crosses them without testing
// every point against every atom: only atoms within reach of a plane count,
// and each marks the cells of a grid in the plane it covers (see
// planeGrid()), so the cost grows with the atoms, not atoms x points.
import { vec3 } from 'gl-matrix';
import color, { ColorOp } from '../color';
import mol from '../mol/all';
import { copiesFor } from '../rings/copies';

// only what's used here of pv's atoms, structures (or views) and viewer
interface MAtom {
  pos(): vec3;
  residue(): { chain(): { name(): string } };
}
interface MStructure {
  eachAtom(callback: (atom: MAtom) => void): void;
}
interface MMesh {
  addTriangles(positions: ArrayLike<number>, options?: Record<string, unknown>): void;
  addTube(start: vec3, end: vec3, radius: number, options?: Record<string, unknown>): void;
}
interface MViewer {
  customMesh(name: string, options?: Record<string, unknown>): MMesh;
  points(name: string, structure: unknown, options?: Record<string, unknown>): unknown;
  lines(name: string, structure: unknown, options?: Record<string, unknown>): unknown;
  requestRedraw(): void;
}

type ColorSpec = string | number[];

// the membrane as SWISS-MODEL and others give it: the planes' centers, the
// normal (axis) and the radius of the protein's cross-section in them. The
// width (the distance between the planes) is taken from the centers when
// missing; other fields (energy, viewTransform, ...) are ignored.
export interface Membrane {
  axis: ArrayLike<number>;
  plane_one_center: ArrayLike<number>;
  plane_two_center: ArrayLike<number>;
  radius: number;
  width?: number;
}

// the membrane's coordinate frame: its normal, two directions u and v in
// the planes, the planes' centers and the middle between them
interface Frame {
  normal: vec3;
  u: vec3;
  v: vec3;
  centers: [vec3, vec3];
  middle: vec3;
  halfWidth: number;
}

function frameOf(membrane: Membrane): Frame {
  const normal = vec3.normalize(vec3.create(), membrane.axis as vec3);
  // any direction not along the normal starts the in-plane basis
  const start = Math.abs(normal[1]!) < 0.9 ? vec3.fromValues(0, 1, 0) : vec3.fromValues(0, 0, 1);
  const u = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), normal, start));
  const v = vec3.cross(vec3.create(), normal, u);
  const one = vec3.clone(membrane.plane_one_center as vec3);
  const two = vec3.clone(membrane.plane_two_center as vec3);
  const middle = vec3.lerp(vec3.create(), one, two, 0.5);
  const halfWidth = (membrane.width ?? Math.abs(vec3.dot(vec3.sub(vec3.create(), one, two),
                                                          normal))) / 2;
  return { normal, u, v, centers: [one, two], middle, halfWidth };
}

// the signed distance of pos from the membrane's middle, along its axis:
// within ±width/2 is the hydrophobic core
function depth(membrane: Membrane, pos: ArrayLike<number>): number {
  const frame = frameOf(membrane);
  return (pos[0]! - frame.middle[0]!) * frame.normal[0]! +
         (pos[1]! - frame.middle[1]!) * frame.normal[1]! +
         (pos[2]! - frame.middle[2]!) * frame.normal[2]!;
}

// the atoms' positions, in every symmetry copy of showRelated (see
// rings/copies.ts)
function atomPositions(structure: MStructure, showRelated: string | undefined): Float64Array {
  const copies = copiesFor(structure, showRelated);
  const positions: number[] = [];
  const p = vec3.create();
  structure.eachAtom(function(atom) {
    const chain = atom.residue().chain().name();
    for (const copy of copies) {
      if (copy.chains === null || copy.chains.has(chain)) {
        vec3.transformMat4(p, atom.pos(), copy.matrix);
        positions.push(p[0]!, p[1]!, p[2]!);
      }
    }
  });
  return new Float64Array(positions);
}

// a square grid of points in a plane, spacing step, covering a disc of the
// given radius around center: point (i, j) lies at center + x u + y v with
// x = (i - n) step, y = (j - n) step.
interface Grid {
  center: vec3;
  step: number;
  n: number;
  size: number;
}

function gridFor(center: vec3, radius: number, step: number): Grid {
  const n = Math.ceil(radius / step);
  return { center, step, n, size: 2 * n + 1 };
}

// the point at (x, y) in the plane through center
function planePoint(frame: Frame, center: vec3, x: number, y: number): number[] {
  return [0, 1, 2].map((k) => center[k]! + x * frame.u[k]! + y * frame.v[k]!);
}

// for every grid point, how far inside the protein's cross-section it is:
// the largest reach - d over the atoms, where an atom at height h above
// the plane covers a circle of radius reach = sqrt(r^2 - h^2) in it and d
// is the point's distance from that circle's center. Positive inside,
// -r where no atom reaches. Only atoms within r of the plane are visited,
// each touching the few cells of its circle.
function coverage(positions: Float64Array, frame: Frame, grid: Grid, r: number): Float32Array {
  const { center, step, n, size } = grid;
  const field = new Float32Array(size * size).fill(-r);
  for (let a = 0; a < positions.length; a += 3) {
    const dx = positions[a]! - center[0]!;
    const dy = positions[a + 1]! - center[1]!;
    const dz = positions[a + 2]! - center[2]!;
    const h = dx * frame.normal[0]! + dy * frame.normal[1]! + dz * frame.normal[2]!;
    if (Math.abs(h) >= r) {
      continue;
    }
    const x = dx * frame.u[0]! + dy * frame.u[1]! + dz * frame.u[2]!;
    const y = dx * frame.v[0]! + dy * frame.v[1]! + dz * frame.v[2]!;
    const reach = Math.sqrt(r * r - h * h);
    const i0 = Math.max(0, Math.ceil((x - reach) / step) + n);
    const i1 = Math.min(size - 1, Math.floor((x + reach) / step) + n);
    const j0 = Math.max(0, Math.ceil((y - reach) / step) + n);
    const j1 = Math.min(size - 1, Math.floor((y + reach) / step) + n);
    for (let i = i0; i <= i1; ++i) {
      for (let j = j0; j <= j1; ++j) {
        const du = (i - n) * step - x, dv = (j - n) * step - y;
        const inside = reach - Math.sqrt(du * du + dv * dv);
        const cell = i * size + j;
        if (inside > field[cell]!) {
          field[cell] = inside;
        }
      }
    }
  }
  return field;
}

// calls visit(x, y) for the grid points within radius of its center
// that no atom covers (closer than clearance)
function eachFreePoint(positions: Float64Array, frame: Frame, grid: Grid, radius: number,
                       clearance: number,
                       visit: (x: number, y: number) => void): void {
  const field = coverage(positions, frame, grid, clearance);
  for (let i = 0; i < grid.size; ++i) {
    for (let j = 0; j < grid.size; ++j) {
      const x = (i - grid.n) * grid.step, y = (j - grid.n) * grid.step;
      if (x * x + y * y <= radius * radius && field[i * grid.size + j]! < 0) {
        visit(x, y);
      }
    }
  }
}

// the closed outlines where field crosses 0 (marching squares), as loops of
// in-plane (x, y) points. The grid's border counts as outside, so every
// outline closes.
function outlines(field: Float32Array, grid: Grid): number[][][] {
  const { size, step, n } = grid;
  const value = (i: number, j: number): number =>
    i <= 0 || j <= 0 || i >= size - 1 || j >= size - 1 ? -1 : field[i * size + j]!;
  // the crossing on each cell edge: horizontal edge (i, j)-(i + 1, j) has
  // id i * size + j, vertical edge (i, j)-(i, j + 1) that plus size^2
  const crossing = (edge: number): number[] => {
    const vertical = edge >= size * size;
    const e = vertical ? edge - size * size : edge;
    const i = Math.floor(e / size), j = e % size;
    const i2 = vertical ? i : i + 1, j2 = vertical ? j + 1 : j;
    const a = value(i, j), b = value(i2, j2);
    const t = a / (a - b);
    return [(i + t * (i2 - i) - n) * step, (j + t * (j2 - j) - n) * step];
  };
  const links = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    (links.get(a) ?? links.set(a, []).get(a)!).push(b);
    (links.get(b) ?? links.set(b, []).get(b)!).push(a);
  };
  for (let i = 0; i < size - 1; ++i) {
    for (let j = 0; j < size - 1; ++j) {
      const inside = [value(i, j) > 0, value(i + 1, j) > 0,
                      value(i + 1, j + 1) > 0, value(i, j + 1) > 0];
      // the cell's edges, in order around it: bottom, right, top, left
      const edges = [i * size + j, size * size + (i + 1) * size + j,
                     i * size + j + 1, size * size + i * size + j];
      const crossed = [0, 1, 2, 3].filter((k) => inside[k] !== inside[(k + 1) % 4]);
      if (crossed.length === 2) {
        link(edges[crossed[0]!]!, edges[crossed[1]!]!);
      } else if (crossed.length === 4) {
        // a saddle: the corners inside are joined when the middle is
        const middle = (value(i, j) + value(i + 1, j) + value(i + 1, j + 1) + value(i, j + 1)) / 4;
        if ((middle > 0) === inside[0]) {
          link(edges[0]!, edges[1]!);
          link(edges[2]!, edges[3]!);
        } else {
          link(edges[3]!, edges[0]!);
          link(edges[1]!, edges[2]!);
        }
      }
    }
  }
  const loops: number[][][] = [];
  const seen = new Set<number>();
  for (const start of links.keys()) {
    if (seen.has(start)) {
      continue;
    }
    const loop: number[][] = [];
    let previous = -1, current = start;
    while (!seen.has(current)) {
      seen.add(current);
      loop.push(crossing(current));
      const next = links.get(current)!.find((e) => e !== previous && !seen.has(e));
      if (next === undefined) {
        break;
      }
      previous = current;
      current = next;
    }
    loops.push(loop);
  }
  return loops;
}

function loopLength(loop: number[][]): number {
  let length = 0;
  for (let k = 0; k < loop.length; ++k) {
    const a = loop[k]!, b = loop[(k + 1) % loop.length]!;
    length += Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
  }
  return length;
}

// Chaikin's corner cutting on a closed loop: each pass rounds the corners
function smoothLoop(loop: number[][], passes: number): number[][] {
  for (let p = 0; p < passes; ++p) {
    const smoothed: number[][] = [];
    for (let k = 0; k < loop.length; ++k) {
      const a = loop[k]!, b = loop[(k + 1) % loop.length]!;
      smoothed.push([0.75 * a[0]! + 0.25 * b[0]!, 0.75 * a[1]! + 0.25 * b[1]!],
                    [0.25 * a[0]! + 0.75 * b[0]!, 0.25 * a[1]! + 0.75 * b[1]!]);
    }
    loop = smoothed;
  }
  return loop;
}

// the points of a circle of the given radius in a plane of the membrane
function circle(radius: number, segments: number): number[][] {
  const points: number[][] = [];
  for (let k = 0; k < segments; ++k) {
    const phi = 2 * Math.PI * k / segments;
    points.push([radius * Math.cos(phi), radius * Math.sin(phi)]);
  }
  return points;
}

// a smooth-shaded tube along a closed loop of in-plane points around
// center, as one shape of mesh
function addLoopTube(mesh: MMesh, frame: Frame, center: vec3, loop: number[][], radius: number,
                     tubeColor: ColorSpec): void {
  const sides = 8;
  const count = loop.length;
  const ring: number[][][] = [];
  const ringNormals: number[][][] = [];
  for (let k = 0; k < count; ++k) {
    const before = loop[(k + count - 1) % count]!, after = loop[(k + 1) % count]!;
    // the tangent, and the side direction in the plane, across it
    const tx = after[0]! - before[0]!, ty = after[1]! - before[1]!;
    const tl = Math.hypot(tx, ty) || 1;
    const sx = ty / tl, sy = -tx / tl;
    const p = planePoint(frame, center, loop[k]![0]!, loop[k]![1]!);
    const points: number[][] = [];
    const normals: number[][] = [];
    for (let s = 0; s < sides; ++s) {
      const theta = 2 * Math.PI * s / sides;
      const c = Math.cos(theta), sn = Math.sin(theta);
      const dir = [0, 1, 2].map((d) => c * frame.normal[d]! +
                                       sn * (sx * frame.u[d]! + sy * frame.v[d]!));
      points.push([p[0]! + radius * dir[0]!, p[1]! + radius * dir[1]!, p[2]! + radius * dir[2]!]);
      normals.push(dir);
    }
    ring.push(points);
    ringNormals.push(normals);
  }
  const positions: number[] = [];
  const normals: number[] = [];
  const corner = (k: number, s: number) => {
    positions.push(...ring[k % count]![s % sides]!);
    normals.push(...ringNormals[k % count]![s % sides]!);
  };
  for (let k = 0; k < count; ++k) {
    for (let s = 0; s < sides; ++s) {
      // counter-clockwise seen from outside: the side direction follows
      // the tangent, so this holds whichever way the loop runs
      corner(k, s); corner(k, s + 1); corner(k + 1, s);
      corner(k, s + 1); corner(k + 1, s + 1); corner(k + 1, s);
    }
  }
  mesh.addTriangles(positions, { color: tubeColor, normals });
}

// a flat ring (annulus) between radii r0 < r1 in a plane of the membrane,
// seen from both sides, with one color for each of its bands; r0 = 0 is a
// disc. Returns the positions, normals and per-triangle colors to add.
function addAnnulus(out: { positions: number[]; normals: number[]; colors: ColorSpec[] },
                    frame: Frame, center: vec3, x: number, y: number, r0: number, r1: number,
                    segments: number, bandColor: ColorSpec): void {
  const point = (r: number, k: number): number[] => {
    const phi = 2 * Math.PI * k / segments;
    return planePoint(frame, center, x + r * Math.cos(phi), y + r * Math.sin(phi));
  };
  const n = [frame.normal[0]!, frame.normal[1]!, frame.normal[2]!];
  const back = [-n[0]!, -n[1]!, -n[2]!];
  const triangle = (a: number[], b: number[], c: number[]) => {
    // counter-clockwise seen from the side the normal points to, then the
    // same triangle the other way round for the back
    out.positions.push(...a, ...b, ...c, ...a, ...c, ...b);
    out.normals.push(...n, ...n, ...n, ...back, ...back, ...back);
    out.colors.push(bandColor, bandColor);
  };
  for (let k = 0; k < segments; ++k) {
    const a0 = point(r0, k), a1 = point(r0, k + 1);
    const b0 = point(r1, k), b1 = point(r1, k + 1);
    triangle(a0, b0, b1);
    if (r0 > 0) {
      triangle(a0, b1, a1);
    }
  }
}

export type Style = 'dots' | 'flatDots' | 'plane' | 'slab' | 'rings';

export interface DrawOptions {
  // 'dots' (the default): a grid of points on each plane, cut out
  // where the protein crosses it. 'flatDots': a finer grid of flat dots
  // fading towards the edge. 'plane': translucent discs, with the outline
  // of the protein's cross-section in each. 'slab': a translucent cylinder
  // filling the space between the planes. 'rings': a circle on each plane
  // and the membrane's axis as an arrow.
  style?: Style;
  // the main color, and for 'plane' the outline's (lineColor) -- each
  // style has its own defaults
  color?: ColorSpec;
  lineColor?: ColorSpec;
  // the radius of what's drawn of each plane, by default the membrane's
  // radius + 8 Å
  radius?: number;
  // the grid's spacing in Å for the dot styles (2.25 for 'dots', 1.5 for
  // 'flatDots'), and how close to an atom a dot may lie (3.5 Å)
  spacing?: number;
  clearance?: number;
  // the size of the points of 'dots', in pixels (2), and the width of
  // the outline of 'plane' (8)
  pointSize?: number;
  lineWidth?: number;
  // the symmetry copies of structure that cut the membrane, like pv's
  // render styles' option: 'asym' (the default) or the name of a
  // biological assembly
  showRelated?: string;
}

const DEFAULT_COLORS: Record<Style, ColorSpec> = {
  dots: '#8b8b8b',
  flatDots: '#888',
  plane: '#3b82f6',
  slab: '#f6d7a7',
  rings: '#5546b0',
};

function drawDots(viewer: MViewer, name: string, positions: Float64Array, frame: Frame,
                  radius: number, options: DrawOptions): unknown {
  const step = options.spacing ?? 2.25;
  const dots = new mol.Mol();
  const residue = dots.addChain('M').addResidue('MEM', 1);
  for (const center of frame.centers) {
    const grid = gridFor(center, radius, step);
    eachFreePoint(positions, frame, grid, radius, options.clearance ?? 3.5, function(x, y) {
      residue.addAtom('M', planePoint(frame, center, x, y) as vec3, 'C');
    });
  }
  return viewer.points(name, dots, {
    color: color.uniform(options.color ?? DEFAULT_COLORS.dots),
    pointSize: options.pointSize ?? 2,
  });
}

function drawFlatDots(viewer: MViewer, name: string, positions: Float64Array, frame: Frame,
                      radius: number, options: DrawOptions): MMesh {
  const step = options.spacing ?? 1.5;
  const rgb = color.forceRGB((options.color ?? DEFAULT_COLORS.flatDots) as never);
  const out = { positions: [] as number[], normals: [] as number[], colors: [] as ColorSpec[] };
  for (const center of frame.centers) {
    const grid = gridFor(center, radius, step);
    eachFreePoint(positions, frame, grid, radius, options.clearance ?? 3.5, function(x, y) {
      // opaque in the middle, fading out towards the edge
      const alpha = 1 - (x * x + y * y) / (radius * radius);
      if (alpha > 0.05) {
        addAnnulus(out, frame, center, x, y, 0, 0.4 * step, 6,
                   [rgb[0]!, rgb[1]!, rgb[2]!, Math.min(1, 1.3 * alpha)]);
      }
    });
  }
  const mesh = viewer.customMesh(name);
  mesh.addTriangles(out.positions, { normals: out.normals, triangleColors: out.colors });
  return mesh;
}

function drawPlanes(viewer: MViewer, name: string, positions: Float64Array, frame: Frame,
                    radius: number, options: DrawOptions): MMesh {
  const mesh = viewer.customMesh(name);
  const rgb = color.forceRGB((options.color ?? DEFAULT_COLORS.plane) as never);
  const outline = new mol.Mol();
  const outlineChain = outline.addChain('O');
  const bands = 8;
  for (const center of frame.centers) {
    // the disc in bands, stronger in the middle; drawn translucent, it
    // tints what lies behind it and leaves what's in front clear
    const out = { positions: [] as number[], normals: [] as number[], colors: [] as ColorSpec[] };
    for (let b = 0; b < bands; ++b) {
      const alpha = 0.6 * (1 - b / bands);
      addAnnulus(out, frame, center, 0, 0, radius * b / bands, radius * (b + 1) / bands, 72,
                 [rgb[0]!, rgb[1]!, rgb[2]!, alpha]);
    }
    mesh.addTriangles(out.positions, { normals: out.normals, triangleColors: out.colors });
    // where the protein crosses the plane: the outline of the atoms'
    // cross-section, each atom grown to 3 Å so the outline wraps the
    // protein rather than every atom, leaving out holes and specks. Each
    // closed loop becomes a ring of bonded atoms, drawn by the lines style.
    const grid = gridFor(center, radius, 0.75);
    const field = coverage(positions, frame, grid, 3);
    for (const loop of outlines(field, grid)) {
      if (loopLength(loop) <= 15) {
        continue;
      }
      const residue = outlineChain.addResidue('OUT', outlineChain.residues().length + 1);
      const atoms = smoothLoop(loop, 2).map((p) =>
        residue.addAtom('O', planePoint(frame, center, p[0]!, p[1]!) as vec3, 'C'));
      atoms.forEach((atom, k) => {
        outline.connect(atom as never, atoms[(k + 1) % atoms.length] as never);
      });
    }
  }
  viewer.lines(name + '.outline', outline, {
    color: color.uniform(options.lineColor ?? '#445482'),
    lineWidth: options.lineWidth ?? 4,
  });
  return mesh;
}

function drawSlab(viewer: MViewer, name: string, frame: Frame, radius: number,
                  options: DrawOptions): MMesh {
  const mesh = viewer.customMesh(name);
  const rgb = color.forceRGB((options.color ?? DEFAULT_COLORS.slab) as never);
  const fill = [rgb[0]!, rgb[1]!, rgb[2]!, 0.3];
  const segments = 96;
  // the plane further along the normal first, which makes the wall's
  // triangles below counter-clockwise seen from outside
  const [one, two] = frame.centers;
  const [top, bottom] = vec3.dot(vec3.sub(vec3.create(), one, two), frame.normal) > 0 ?
    [one, two] : [two, one];
  const positions: number[] = [];
  const normals: number[] = [];
  for (let k = 0; k < segments; ++k) {
    const corners: number[][] = [];
    const dirs: number[][] = [];
    for (const kk of [k, k + 1]) {
      const phi = 2 * Math.PI * kk / segments;
      const x = Math.cos(phi), y = Math.sin(phi);
      dirs.push([0, 1, 2].map((d) => x * frame.u[d]! + y * frame.v[d]!));
      corners.push(planePoint(frame, top, radius * x, radius * y),
                   planePoint(frame, bottom, radius * x, radius * y));
    }
    const [a0, b0, a1, b1] = corners as [number[], number[], number[], number[]];
    const [n0, n1] = dirs as [number[], number[]];
    const m0 = n0.map((c) => -c), m1 = n1.map((c) => -c);
    // the wall, outside then inside
    positions.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
    normals.push(...n0, ...n0, ...n1, ...n0, ...n1, ...n1);
    positions.push(...a0, ...b1, ...b0, ...a0, ...a1, ...b1);
    normals.push(...m0, ...m1, ...m0, ...m0, ...m1, ...m1);
  }
  mesh.addTriangles(positions, { color: fill, normals });
  for (const center of frame.centers) {
    const out = { positions: [] as number[], normals: [] as number[], colors: [] as ColorSpec[] };
    addAnnulus(out, frame, center, 0, 0, 0, radius, segments, fill);
    mesh.addTriangles(out.positions, { normals: out.normals, triangleColors: out.colors });
    addLoopTube(mesh, frame, center, circle(radius, segments), 0.25,
                options.lineColor ?? '#c8862a');
  }
  return mesh;
}

function drawRings(viewer: MViewer, name: string, frame: Frame, radius: number,
                   options: DrawOptions): MMesh {
  const mesh = viewer.customMesh(name);
  const ringColor = options.color ?? DEFAULT_COLORS.rings;
  for (const center of frame.centers) {
    addLoopTube(mesh, frame, center, circle(radius, 96), 0.35, ringColor);
  }
  // the axis through the middle, reaching well out of the membrane, with
  // an arrowhead in the direction of the axis
  const reach = frame.halfWidth + 20;
  const along = (t: number): vec3 => vec3.scaleAndAdd(vec3.create(), frame.middle, frame.normal, t);
  const headLength = 4, headRadius = 1.4;
  mesh.addTube(along(-reach), along(reach - headLength), 0.35, { color: ringColor });
  const tip = along(reach), base = along(reach - headLength);
  const cone: number[] = [];
  const segments = 16;
  const rim = (k: number): number[] => {
    const phi = 2 * Math.PI * k / segments;
    return [0, 1, 2].map((d) => base[d]! + headRadius * (Math.cos(phi) * frame.u[d]! +
                                                        Math.sin(phi) * frame.v[d]!));
  };
  for (let k = 0; k < segments; ++k) {
    // the side, then the base facing back
    cone.push(...rim(k), ...rim(k + 1), tip[0]!, tip[1]!, tip[2]!);
    cone.push(...rim(k + 1), ...rim(k), base[0]!, base[1]!, base[2]!);
  }
  mesh.addTriangles(cone, { color: ringColor });
  return mesh;
}

// draws membrane around structure (whose atoms cut out the dot styles and
// make the outline of 'plane') as a render object called name, and returns
// it: a custom mesh, or for 'dots' the points of a structure of its own.
// 'plane' adds its outline as a second object, lines called name.outline,
// so viewer.rm(name + '*') removes both.
function draw(viewer: MViewer, name: string, structure: MStructure, membrane: Membrane,
              options?: DrawOptions): unknown {
  options = options || {};
  const frame = frameOf(membrane);
  const radius = options.radius ?? membrane.radius + 8;
  const style = options.style ?? 'dots';
  let obj: unknown;
  if (style === 'slab') {
    obj = drawSlab(viewer, name, frame, radius, options);
  } else if (style === 'rings') {
    obj = drawRings(viewer, name, frame, radius, options);
  } else {
    const positions = atomPositions(structure, options.showRelated);
    if (style === 'flatDots') {
      obj = drawFlatDots(viewer, name, positions, frame, radius, options);
    } else if (style === 'plane') {
      obj = drawPlanes(viewer, name, positions, frame, radius, options);
    } else {
      obj = drawDots(viewer, name, positions, frame, radius, options);
    }
  }
  viewer.requestRedraw();
  return obj;
}

export interface ColorOptions {
  // the colors of the hydrophobic core, of the headgroup layers on either
  // side of it, and their thickness (5 Å)
  core?: ColorSpec;
  headgroups?: ColorSpec;
  headgroupWidth?: number;
}

// a color operation by depth in the membrane: atoms in the hydrophobic core
// light orange, in the headgroup layers red, and the others by others
// (default light grey)
function membraneColor(membrane: Membrane, others?: ColorOp, options?: ColorOptions): ColorOp {
  options = options || {};
  const fallback = others || color.uniform('lightgrey');
  const frame = frameOf(membrane);
  const core = color.forceRGB((options.core ?? '#f8c471') as never);
  const headgroups = color.forceRGB((options.headgroups ?? '#d9542b') as never);
  const outer = frame.halfWidth + (options.headgroupWidth ?? 5);
  return new ColorOp(function(atom, out, index) {
    const p = (atom as unknown as MAtom).pos();
    const h = Math.abs((p[0]! - frame.middle[0]!) * frame.normal[0]! +
                       (p[1]! - frame.middle[1]!) * frame.normal[1]! +
                       (p[2]! - frame.middle[2]!) * frame.normal[2]!);
    if (h >= outer) {
      fallback.colorFor(atom, out, index);
      return;
    }
    const c = h < frame.halfWidth ? core : headgroups;
    out[index + 0] = c[0]!;
    out[index + 1] = c[1]!;
    out[index + 2] = c[2]!;
    out[index + 3] = 1.0;
  }, function(obj) {
    fallback.begin(obj);
  }, function() {
    fallback.end();
  });
}

export default {
  draw,
  color: membraneColor,
  depth,
};
