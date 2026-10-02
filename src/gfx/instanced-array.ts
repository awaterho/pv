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

// Instanced drawing: one small shape (a quad for billboarded spheres, the
// unit cylinder for sticks) is stored once, and drawn once per instance with
// glDrawElementsInstanced. Per instance, only what differs is stored (where,
// how big, color, object id and selection flag), instead of a copy of every
// vertex of the shape. The vertex shader places the shape. A billboarded
// sphere thus takes 40 bytes instead of 204 (4 vertices and 6 indices), a
// stick 72 bytes instead of 108 per arc of the cylinder (2 vertices and 6
// indices): 864 bytes for balls and sticks, 2.6 kB for licorice.
//
// An instance takes the place of a vertex everywhere else: vertex
// associations, colors, opacity and selection address instances by index.

import { vec3 } from 'gl-matrix';
import utils from '../utils';
import geom from '../geom';
import VertexArrayBase from './vertex-array-base';
import type Cam from './cam';
import type { ShaderProgram } from './cam';

// a float attribute: its name in the shaders, its size and its offset (both
// in floats)
export interface AttribSpec {
  name: string;
  size: number;
  offset: number;
}

export interface InstanceLayout {
  floatsPerInstance: number;
  colorOffset: number;
  selectOffset: number;
  attribs: AttribSpec[];
}

interface Shader extends ShaderProgram {
  symId: WebGLUniformLocation;
}

// attribute locations, looked up once per shader
const attribLocations = new WeakMap<WebGLProgram, Record<string, number>>();

function attribLocation(gl: WebGL2RenderingContext, shader: WebGLProgram, name: string): number {
  let locs = attribLocations.get(shader);
  if (locs === undefined) {
    locs = {};
    attribLocations.set(shader, locs);
  }
  let loc = locs[name];
  if (loc === undefined) {
    loc = locs[name] = gl.getAttribLocation(shader, name);
  }
  return loc;
}

// the shape every instance draws: per-vertex attributes and the triangles
export class InstanceShape {
  private _gl: WebGL2RenderingContext;
  private _vertBuffer: WebGLBuffer;
  private _indexBuffer: WebGLBuffer;
  private _floatsPerVert: number;
  private _attribs: AttribSpec[];
  private _numIndices: number;

  constructor(gl: WebGL2RenderingContext, vertData: Float32Array, floatsPerVert: number,
              attribs: AttribSpec[], indices: Uint16Array) {
    this._gl = gl;
    this._floatsPerVert = floatsPerVert;
    this._attribs = attribs;
    this._numIndices = indices.length;
    this._vertBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertData, gl.STATIC_DRAW);
    this._indexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  }

  numIndices(): number { return this._numIndices; }

  // binds the shape's buffers and its attributes, adding the attribute
  // locations it enables to enabled
  bind(shader: WebGLProgram, enabled: number[]): void {
    const gl = this._gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    enableAttribs(gl, shader, this._attribs, this._floatsPerVert, 0, enabled);
  }

  destroy(): void {
    this._gl.deleteBuffer(this._vertBuffer);
    this._gl.deleteBuffer(this._indexBuffer);
  }
}

function enableAttribs(gl: WebGL2RenderingContext, shader: WebGLProgram, attribs: AttribSpec[],
                       floatsPerVert: number, divisor: number, enabled: number[]): void {
  for (let i = 0; i < attribs.length; ++i) {
    const attrib = attribs[i]!;
    const loc = attribLocation(gl, shader, attrib.name);
    if (loc === -1) {
      continue;
    }
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, attrib.size, gl.FLOAT, false,
                           floatsPerVert * 4, attrib.offset * 4);
    gl.vertexAttribDivisor(loc, divisor);
    enabled.push(loc);
  }
}

// NOTE: kept as a prototype-based constructor function, like the other
// vertex arrays deriving from VertexArrayBase (see gfx/vertex-array-base.ts).
export interface InstancedArray extends VertexArrayBase {
  _chain: unknown;
  _layout: InstanceLayout;
  _shape: InstanceShape;
  _numInstances: number;
  _maxInstances: number;
  _enabled: number[];

