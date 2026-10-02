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

// geometry made of instances of one shape, one instanced array per chain,
// see gfx/instanced-array.ts. Drawn like a MeshGeom.

import utils from '../utils';
import MeshGeom, { type MeshGeom as IMeshGeom } from './mesh-geom';
import InstancedArrayCtor, {
  type InstancedArray, type InstanceLayout, type InstanceShape,
} from './instanced-array';

// NOTE: kept as a prototype-based constructor function -- see
// gfx/vertex-array-base.ts/gfx/base-geom.ts for why (this chain-invokes
// MeshGeom via `.call()`).
export type InstancedGeom = Omit<IMeshGeom, 'addChainVertArray' | 'vertArrayWithSpaceFor'> & {
  _instanceLayout: InstanceLayout;
  _shape: InstanceShape;
  // room for numInstances instances of the chain
  addChainVertArray(chain: { name(): string }, numInstances: number): InstancedArray;
  vertArrayWithSpaceFor(numInstances: number): InstancedArray;
};

interface InstancedGeomConstructor {
  new (gl: WebGL2RenderingContext, float32Allocator: unknown, layout: InstanceLayout,
       shape: InstanceShape): InstancedGeom;
  (this: InstancedGeom, gl: WebGL2RenderingContext, float32Allocator: unknown,
   layout: InstanceLayout, shape: InstanceShape): void;
  prototype: InstancedGeom;
}

const InstancedGeom = function(
  this: InstancedGeom, gl: WebGL2RenderingContext, float32Allocator: unknown,
  layout: InstanceLayout, shape: InstanceShape,
) {
  (MeshGeom as unknown as (
    this: InstancedGeom, gl: WebGL2RenderingContext, float32Allocator: unknown, uint16Allocator: unknown
  ) => void).call(this, gl, float32Allocator, null);
  this._instanceLayout = layout;
  this._shape = shape;
} as unknown as InstancedGeomConstructor;

utils.derive(InstancedGeom, MeshGeom, {
  addChainVertArray: function(this: InstancedGeom, chain: { name(): string }, numInstances: number) {
    const va = new InstancedArrayCtor(chain.name(), this._gl, numInstances, this._float32Allocator,
                                  this._instanceLayout, this._shape);
    this._indexedVAs.push(va as never);
    return va;
  },

  // instances have no indices, so a chain's instances all fit into one
  // array, unlike a mesh's vertices
  vertArrayWithSpaceFor: function(this: InstancedGeom) {
    return this._indexedVAs[this._indexedVAs.length - 1] as unknown as InstancedArray;
  },

  destroy: function(this: InstancedGeom) {
    (MeshGeom.prototype.destroy as (this: InstancedGeom) => void).call(this);
    this._shape.destroy();
  },
} as unknown as Partial<IMeshGeom>);

export default InstancedGeom;
