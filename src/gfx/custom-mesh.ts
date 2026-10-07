// Copyright (c) 2013-2015 Marco Biasini
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
import { vec3, mat3 } from 'gl-matrix';
import utils from '../utils';
import color from '../color';
import geom from '../geom';
import gb from './geom-builders';
import IndexedVertexArray, { type Shader as IVAShader } from './indexed-vertex-array';
import SceneNode, { type SceneNode as ISceneNode } from './scene-node';
import type Cam from './cam';
import type { ShaderProgram } from './cam';
import { ContinuousIdRange } from '../unique-object-id-pool';
import type UniqueObjectIdPool from '../unique-object-id-pool';

const forceRGB = color.forceRGB;


// number of ids to be allocated whenever we run out of objects. This would
// ideally depend on number of objects the user is going to create.
const ID_CHUNK_SIZE = 100;

interface ObjectIdData {
  center: vec3;
  userData: unknown;
  geom: CustomMesh;
  // the symmetry copy the shape was drawn for (its copy option), reported
  // by picking as symIndex()
  copy: number | null;
}

interface Shader extends IVAShader, ShaderProgram {
  symId: WebGLUniformLocation;
}

interface ShaderCatalog {
  hemilight: Shader;
  select: Shader;
  outline: Shader;
  hemilightTransparent?: Shader;
  [pass: string]: Shader | undefined;
}

// copy: for meshes that draw the copies of a symmetry assembly themselves,
// which copy (in the order of the assembly's generators and their
// matrices) the shape belongs to, so picking reports it as symIndex() and
// setHover() can tint just that copy.
interface TubeOptions {
  color?: string | number[];
  cap?: boolean;
  userData?: unknown;
  copy?: number;
}

interface SphereOptions {
  color?: string | number[];
  userData?: unknown;
  copy?: number;
}

interface TrianglesOptions {
  // one color for the whole shape, or triangleColors with one color per
  // triangle (e.g. a two-colored symbol); defaults to white.
  color?: string | number[];
  triangleColors?: (string | number[])[];
  // per-vertex normals (same layout as positions) for a smooth-shaded
  // shape; by default every triangle is flat-shaded.
  normals?: ArrayLike<number>;
  userData?: unknown;
  copy?: number;
}

const FLOATS_PER_VERT = 12;
// position (3), normal (3), then the color's r, g, b, a, the object id and
// the select flag
const ALPHA_OFFSET = 9;
const SELECT_OFFSET = 11;
const MAX_CHUNK_VERTS = 65535;

// small helper with the same interface as IndexedVertexArray that can be used
// as a drop-in when the number of vertices/indices is not known in advance.
class DynamicIndexedVertexArray {
  private _vertData: number[];
  private _indexData: number[];
  private _numVerts: number;
  private _shapeStarts: number[];
  private _shapeUserData: unknown[];
  private _shapeCopies: (number | null)[];
  // the bounding box of the vertices
  private _min: number[];
  private _max: number[];

  constructor() {
    this._min = [Infinity, Infinity, Infinity];
    this._max = [-Infinity, -Infinity, -Infinity];
    this._vertData = [];
    this._indexData = [];
    this._numVerts = 0;
    this._shapeStarts = [];
    this._shapeUserData = [];
    this._shapeCopies = [];
  }

  // marks the start of a shape (sphere, tube, ...): its triangles only
  // reference its own vertices, so the data can be split between shapes
  // into chunks small enough for 16 bit indices, see chunks().
  beginShape(userData: unknown, copy: number | null): void {
    this._shapeStarts.push(this._numVerts, this._indexData.length);
    this._shapeUserData.push(userData);
    this._shapeCopies.push(copy);
  }

  // sets every shape's select flag (the vertices' last float, read by the
  // shaders: 1 selected, -1 hovered, 0 neither) to flagFor(its userData,
  // its copy). Returns whether anything changed.
  setShapeFlags(flagFor: (userData: unknown, copy: number | null) => number): boolean {
    let changed = false;
    const n = this._shapeUserData.length;
    for (let shape = 0; shape < n; ++shape) {
      const flag = flagFor(this._shapeUserData[shape], this._shapeCopies[shape]!);
      const start = this._shapeStarts[shape * 2]!;
      const end = shape + 1 < n ? this._shapeStarts[shape * 2 + 2]! : this._numVerts;
      for (let v = start; v < end; ++v) {
        const i = v * FLOATS_PER_VERT + SELECT_OFFSET;
        if (this._vertData[i] !== flag) {
          this._vertData[i] = flag;
          changed = true;
        }
      }
    }
    return changed;
  }