  chain(): unknown;
  maxVerts(): number;
  addInstance(data: ArrayLike<number>): void;
  bind(shader: Shader): void;
  draw(): void;
  releaseAttribs(shader: Shader): void;
  drawSymmetryRelated(cam: Cam, shader: Shader, transforms: import('gl-matrix').mat4[],
                      firstSymId?: number): void;
}

interface InstancedArrayConstructor {
  new (chain: unknown, gl: WebGL2RenderingContext, numInstances: number,
       float32Allocator: unknown, layout: InstanceLayout, shape: InstanceShape): InstancedArray;
  (this: InstancedArray, chain: unknown, gl: WebGL2RenderingContext, numInstances: number,
   float32Allocator: unknown, layout: InstanceLayout, shape: InstanceShape): void;
  prototype: InstancedArray;
}

const InstancedArray = function(
  this: InstancedArray, chain: unknown, gl: WebGL2RenderingContext, numInstances: number,
  float32Allocator: unknown, layout: InstanceLayout, shape: InstanceShape,
) {
  // set before VertexArrayBase, which sizes the data by _FLOATS_PER_VERT
  this._FLOATS_PER_VERT = layout.floatsPerInstance;
  this._COLOR_OFFSET = layout.colorOffset;
  this._SELECT_OFFSET = layout.selectOffset;
  (VertexArrayBase as unknown as (
    this: InstancedArray, gl: WebGL2RenderingContext, numVerts: number, float32Allocator: unknown
  ) => void).call(this, gl, numInstances, float32Allocator);
  this._chain = chain;
  this._layout = layout;
  this._shape = shape;
  this._numInstances = 0;
  this._maxInstances = numInstances;
  this._enabled = [];
} as unknown as InstancedArrayConstructor;

utils.derive(InstancedArray, VertexArrayBase, {
  chain: function(this: InstancedArray) { return this._chain; },
  numVerts: function(this: InstancedArray) { return this._numInstances; },
  maxVerts: function(this: InstancedArray) { return this._maxInstances; },

  addInstance: function(this: InstancedArray, data: ArrayLike<number>) {
    if (this._numInstances === this._maxInstances) {
      console.error('maximum number of instances reached');
      return;
    }
    this._vertData.set(data, this._numInstances * this._FLOATS_PER_VERT);
    this._numInstances += 1;
    this._ready = false;
  },

  bind: function(this: InstancedArray, shader: Shader) {
    this.bindBuffers();
    enableAttribs(this._gl, shader, this._layout.attribs, this._FLOATS_PER_VERT, 1,
                  this._enabled);
    this._shape.bind(shader, this._enabled);
  },

  draw: function(this: InstancedArray) {
    if (this._numInstances === 0) {
      return;
    }
    const gl = this._gl;
    gl.drawElementsInstanced(gl.TRIANGLES, this._shape.numIndices(), gl.UNSIGNED_SHORT, 0,
                             this._numInstances);
  },

  // the divisors go back to 0: they are global state, which the other
  // (non-instanced) vertex arrays never set
  releaseAttribs: function(this: InstancedArray) {
    const gl = this._gl;
    for (let i = 0; i < this._enabled.length; ++i) {
      gl.vertexAttribDivisor(this._enabled[i]!, 0);
      gl.disableVertexAttribArray(this._enabled[i]!);
    }
    this._enabled.length = 0;
  },

  drawSymmetryRelated: function(
    this: InstancedArray, cam: Cam, shader: Shader, transforms: import('gl-matrix').mat4[],
    firstSymId?: number,
  ) {
    this.bind(shader);
    for (let i = 0; i < transforms.length; ++i) {
      cam.bind(shader, transforms[i]);
      this._gl.uniform1i(shader.symId, (firstSymId ?? 0) + i);
      this.draw();
    }
    this.releaseAttribs(shader);
  },
} as Partial<InstancedArray>);

