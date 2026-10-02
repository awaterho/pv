// Triangle geometry for the 3D SNFG shapes, built around the origin in a
// local frame -- x and y in the sugar ring's plane, z along its normal --
// and handed to customMesh.addTriangles() once placed.
import { vec3 } from 'gl-matrix';
import type { Shape } from './symbols';

type Vec = [number, number, number];
type Tri = [Vec, Vec, Vec];

// fixes the winding so the face is counter-clockwise seen from outside.
// All shapes here are star-shaped around the origin, so "outside" is away
// from it.
function outward(tri: Tri): Tri {
  const [a, b, c] = tri;
  const n = vec3.cross(vec3.create(),
                       vec3.sub(vec3.create(), b, a), vec3.sub(vec3.create(), c, a));
  const m = [a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]];
  return vec3.dot(n, m as Vec) < 0 ? [a, c, b] : tri;
}

// a polygon in the xy plane (around the origin), extruded to +-halfDepth
function prism(polygon: [number, number][], halfDepth: number): Tri[] {
  const tris: Tri[] = [];
  const n = polygon.length;
  for (let i = 0; i < n; ++i) {
    const [x0, y0] = polygon[i]!;
    const [x1, y1] = polygon[(i + 1) % n]!;
    tris.push([[0, 0, halfDepth], [x0, y0, halfDepth], [x1, y1, halfDepth]]);
    tris.push([[0, 0, -halfDepth], [x0, y0, -halfDepth], [x1, y1, -halfDepth]]);
    tris.push([[x0, y0, -halfDepth], [x1, y1, -halfDepth], [x1, y1, halfDepth]]);
    tris.push([[x0, y0, -halfDepth], [x1, y1, halfDepth], [x0, y0, halfDepth]]);
  }
  return tris;
}

function regularPolygon(corners: number, radius: number, startAngle: number): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < corners; ++i) {
    const angle = startAngle + i * 2 * Math.PI / corners;
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return points;
}

function box(hx: number, hy: number, hz: number): Tri[] {
  // the top and bottom faces are split along their x = y diagonal, which
  // the crossed cube's two colors follow
  const tris: Tri[] = [];
  for (const z of [hz, -hz]) {
    tris.push([[-hx, -hy, z], [hx, -hy, z], [hx, hy, z]]);
    tris.push([[-hx, -hy, z], [hx, hy, z], [-hx, hy, z]]);
  }
  const corners: [number, number][] = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]];
  for (let i = 0; i < 4; ++i) {
    const [x0, y0] = corners[i]!;
    const [x1, y1] = corners[(i + 1) % 4]!;
    tris.push([[x0, y0, -hz], [x1, y1, -hz], [x1, y1, hz]]);
    tris.push([[x0, y0, -hz], [x1, y1, hz], [x0, y0, hz]]);
  }
  return tris;
}

// pointing along +y, the way the SNFG triangle points up; the base circle
// starts at angle 0 so no triangle straddles the x = 0 split of the
// divided cone.
function cone(radius: number, halfHeight: number, segments: number): Tri[] {
  const tris: Tri[] = [];
  const apex: Vec = [0, halfHeight, 0];
  const baseCenter: Vec = [0, -halfHeight, 0];
  for (let i = 0; i < segments; ++i) {
    const a0 = i * 2 * Math.PI / segments;
    const a1 = (i + 1) * 2 * Math.PI / segments;
    const p0: Vec = [radius * Math.cos(a0), -halfHeight, radius * Math.sin(a0)];
    const p1: Vec = [radius * Math.cos(a1), -halfHeight, radius * Math.sin(a1)];
    tris.push([apex, p0, p1]);
    tris.push([baseCenter, p1, p0]);
  }
  return tris;
}

function octahedron(hx: number, hy: number, hz: number): Tri[] {
  const tris: Tri[] = [];
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) {
        tris.push([[sx * hx, 0, 0], [0, sy * hy, 0], [0, 0, sz * hz]]);
      }
    }
  }
  return tris;
}

// a smooth unit sphere; its vertex normals are its vertex positions
function sphere(stacks: number, slices: number): Tri[] {
  const point = (i: number, j: number): Vec => {
    const theta = Math.PI * i / stacks;
    const phi = 2 * Math.PI * j / slices;
    return [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
  };
  const tris: Tri[] = [];
  for (let i = 0; i < stacks; ++i) {
    for (let j = 0; j < slices; ++j) {
      const a = point(i, j), b = point(i + 1, j);
      const c = point(i + 1, j + 1), d = point(i, j + 1);
      if (i !== 0) {
        tris.push([a, b, d]);
      }
      if (i !== stacks - 1) {
        tris.push([b, c, d]);
      }
    }
  }
  return tris;
}

function star(outer: number, inner: number, halfDepth: number): Tri[] {
  const points: [number, number][] = [];
  for (let i = 0; i < 10; ++i) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = Math.PI / 2 + i * Math.PI / 5;
    points.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }
  return prism(points, halfDepth);
}

export interface ShapeGeometry {
  triangles: Tri[];
  // smooth-shaded shapes (the sphere): use each vertex's position as its
  // normal instead of flat face normals
  smooth?: boolean;
  // for the two-colored shapes: which triangles get the symbol's color
  // (the others are white)
  colored?: (tri: Tri) => boolean;
}

function centroid(tri: Tri): Vec {
  return [(tri[0][0] + tri[1][0] + tri[2][0]) / 3,
          (tri[0][1] + tri[1][1] + tri[2][1]) / 3,
          (tri[0][2] + tri[1][2] + tri[2][2]) / 3];
}

// the shape at unit size: about 1 from its center to its outline, the way
// the sphere has radius 1
export function shapeGeometry(shape: Shape): ShapeGeometry {
  let triangles: Tri[];
  let colored: ((tri: Tri) => boolean) | undefined;
  switch (shape) {
    case 'sphere':
      return { triangles: sphere(10, 16).map(outward), smooth: true };
    case 'cube':
      triangles = box(0.8, 0.8, 0.8);
      break;
    case 'crossedCube':
      triangles = box(0.8, 0.8, 0.8);
      colored = (tri) => { const c = centroid(tri); return c[0] - c[1] > 0; };
      break;
    case 'diamond':
      triangles = octahedron(1.1, 1.1, 0.8);
      break;
    case 'dividedDiamond':
      triangles = octahedron(1.1, 1.1, 0.8);
      colored = (tri) => centroid(tri)[1] > 0;
      break;
    case 'flatDiamond':
      triangles = octahedron(1.1, 1.1, 0.4);
      break;
    case 'cone':
      triangles = cone(0.9, 0.9, 16);
      break;
    case 'dividedCone':
      triangles = cone(0.9, 0.9, 16);
      colored = (tri) => centroid(tri)[0] > 0;
      break;
    case 'flatRectangle':
      triangles = box(1.0, 0.5, 0.4);
      break;
    case 'star':
      triangles = star(1.1, 0.45, 0.35);
      break;
    case 'flatHexagon':
      triangles = prism(regularPolygon(6, 1.0, 0), 0.35);
      break;
    case 'pentagon':
      triangles = prism(regularPolygon(5, 1.0, Math.PI / 2), 0.35);
      break;
  }
  return { triangles: triangles.map(outward), colored };
}