  // vertex and index data in chunks of whole shapes with at most
  // MAX_CHUNK_VERTS vertices each, indices rebased to their chunk.
  chunks(): { vertData: number[]; indexData: number[] }[] {
    const result: { vertData: number[]; indexData: number[] }[] = [];
    const starts = this._shapeStarts.concat([this._numVerts, this._indexData.length]);
    let chunkVert = 0;
    let chunkIndex = 0;
    const flush = (endVert: number, endIndex: number) => {
      if (endVert === chunkVert) {
        return;
      }
      const indexData = this._indexData.slice(chunkIndex, endIndex);
      for (let i = 0; i < indexData.length; ++i) {
        indexData[i] = indexData[i]! - chunkVert;
      }
      result.push({
        vertData: this._vertData.slice(chunkVert * FLOATS_PER_VERT,
                                       endVert * FLOATS_PER_VERT),
        indexData,
      });
      chunkVert = endVert;
      chunkIndex = endIndex;
    };
    for (let i = 2; i < starts.length; i += 2) {
      // shape i/2 - 1 ends where the next one starts
      if (starts[i]! - chunkVert > MAX_CHUNK_VERTS) {
        flush(starts[i - 2]!, starts[i - 1]!);
      }
      // a shape too large for a chunk of its own, i.e. a big
      // addTriangles(): its triangles have vertices of their own, added in
      // order, so it splits between two triangles
      if (starts[i]! - chunkVert > MAX_CHUNK_VERTS) {
        for (let t = chunkIndex; t < starts[i + 1]!; t += 3) {
          const last = Math.max(this._indexData[t]!, this._indexData[t + 1]!,
                                this._indexData[t + 2]!);
          if (last - chunkVert >= MAX_CHUNK_VERTS) {
            flush(Math.min(this._indexData[t]!, this._indexData[t + 1]!,
                           this._indexData[t + 2]!), t);
          }
        }
      }
    }
    flush(this._numVerts, this._indexData.length);
    return result;
  }

  numVerts(): number {
    return this._numVerts;
  }
  // the squared distance from center to the farthest corner of the
  // vertices' bounding box, at least radius: an upper bound for the slab
  // that is cheap enough to take every frame (null with no vertices)
  updateSquaredSphereRadius(center: vec3, radius: number | null): number | null {
    if (this._numVerts === 0) {
      return radius;
    }
    let d = 0;
    for (let k = 0; k < 3; ++k) {
      const far = Math.max(Math.abs(this._min[k]! - center[k]!),
                           Math.abs(this._max[k]! - center[k]!));
      d += far * far;
    }
    return Math.max(radius === null ? 0 : radius, d);
  }
  updateProjectionIntervals(
    xAxis: vec3, yAxis: vec3, zAxis: vec3,
    xInterval: { update(v: number): void }, yInterval: { update(v: number): void },
    zInterval: { update(v: number): void },
  ): void {
    const p = vec3.create();
    for (let i = 0; i < this._vertData.length; i += FLOATS_PER_VERT) {
      vec3.set(p, this._vertData[i]!, this._vertData[i + 1]!, this._vertData[i + 2]!);
      xInterval.update(vec3.dot(p, xAxis));
      yInterval.update(vec3.dot(p, yAxis));
      zInterval.update(vec3.dot(p, zAxis));
    }
  }
  addVertex(pos: ArrayLike<number>, normal: ArrayLike<number>, color: ArrayLike<number>, objId: number): void {
    this._numVerts += 1;
    for (let k = 0; k < 3; ++k) {
      this._min[k] = Math.min(this._min[k]!, pos[k]!);
      this._max[k] = Math.max(this._max[k]!, pos[k]!);
    }
    this._vertData.push(pos[0]!, pos[1]!, pos[2]!,
                        normal[0]!, normal[1]!, normal[2]!,
                        color[0]!, color[1]!, color[2]!, color[3]!,
                        objId, 0.0);
  }
  addTriangle(indexOne: number, indexTwo: number, indexThree: number): void {
    this._indexData.push(indexOne, indexTwo, indexThree);
  }
  numIndices(): number {
    return this._indexData.length;
  }
  // sets the alpha of every vertex added so far, with test only those of the
  // shapes whose userData passes it
  setAlpha(alpha: number, test?: (userData: unknown) => boolean): void {
    if (test === undefined) {
      for (let i = ALPHA_OFFSET; i < this._vertData.length; i += FLOATS_PER_VERT) {
        this._vertData[i] = alpha;
      }
      return;
    }
    const n = this._shapeUserData.length;
    for (let shape = 0; shape < n; ++shape) {
      if (!test(this._shapeUserData[shape])) {
        continue;
      }
      const start = this._shapeStarts[shape * 2]!;
      const end = shape + 1 < n ? this._shapeStarts[shape * 2 + 2]! : this._numVerts;
      for (let v = start; v < end; ++v) {
        this._vertData[v * FLOATS_PER_VERT + ALPHA_OFFSET] = alpha;
      }
    }
  }
  indexData(): number[] {
    return this._indexData;
  }
  vertData(): number[] {
    return this._vertData;
  }
}

