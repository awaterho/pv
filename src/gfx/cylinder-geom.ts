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

// cylinders, one per instance (the sticks of balls and sticks and of
// licorice), shaded like meshes

import utils from '../utils';
import InstancedGeom, { type InstancedGeom as IInstancedGeom } from './instanced-geom';
import {
  type InstancedArray,
  CYLINDER_LAYOUT, cylinderBoundingSphere, unitCylinder,
} from './instanced-array';

interface ShaderCatalog {
  hemilightCylinders: unknown;
  selectCylinders: unknown;
  outlineCylinders: unknown;
  hemilightCylindersTransparent?: unknown;
}

type UnitCylinder = Parameters<typeof unitCylinder>[1];

// NOTE: kept as a prototype-based constructor function -- see
// gfx/vertex-array-base.ts/gfx/base-geom.ts for why (this chain-invokes
// InstancedGeom via `.call()`).
export type CylinderGeom = IInstancedGeom;

interface CylinderGeomConstructor {
  new (gl: WebGL2RenderingContext, float32Allocator: unknown, protoCyl: UnitCylinder): CylinderGeom;
  (this: CylinderGeom, gl: WebGL2RenderingContext, float32Allocator: unknown,
   protoCyl: UnitCylinder): void;
  prototype: CylinderGeom;
}

const CylinderGeom = function(
  this: CylinderGeom, gl: WebGL2RenderingContext, float32Allocator: unknown, protoCyl: UnitCylinder,
) {
  (InstancedGeom as unknown as (
    this: CylinderGeom, gl: WebGL2RenderingContext, float32Allocator: unknown,
    layout: typeof CYLINDER_LAYOUT, shape: ReturnType<typeof unitCylinder>,
  ) => void).call(this, gl, float32Allocator, CYLINDER_LAYOUT, unitCylinder(gl, protoCyl));
} as unknown as CylinderGeomConstructor;

utils.derive(CylinderGeom, InstancedGeom, {
  addChainVertArray: function(this: CylinderGeom, chain: { name(): string }, numInstances: number) {
    const va = (InstancedGeom.prototype.addChainVertArray as (
      this: CylinderGeom, chain: { name(): string }, numInstances: number
    ) => InstancedArray).call(this, chain, numInstances);
    va._calculateBoundingSphere = cylinderBoundingSphere;
    return va;
  },

  shaderForStyleAndPass: function(this: CylinderGeom, shaderCatalog: ShaderCatalog, style: unknown,
                                  pass: unknown) {
    if (pass === 'normal') {
      return shaderCatalog.hemilightCylinders;
    }
    if (pass === 'transparent') {
      return shaderCatalog.hemilightCylindersTransparent ?? null;
    }
    if (pass === 'select') {
      return shaderCatalog.selectCylinders;
    }
    if (pass === 'outline') {
      return shaderCatalog.outlineCylinders;
    }
    return null;
  },
} as unknown as Partial<CylinderGeom>);

export default CylinderGeom;
