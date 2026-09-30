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

import utils from '../utils';
import BaseGeom, { type BaseGeom as IBaseGeom } from './base-geom';
import type Cam from './cam';

// A single render object made of several geoms that each need their own
// shaders, e.g. balls and sticks: billboarded spheres (BillboardGeom) plus
// cylinder meshes (MeshGeom). To the viewer it behaves like one geom: the
// vertex association is shared, so colorBy/setSelection/setOpacity reach the
// vertices of all parts, and picking ids are registered with the composite.
// The parts only draw, and contribute their vertex arrays for bounds.
//
// NOTE: kept as a prototype-based constructor function -- see
// gfx/vertex-array-base.ts/gfx/base-geom.ts for why.
export interface CompositeGeom extends IBaseGeom {
  _parts: IBaseGeom[];
}

interface CompositeGeomConstructor {
  new (gl: WebGL2RenderingContext, parts: IBaseGeom[]): CompositeGeom;
  (this: CompositeGeom, gl: WebGL2RenderingContext, parts: IBaseGeom[]): void;
  prototype: CompositeGeom;
}

const CompositeGeom = function(
  this: CompositeGeom, gl: WebGL2RenderingContext, parts: IBaseGeom[],
) {
  (BaseGeom as unknown as (this: CompositeGeom, gl: WebGL2RenderingContext) => void).call(this, gl);
  this._parts = parts;
  // SceneNode.destroy() destroys children, which releases the parts' buffers.
  for (let i = 0; i < parts.length; ++i) {
    this.add(parts[i]!);
  }
} as unknown as CompositeGeomConstructor;

utils.derive(CompositeGeom, BaseGeom, {
  addVertAssoc: function(this: CompositeGeom, assoc: never) {
    (BaseGeom.prototype.addVertAssoc as (this: IBaseGeom, a: never) => void).call(this, assoc);
    // the parts need it for structure(), used when drawing symmetry mates.
    for (let i = 0; i < this._parts.length; ++i) {
      this._parts[i]!.addVertAssoc(assoc);
    }
  },

  setShowRelated: function(this: CompositeGeom, rel: string | null) {
    const result = (BaseGeom.prototype.setShowRelated as (
      this: IBaseGeom, r: string | null
    ) => string | null | undefined).call(this, rel);
    for (let i = 0; i < this._parts.length; ++i) {
      this._parts[i]!._showRelated = this._showRelated;
    }
    return result;
  },

  vertArrays: function(this: CompositeGeom) {
    let vertArrays: ReturnType<IBaseGeom['vertArrays']> = [];
    for (let i = 0; i < this._parts.length; ++i) {
      vertArrays = vertArrays.concat(this._parts[i]!.vertArrays());
    }
    return vertArrays;
  },

  draw: function(this: CompositeGeom, cam: Cam, shaderCatalog: unknown, style: unknown, pass: unknown) {
    if (!this._visible) {
      return;
    }
    for (let i = 0; i < this._parts.length; ++i) {
      this._parts[i]!.draw(cam, shaderCatalog, style, pass);
    }
  },
} as Partial<CompositeGeom>);

export default CompositeGeom;