// FIXME: these are duplicated from render.js and should be moved to a
// common module
function capTubeStart(va: DynamicIndexedVertexArray, baseIndex: number, numTubeVerts: number): void {
  for (let i = 0; i < numTubeVerts - 1; ++i) {
    va.addTriangle(baseIndex, baseIndex + 1 + i, baseIndex + 2 + i);
  }
  va.addTriangle(baseIndex, baseIndex + numTubeVerts, baseIndex + 1);
}

function capTubeEnd(va: DynamicIndexedVertexArray, baseIndex: number, numTubeVerts: number): void {
  const center = baseIndex + numTubeVerts;
  for (let i = 0; i < numTubeVerts - 1; ++i) {
    va.addTriangle(center, baseIndex + i + 1, baseIndex + i);
  }
  va.addTriangle(center, baseIndex, baseIndex + numTubeVerts - 1);
}

// NOTE: kept as a prototype-based constructor function -- see
// gfx/vertex-array-base.ts/gfx/base-geom.ts for why (this chain-invokes
// SceneNode via `.call()`).
export interface CustomMesh extends ISceneNode {
  _float32Allocator: unknown;
  _uint16Allocator: unknown;
  _data: DynamicIndexedVertexArray;
  _protoSphere: InstanceType<typeof gb.ProtoSphere>;
  _protoCyl: InstanceType<typeof gb.ProtoCylinder>;
  _vas: InstanceType<typeof IndexedVertexArray>[];
  _idRanges: ContinuousIdRange<ObjectIdData>[];
  _idPool: UniqueObjectIdPool<ObjectIdData>;
  _ready: boolean;
  // bumped by every change to what picking sees: shapes added, opacity
  // (fully transparent parts can't be picked), see Viewer.pick()
  _pickVersion: number;
  pickVersion(): number;
  _currentRange: ContinuousIdRange<ObjectIdData> | null;

  updateProjectionIntervals(
    xAxis: vec3, yAxis: vec3, zAxis: vec3,
    xInterval: { update(v: number): void }, yInterval: { update(v: number): void },
    zInterval: { update(v: number): void },
  ): void;
  updateSquaredSphereRadius(center: vec3, radius: number | null): number | null;
  addTube(start: vec3, end: vec3, radius: number, options?: TubeOptions): void;
  _nextObjectId(data: ObjectIdData): number;
  addSphere(center: vec3, radius: number, options?: SphereOptions): void;
  addTriangles(positions: ArrayLike<number>, options?: TrianglesOptions): void;
  setOpacity(val: number, test?: (userData: unknown) => boolean): void;
  setSelection(test: ((userData: unknown) => boolean) | null): void;
  setHover(test: ((userData: unknown) => boolean) | null, copy?: number | null): void;
  _selectionTest: ((userData: unknown) => boolean) | null;
  _hoverTest: ((userData: unknown) => boolean) | null;
  _hoverCopy: number | null;
  _applySelection(): void;
  _prepareVertexArray(): void;
  shaderForStyleAndPass(shaderCatalog: ShaderCatalog, style: unknown, pass: unknown): Shader | null;
}

