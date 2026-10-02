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
import utils from '../utils';
import InstancedGeom, { type InstancedGeom as IInstancedGeom } from './instanced-geom';
import { SPHERE_LAYOUT, sphereQuad } from './instanced-array';
import type Cam from './cam';

interface ShaderCatalog {
  spheres: unknown;
  selectSpheres: unknown;
  spheresTransparent?: unknown;
  [pass: string]: unknown;
}

// one billboarded sphere per instance: a quad, expanded to face the camera
// in SPHERES_VS, with the sphere surface and depth computed per fragment
//
// NOTE: kept as a prototype-based constructor function -- see
// gfx/vertex-array-base.ts/gfx/base-geom.ts for why (this chain-invokes
// InstancedGeom via `.call()`).
export type BillboardGeom = IInstancedGeom & {
  _matte: boolean;
  // shade the spheres like meshes (hemilight, no highlight), so that they
  // join cylinders of the same radius seamlessly, as in licorice
  setMatte(matte: boolean): void;
};

interface BillboardGeomConstructor {
  new (gl: WebGL2RenderingContext, float32Allocator: unknown): BillboardGeom;
  (this: BillboardGeom, gl: WebGL2RenderingContext, float32Allocator: unknown): void;
  prototype: BillboardGeom;
}

const BillboardGeom = function(
  this: BillboardGeom, gl: WebGL2RenderingContext, float32Allocator: unknown,
) {
  (InstancedGeom as unknown as (
    this: BillboardGeom, gl: WebGL2RenderingContext, float32Allocator: unknown,
    layout: typeof SPHERE_LAYOUT, shape: ReturnType<typeof sphereQuad>,
  ) => void).call(this, gl, float32Allocator, SPHERE_LAYOUT, sphereQuad(gl));
  this._matte = false;
} as unknown as BillboardGeomConstructor;

utils.derive(BillboardGeom, InstancedGeom, {
  setMatte: function(this: BillboardGeom, matte: boolean) {
    this._matte = matte;
  },
  draw: function(this: BillboardGeom, cam: Cam, shaderCatalog: unknown, style: unknown, pass: unknown) {
    // the matte flag is per object, not part of what Cam.bind() sets
    const shader = this.shaderForStyleAndPass(shaderCatalog as ShaderCatalog, style, pass) as
      (WebGLProgram & { matte?: WebGLUniformLocation | null }) | null;
    if (shader && shader.matte) {
      this._gl.useProgram(shader);
      this._gl.uniform1i(shader.matte, this._matte ? 1 : 0);
      cam.invalidateCurrentShader();
    }
    // we need the back-faces for the outline rendering
    this._gl.disable(this._gl.CULL_FACE);
    (InstancedGeom.prototype.draw as (
      this: BillboardGeom, cam: Cam, shaderCatalog: unknown, style: unknown, pass: unknown
    ) => void).call(this, cam, shaderCatalog, style, pass);
    this._gl.enable(this._gl.CULL_FACE);
  },
  shaderForStyleAndPass: function(this: BillboardGeom, shaderCatalog: ShaderCatalog, style: unknown, pass: unknown) {
    // the normal pass contains render code for both the normal
    // and outline pass which is toggled on/off by a boolean
    // uniform.
    if (pass === 'normal') {
      return shaderCatalog.spheres;
    }
    if (pass === 'transparent') {
      return shaderCatalog.spheresTransparent ?? null;
    }
    if (pass === 'select') {
      return shaderCatalog.selectSpheres;
    }
    return null;
  },
} as Partial<BillboardGeom>);

export default BillboardGeom;