// billboarded spheres: center, radius, color, object id, selection flag.
// The quad's corners are the shape, see SPHERES_VS.
export const SPHERE_LAYOUT: InstanceLayout = {
  floatsPerInstance: 10, colorOffset: 4, selectOffset: 9,
  attribs: [
    { name: 'attrPos', size: 3, offset: 0 },
    { name: 'attrRadius', size: 1, offset: 3 },
    { name: 'attrColor', size: 4, offset: 4 },
    { name: 'attrObjId', size: 1, offset: 8 },
    { name: 'attrSelect', size: 1, offset: 9 },
  ],
};

export function sphereQuad(gl: WebGL2RenderingContext): InstanceShape {
  return new InstanceShape(gl, new Float32Array([-1, -1, 1, 1, 1, -1, -1, 1]), 2,
                           [{ name: 'attrQuadCorner', size: 2, offset: 0 }],
                           new Uint16Array([0, 1, 2, 0, 3, 1]));
}

// cylinders: center, the cylinder's x and y axes scaled by its radius and
// its z axis scaled by its length, color, object id, selection flag. The
// unit cylinder is the shape, see shaders.cylinderVS().
export const CYLINDER_LAYOUT: InstanceLayout = {
  floatsPerInstance: 18, colorOffset: 12, selectOffset: 17,
  attribs: [
    { name: 'attrCylCenter', size: 3, offset: 0 },
    { name: 'attrCylLeft', size: 3, offset: 3 },
    { name: 'attrCylUp', size: 3, offset: 6 },
    { name: 'attrCylAxis', size: 3, offset: 9 },
    { name: 'attrColor', size: 4, offset: 12 },
    { name: 'attrObjId', size: 1, offset: 16 },
    { name: 'attrSelect', size: 1, offset: 17 },
  ],
};

export function unitCylinder(gl: WebGL2RenderingContext,
                             proto: { verts(): Float32Array; normals(): Float32Array;
                                      indices(): Uint16Array }): InstanceShape {
  const verts = proto.verts(), normals = proto.normals();
  const data = new Float32Array(verts.length * 2);
  for (let i = 0; i < verts.length / 3; ++i) {
    data.set(verts.subarray(i * 3, i * 3 + 3), i * 6);
    data.set(normals.subarray(i * 3, i * 3 + 3), i * 6 + 3);
  }
  return new InstanceShape(gl, data, 6,
                           [{ name: 'attrProtoPos', size: 3, offset: 0 },
                            { name: 'attrProtoNormal', size: 3, offset: 3 }],
                           proto.indices());
}

// farthest distance from a point to a circle: the circle has its center
// along (along the circle's axis) and perp (sideways) from the point
function farthestOnCircle(along: number, perp: number, radius: number): number {
  return Math.sqrt(along * along + (perp + radius) * (perp + radius));
}

// the cylinders' bounds take in their extent, not just their centers, as
// they did when the cylinders' vertices were stored: they reach to the
// circles at both ends
export const cylinderBoundingSphere = function(this: InstancedArray) {
  const numInstances = this.numVerts();
  if (numInstances === 0) {
    return null;
  }
  const data = this._vertData, stride = this._FLOATS_PER_VERT;
  const center = vec3.create();
  for (let i = 0; i < numInstances; ++i) {
    center[0] += data[i * stride]!;
    center[1] += data[i * stride + 1]!;
    center[2] += data[i * stride + 2]!;
  }
  vec3.scale(center, center, 1.0 / numInstances);
  let radius = 0.0;
  for (let i = 0; i < numInstances; ++i) {
    const o = i * stride;
    const dx = data[o]! - center[0], dy = data[o + 1]! - center[1], dz = data[o + 2]! - center[2];
    const ax = data[o + 9]!, ay = data[o + 10]!, az = data[o + 11]!;
    const length = Math.hypot(ax, ay, az);
    const cylRadius = Math.hypot(data[o + 3]!, data[o + 4]!, data[o + 5]!);
    const along = (dx * ax + dy * ay + dz * az) / length;
    const perp = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along));
    radius = Math.max(radius,
                      farthestOnCircle(along + 0.5 * length, perp, cylRadius),
                      farthestOnCircle(along - 0.5 * length, perp, cylRadius));
  }
  return new geom.Sphere(center, radius);
};

export default InstancedArray;