interface CustomMeshConstructor {
  new (
    name: string, gl: WebGL2RenderingContext, float32Allocator: unknown, uint16Allocator: unknown,
    idPool: UniqueObjectIdPool<ObjectIdData>,
  ): CustomMesh;
  (
    this: CustomMesh, name: string, gl: WebGL2RenderingContext, float32Allocator: unknown,
    uint16Allocator: unknown, idPool: UniqueObjectIdPool<ObjectIdData>,
  ): void;
  prototype: CustomMesh;
}

const CustomMesh = function(
  this: CustomMesh, name: string, gl: WebGL2RenderingContext, float32Allocator: unknown,
  uint16Allocator: unknown, idPool: UniqueObjectIdPool<ObjectIdData>,
) {
  (SceneNode as unknown as (this: CustomMesh, gl: WebGL2RenderingContext) => void).call(this, gl);
  this._float32Allocator = float32Allocator;
  this._uint16Allocator = uint16Allocator;
  this._data = new DynamicIndexedVertexArray();
  // 16x16, the library's "high quality" sphereDetail (see viewer.ts's
  // QUALITY_DETAIL) -- a custom mesh usually holds only a handful of
  // spheres, so there's no reason to tessellate them any coarser than that,
  // and unlike the raycast billboarded spheres used for ballsAndSticks
  // etc., a mesh sphere's facets show as a visible silhouette.
  this._protoSphere = new gb.ProtoSphere(16, 16);
  this._protoCyl = new gb.ProtoCylinder(8);
  this._vas = [];
  this._selectionTest = null;
  this._hoverTest = null;
  this._hoverCopy = null;
  this._idRanges = [];
  this._idPool = idPool;
  this._ready = false;
  this._pickVersion = 0;
  this._currentRange = null;
} as unknown as CustomMeshConstructor;

utils.derive(CustomMesh, SceneNode, {
  // the extent of everything added, for autoZoom()/fitTo() and the slab
  updateProjectionIntervals: function(
    this: CustomMesh, xAxis: vec3, yAxis: vec3, zAxis: vec3,
    xInterval: { update(v: number): void }, yInterval: { update(v: number): void },
    zInterval: { update(v: number): void },
  ) {
    if (this._visible) {
      this._data.updateProjectionIntervals(xAxis, yAxis, zAxis, xInterval, yInterval, zInterval);
    }
  },
  pickVersion: function(this: CustomMesh) {
    return this._pickVersion;
  },
  updateSquaredSphereRadius: function(this: CustomMesh, center: vec3, radius: number | null) {
    return this._visible ? this._data.updateSquaredSphereRadius(center, radius) : radius;
  },

  addTube: (function() {
    const midPoint = vec3.create();
    const left = vec3.create();
    const up = vec3.create();
    const dir = vec3.create();
    const rotation = mat3.create();
    return function(
      this: CustomMesh, start: vec3, end: vec3, radius: number, options?: TubeOptions
    ): void {
      options = options || {};
      const color = forceRGB(options.color || 'white');
      let cap = true;
      if (options.cap !== undefined) {
        cap = options.cap;
      }
      const userData = options.userData !== undefined ? options.userData : null;
      const copy = options.copy !== undefined ? options.copy : null;
      this._data.beginShape(userData, copy);
      vec3.sub(dir, end, start);
      const length = vec3.length(dir);
      vec3.normalize(dir, dir);
      vec3.add(midPoint, start, end);
      vec3.scale(midPoint, midPoint, 0.5);
      geom.buildRotation(rotation, dir, left, up, false);
      // the caps carry the tube's object id too, so they can be picked
      const objectId = this._nextObjectId({
        center : midPoint,
        userData : userData,
        geom : this,
        copy : copy,
      });
      if (cap) {
        const startIndex = this._data.numVerts();
        this._data.addVertex(start, [-dir[0], -dir[1], -dir[2]], color, objectId);
        capTubeStart(this._data, startIndex, 8);
      }
      this._protoCyl.addTransformed(this._data, midPoint, length, radius,
                                    rotation, color, color, objectId, objectId);
      if (cap) {
        const baseIndex = this._data.numVerts();
        this._data.addVertex(end, dir, color, objectId);
        capTubeEnd(this._data, baseIndex - 8, 8);
      }
      this._ready = false;
      this._pickVersion += 1;
    };
  })(),
  _nextObjectId: function(this: CustomMesh, data: ObjectIdData) {
    // because we have no idea how many different objects the user will
    // create we will just allocate the object ids in chunks of
    // ID_CHUNK_SIZE
    if (!this._currentRange || !this._currentRange.hasLeft()) {
      this._currentRange = this._idPool.getContinuousRange(ID_CHUNK_SIZE);
      this._idRanges.push(this._currentRange!);
    }
    return this._currentRange!.nextId(data);
  },
  destroy: function(this: CustomMesh) {
    (SceneNode.prototype.destroy as (this: CustomMesh) => void).call(this);
    for (let i = 0; i < this._idRanges.length; ++i) {
      this._idRanges[i]!.recycle();
    }
  },

  addSphere: function(this: CustomMesh, center: vec3, radius: number, options?: SphereOptions) {
    options = options || {};
    const color = forceRGB(options.color || 'white');
    const userData = options.userData !== undefined ? options.userData : null;
    const copy = options.copy !== undefined ? options.copy : null;
    this._data.beginShape(userData, copy);
    const objectId = this._nextObjectId({
      center : center,
      userData : userData,
      geom : this,
      copy : copy,
    });
    this._protoSphere.addTransformed(this._data, center, radius,
                                     color, objectId);
    this._ready = false;
    this._pickVersion += 1;
  },
  // an arbitrary shape: positions holds 9 numbers (three xyz vertices,
  // counter-clockwise seen from outside) per triangle, flat-shaded unless
  // options.normals are given. The whole shape is one pickable object,
  // centered on its vertex mean.
  addTriangles: (function() {
    const a = vec3.create();
    const b = vec3.create();
    const c = vec3.create();
    const ab = vec3.create();
    const ac = vec3.create();
    const normal = vec3.create();
    const na = vec3.create();
    const nb = vec3.create();
    const nc = vec3.create();
    return function(this: CustomMesh, positions: ArrayLike<number>,
                    options?: TrianglesOptions): void {
      options = options || {};
      const numTriangles = Math.floor(positions.length / 9);
      if (numTriangles === 0) {
        return;
      }
      const center = vec3.create();
      for (let i = 0; i < numTriangles * 9; i += 3) {
        center[0] += positions[i]!;
        center[1] += positions[i + 1]!;
        center[2] += positions[i + 2]!;
      }
      vec3.scale(center, center, 1 / (numTriangles * 3));
      const userData = options.userData !== undefined ? options.userData : null;
      const copy = options.copy !== undefined ? options.copy : null;
      const objectId = this._nextObjectId({
        center : center,
        userData : userData,
        geom : this,
        copy : copy,
      });
      const uniformColor = forceRGB(options.color || 'white');
      this._data.beginShape(userData, copy);
      for (let t = 0; t < numTriangles; ++t) {
        const o = t * 9;
        vec3.set(a, positions[o]!, positions[o + 1]!, positions[o + 2]!);
        vec3.set(b, positions[o + 3]!, positions[o + 4]!, positions[o + 5]!);
        vec3.set(c, positions[o + 6]!, positions[o + 7]!, positions[o + 8]!);
        vec3.sub(ab, b, a);
        vec3.sub(ac, c, a);
        vec3.cross(normal, ab, ac);
        vec3.normalize(normal, normal);
        const triangleColor = options.triangleColors !== undefined ?
          forceRGB(options.triangleColors[t] || 'white') : uniformColor;
        const normals = options.normals;
        if (normals !== undefined) {
          vec3.set(na, normals[o]!, normals[o + 1]!, normals[o + 2]!);
          vec3.set(nb, normals[o + 3]!, normals[o + 4]!, normals[o + 5]!);
          vec3.set(nc, normals[o + 6]!, normals[o + 7]!, normals[o + 8]!);
        } else {
          vec3.copy(na, normal);
          vec3.copy(nb, normal);
          vec3.copy(nc, normal);
        }
        const base = this._data.numVerts();
        this._data.addVertex(a, na, triangleColor, objectId);
        this._data.addVertex(b, nb, triangleColor, objectId);
        this._data.addVertex(c, nc, triangleColor, objectId);
        // pv culls front faces (canvas.ts), i.e. its own meshes wind
        // clockwise seen from outside: emit the triangle reversed
        this._data.addTriangle(base, base + 2, base + 1);
      }
      this._ready = false;
      this._pickVersion += 1;
    };
  })(),
  // the opacity of everything added so far (0 transparent - 1 opaque),
  // drawn through the viewer's order-independent transparency like the
  // other render objects' setOpacity(). With test, only the shapes whose
  // userData passes it, as in setSelection()
  setOpacity: function(this: CustomMesh, val: number,
                       test?: (userData: unknown) => boolean) {
    this._data.setAlpha(val, test);
    this._ready = false;
    this._pickVersion += 1;
  },
  // the shapes whose userData passes test are drawn tinted with the
  // viewer's selectionColor, like a selection in the other render objects;
  // null clears it. setHover() is the same with the hoverColor, winning
  // over the selection; with copy, only for the shapes of that symmetry
  // copy (see the copy option of addTriangles() etc.).
  setSelection: function(this: CustomMesh, test: ((userData: unknown) => boolean) | null) {
    this._selectionTest = test;
    this._applySelection();
  },
  setHover: function(this: CustomMesh, test: ((userData: unknown) => boolean) | null,
                     copy?: number | null) {
    this._hoverTest = test;
    this._hoverCopy = copy === undefined ? null : copy;
    this._applySelection();
  },
  _applySelection: function(this: CustomMesh) {
    const selected = this._selectionTest, hovered = this._hoverTest;
    const hoverCopy = this._hoverCopy;
    const changed = this._data.setShapeFlags(function(userData, copy) {
      if (userData === null) {
        return 0.0;
      }
      if (hovered !== null && (hoverCopy === null || copy === hoverCopy) &&
          hovered(userData)) {
        return -1.0;
      }
      return selected !== null && selected(userData) ? 1.0 : 0.0;
    });
    if (changed) {
      this._ready = false;
    }
  },
  _prepareVertexArray: function(this: CustomMesh) {
    this._ready = true;
    for (let i = 0; i < this._vas.length; ++i) {
      this._vas[i]!.destroy();
    }
    this._vas = this._data.chunks().map((chunk) => {
      const va = new IndexedVertexArray(this._gl, chunk.vertData.length / FLOATS_PER_VERT,
                                        chunk.indexData.length,
                                        this._float32Allocator,
                                        this._uint16Allocator as never);
      // FIXME: find a better way to do this
      va.setIndexData(chunk.indexData);
      va.setVertData(chunk.vertData);
      return va;
    });
  },

  draw: function(this: CustomMesh, cam: Cam, shaderCatalog: ShaderCatalog, style: unknown, pass: unknown) {
    if (!this._visible) {
      return;
    }
    if (!this._ready) {
      this._prepareVertexArray();
    }
    // like BaseGeom.draw(): no transparent pass without translucent vertices
    if (pass === 'transparent' && !this._vas.some((va) => va.translucent())) {
      return;
    }
    const shader = this.shaderForStyleAndPass(shaderCatalog, style, pass);
    if (!shader) {
      return;
    }
    cam.bind(shader);
    this._gl.uniform1i(shader.symId, 255);
    for (let i = 0; i < this._vas.length; ++i) {
      const va = this._vas[i]!;
      va.bind(shader);
      va.draw();
      va.releaseAttribs(shader);
    }
  },
  // 'style' is currently always 'hemilight' (the only shading style pv
  // supports), so this always resolves to the hemilight shader -- kept as a
  // dispatcher (rather than inlined at call sites) since 'pass' still
  // selects between several distinct shaders.
  shaderForStyleAndPass: function(this: CustomMesh, shaderCatalog: ShaderCatalog, style: unknown, pass: unknown) {
    if (pass === 'normal') {
      return shaderCatalog.hemilight;
    }
    if (pass === 'transparent') {
      return shaderCatalog.hemilightTransparent ?? null;
    }
    if (pass === 'select') {
      return shaderCatalog.select;
    }
    if (pass === 'outline') {
      return shaderCatalog.outline;
    }
    const shader = shaderCatalog[pass as string];
    return shader !== undefined ? shader : null;
  },
} as Partial<CustomMesh>);

export default CustomMesh;
