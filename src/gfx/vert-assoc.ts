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
import colorModule, { type ColorAtom, type ColorObj } from '../color';

type ColorOp = InstanceType<typeof colorModule.ColorOp>;

// Structural typing for the VertexArray/IndexedVertexArray family
// (gfx/vertex-array-base.ts): only what recoloring/opacity/selection touch.
interface AssocVertexArray {
  setColor(index: number, r: number, g: number, b: number, a: number): void;
  getColor(index: number, color: number[]): number[];
  setSelected(index: number, a: number): void;
  setOpacity(index: number, a: number): void;
}

interface AssocAtom extends ColorAtom {
  index(): number;
  full(): AssocAtom;
}

interface AssocView {
  atomCount(): number;
  eachAtom(callback: (atom: AssocAtom, index: number) => void): void;
  containsResidue(residue: unknown): boolean;
}

export interface AssocStructure extends ColorObj {
  backboneTraces(): AssocTrace[];
}

interface AssocTrace {
  length(): number;
  residueAt(index: number): unknown;
  centralAtomAt(index: number): AssocAtom;
}

// During recoloring of a render style, most of the vertex attributes, e.g.
// normals and positions do not change. Only the color information for each
// vertex needs to be adjusted.
//
// To do that efficiently, we need store an association between ranges of
// vertices and atoms in the original structure. Worse, we also need to
// support render styles for which colors need to be interpolated, e.g.
// the smooth line trace, tube and cartoon render modes.
//
// The vertex association data for the atom-based render styles is managed
// by AtomVertexAssoc, whereas the trace-based render styles are managed
// by the TraceVertexAssoc class.
// the selection flags last written to the associations' vertices, grown to
// count entries; new ones are NaN (never written).
function growFlags(flags: Float32Array, count: number): Float32Array {
  if (flags.length === count) {
    return flags;
  }
  const grown = new Float32Array(count).fill(NaN);
  grown.set(flags.subarray(0, Math.min(flags.length, count)));
  return grown;
}

interface AtomAssocEntry {
  atom: AssocAtom;
  vertexArray: AssocVertexArray;
  vertStart: number;
  vertEnd: number;
  // for geometry with the symmetry copies built in (a surface over an
  // assembly): which copy these vertices belong to
  copy: number | null;
}

export class AtomVertexAssoc {
  _structure: AssocStructure;
  private _assocs: AtomAssocEntry[];
  // the selection flag last written to each association's vertices, so
  // that setSelection() only rewrites the ones that changed: moving the
  // hover from one residue to the next touches two residues' vertices, not
  // all of them
  private _applied: Float32Array = new Float32Array(0);
  // opacity and color are kept apart: _opacity holds the per-association
  // override set by setOpacity() (NaN where none is set) and _colorAlpha
  // the alpha the color operation gave those vertices. Only the two
  // composed, with an override winning, ever reach the vertex array, so
  // recoloring no longer throws a residue's opacity away
  private _opacity: Float32Array = new Float32Array(0);
  private _colorAlpha: Float32Array = new Float32Array(0);
  private _callBeginEnd: boolean;

  constructor(structure: AssocStructure, callColoringBeginEnd: boolean) {
    this._structure = structure;
    this._assocs = [];
    this._callBeginEnd = callColoringBeginEnd;
  }

  addAssoc(atom: AssocAtom, va: AssocVertexArray, vertStart: number, vertEnd: number,
           copy?: number): void {
    this._assocs.push({
      atom: atom, vertexArray : va, vertStart : vertStart, vertEnd : vertEnd,
      copy : copy === undefined ? null : copy,
    });
  }

  recolor(colorOp: ColorOp, view: AssocView): void {
    // allocate buffer to hold all colors of the view.
    const colorData = new Float32Array(view.atomCount()*4);
    if (this._callBeginEnd) {
      // FIXME: does this need to be called on the complete structure or the
      // view?
      colorOp.begin(this._structure);
    }

    const atomMap: Record<number, number> = {};
    view.eachAtom(function(atom, index) {
      atomMap[atom.index()] = index;
      colorOp.colorFor(atom, colorData, index*4);
    });
    if (this._callBeginEnd) {
      colorOp.end();
    }
    // apply the color to the actual interleaved vertex array, keeping the
    // alpha of every association setOpacity() holds an override for.
    const opacity = this._opacity = growFlags(this._opacity, this._assocs.length);
    const colorAlpha = this._colorAlpha =
        growFlags(this._colorAlpha, this._assocs.length);
    for (let i = 0; i < this._assocs.length; ++i) {
      const assoc = this._assocs[i]!;
      const ai = atomMap[assoc.atom.index()];
      if (ai === undefined) {
        continue;
      }
      const r = colorData[ai*4+0]!, g = colorData[ai*4+1]!,
          b = colorData[ai*4+2]!, a = colorData[ai*4+3]!;
      colorAlpha[i] = a;
      const override = opacity[i]!;
      const alpha = Number.isNaN(override) ? a : override;
      const va = assoc.vertexArray;
      for (let j = assoc.vertStart ; j < assoc.vertEnd; ++j) {
        va.setColor(j, r, g, b, alpha);
      }
    }
  }

  getColorForAtom(atom: AssocAtom, color: number[]): number[] | null {
    // FIXME: this can potentially get slow when called for many atoms
    for (let i = 0; i < this._assocs.length; ++i) {
      const assoc = this._assocs[i]!;
      if (assoc.atom.full() === atom.full()) {
        // for atom-based color, the color for each atom is constant, so just
        // use any vertex to the determine color.
        // the alpha is the effective one, i.e. an opacity override where
        // setOpacity() set one and the color's own alpha otherwise
        return assoc.vertexArray.getColor(assoc.vertStart, color);
      }
    }
    return null;
  }

  // per-vertex flag: 1 = selected, -1 = hovered (wins over selected), -2 =
  // hovered and selected (the shaders tint the other symmetry copies as
  // selected), 0 = neither. Hover is negative so that interpolating between
  // hovered and unselected never passes through the selected range.
  // hoverCopy: for geometry with built-in symmetry copies, only that
  // copy's vertices are hovered (the others show the selection only)
  setSelection(view: AssocView, hover?: AssocView | null, hoverCopy?: number | null): void {
    const flags: Record<number, number> = {};
    view.eachAtom(function(atom) {
      flags[atom.index()] = 1.0;
    });
    if (hover) {
      hover.eachAtom(function(atom) {
        flags[atom.index()] = flags[atom.index()] === 1.0 ? -2.0 : -1.0;
      });
    }
    const perCopy = hoverCopy !== undefined && hoverCopy !== null;
    const applied = this._applied = growFlags(this._applied, this._assocs.length);
    for (let i = 0; i < this._assocs.length; ++i) {
      const assoc = this._assocs[i]!;
      let selected = flags[assoc.atom.index()] || 0.0;
      if (selected < 0.0 && perCopy && assoc.copy !== null && assoc.copy !== hoverCopy) {
        selected = selected < -1.5 ? 1.0 : 0.0;
      }
      if (applied[i] === selected) {
        continue;
      }
      applied[i] = selected;
      const va = assoc.vertexArray;
      for (let j = assoc.vertStart ; j < assoc.vertEnd; ++j) {
        va.setSelected(j, selected);
      }
    }
  }

  // val overrides the alpha the color operation gives these vertices, and
  // keeps overriding it across recoloring. null clears the override, so
  // that the color's own alpha applies again.
  setOpacity(val: number | null, view: AssocView): void {
    const atomMap: Record<number, boolean> = {};
    view.eachAtom(function(atom) {
      atomMap[atom.index()] = true;
    });
    const opacity = this._opacity = growFlags(this._opacity, this._assocs.length);
    const colorAlpha = this._colorAlpha =
        growFlags(this._colorAlpha, this._assocs.length);
    const scratch = [0.0, 0.0, 0.0, 0.0];
    // apply the opacity to the actual interleaved vertex array.
    for (let i = 0; i < this._assocs.length; ++i) {
      const assoc = this._assocs[i]!;
      const ai = atomMap[assoc.atom.index()];
      if (ai !== true) {
        continue;
      }
      const previous = opacity[i]!;
      if (val === null && Number.isNaN(previous)) {
        continue;
      }
      const va = assoc.vertexArray;
      if (Number.isNaN(previous)) {
        // the first override for these vertices: the alpha they carry is
        // still the color's, so keep it for when the override is cleared
        colorAlpha[i] = va.getColor(assoc.vertStart, scratch)[3]!;
      }
      const alpha = val === null ? colorAlpha[i]! : val;
      opacity[i] = val === null ? NaN : val;
      if (alpha === previous) {
        continue;
      }
      for (let j = assoc.vertStart ; j < assoc.vertEnd; ++j) {
        va.setOpacity(j, alpha);
      }
    }
  }
}

interface TraceAssocEntry {
  traceIndex: number;
  slice: number;
  vertStart: number;
  vertEnd: number;
  vertexArray: AssocVertexArray;
}

// handles the association between a trace element, and sets of vertices.
export class TraceVertexAssoc {
  _structure: AssocStructure;
  private _assocs: TraceAssocEntry[];
  // the selection flag last written to each association's vertices, so
  // that setSelection() only rewrites the ones that changed: moving the
  // hover from one residue to the next touches two residues' vertices, not
  // all of them
  private _applied: Float32Array = new Float32Array(0);
  private _callBeginEnd: boolean;
  private _interpolation: number;
  private _perResidueColors: Record<number, Float32Array>;
  // opacity is kept out of _perResidueColors, which stays the colors as
  // the color operation gave them: per trace, the override setOpacity()
  // holds for each residue (NaN where none is set). Only the composition
  // of the two reaches the vertex arrays, so recoloring no longer throws
  // a residue's opacity away
  private _perResidueOpacity: Record<number, Float32Array>;

  constructor(structure: AssocStructure, interpolation: number, callColoringBeginEnd: boolean) {
    this._structure = structure;
    this._assocs = [];
    this._callBeginEnd = callColoringBeginEnd;
    this._interpolation = interpolation || 1;
    this._perResidueColors = {};
    this._perResidueOpacity = {};
  }

  setPerResidueColors(traceIndex: number, colors: Float32Array): void {
    this._perResidueColors[traceIndex] = colors;
  }

  addAssoc(
    traceIndex: number, vertexArray: AssocVertexArray, slice: number, vertStart: number, vertEnd: number
  ): void {
    this._assocs.push({ traceIndex: traceIndex, slice : slice,
                        vertStart : vertStart, vertEnd : vertEnd,
                        vertexArray : vertexArray});
  }

  recolor(colorOp: ColorOp, view: AssocView): void {
    // FIXME: this function might create quite a few temporary buffers.
    // use buffer pool to avoid hitting the GC and having to go through
    // the slow creation of typed arrays.
    if (this._callBeginEnd) {
      // FIXME: does this need to be called on the complete structure?
      colorOp.begin(this._structure);
    }
    const colorData: Float32Array[] = [];
    let i, j;
    const traces = this._structure.backboneTraces();
    console.assert(!!this._perResidueColors,
                  "per-residue colors must be set for recoloring to work");
    for (i = 0; i < traces.length; ++i) {
      // get current residue colors
      const data = this._perResidueColors[i]!;
      console.assert(!!data, "no per-residue colors. Seriously, man?");
      let index = 0;
      const trace = traces[i]!;
      for (j = 0; j < trace.length(); ++j) {
        if (!view.containsResidue(trace.residueAt(j))) {
          index+=4;
          continue;
        }
        colorOp.colorFor(trace.centralAtomAt(j), data, index);
        index+=4;
      }
      colorData.push(this._composedColors(i, trace.length()));
    }

    this._uploadColors(colorData);
    if (this._callBeginEnd) {
      colorOp.end();
    }
  }

  // the RGBA to upload for a trace: its colors, with the alpha of every
  // residue setOpacity() holds an override for replaced by it, then
  // interpolated like the colors, so opacity still varies smoothly from
  // one residue to the next
  private _composedColors(traceIndex: number, length: number): Float32Array {
    const colors = this._perResidueColors[traceIndex]!;
    const opacity = this._perResidueOpacity[traceIndex];
    let data = colors;
    if (opacity !== undefined) {
      // on a copy: _perResidueColors keeps the color's own alpha
      data = new Float32Array(colors);
      for (let j = 0; j < length; ++j) {
        const override = opacity[j]!;
        if (!Number.isNaN(override)) {
          data[j*4 + 3] = override;
        }
      }
    }
    if (this._interpolation > 1) {
      return colorModule.interpolateColor(data, this._interpolation);
    }
    return data;
  }

  // store the colors in the actual interleaved vertex arrays.
  private _uploadColors(colorData: Float32Array[]): void {
    for (let i = 0; i < this._assocs.length; ++i) {
      const assoc = this._assocs[i]!;
      const ai = assoc.slice;
      const newColors = colorData[assoc.traceIndex]!;
      const r = newColors[ai*4]!,   g = newColors[ai*4+1]!,
          b = newColors[ai*4+2]!, a = newColors[ai*4+3]!;
      const va = assoc.vertexArray;
      for (let j = assoc.vertStart ; j < assoc.vertEnd; ++j) {
        va.setColor(j, r, g, b, a);
      }
    }
  }

  getColorForAtom(atom: { full(): { residue(): unknown } }, color: number[]): number[] | null {
    // FIXME: this can potentially get slow when called for many atoms
    let i, j;
    const traces = this._structure.backboneTraces();
    const residue = atom.full().residue();
    for (i = 0; i < traces.length; ++i) {
      const data = this._perResidueColors[i]!;
      let index = 0;
      const trace = traces[i]!;
      for (j = 0; j < trace.length(); ++j) {
        if (residue === (trace.residueAt(j) as { full(): unknown }).full()) {
          color[0] = data[index + 0]!;
          color[1] = data[index + 1]!;
          color[2] = data[index + 2]!;
          // the effective alpha: an opacity override where setOpacity()
          // set one, the color's own alpha otherwise
          const opacity = this._perResidueOpacity[i];
          const override = opacity === undefined ? NaN : opacity[j]!;
          color[3] = Number.isNaN(override) ? data[index + 3]! : override;
          return color;
        }
        index+=4;
      }
    }
    return null;
  }

  // see AtomVertexAssoc.setSelection for the flag values.
  setSelection(view: AssocView, hover?: AssocView | null): void {
    const selData: Float32Array[] = [];
    let i, j;
    const traces = this._structure.backboneTraces();
    for (i = 0; i < traces.length; ++i) {
      const trace = traces[i]!;
      const data = new Float32Array(trace.length());
      for (j = 0; j < trace.length(); ++j) {
        const residue = trace.residueAt(j);
        data[j] = hover && hover.containsResidue(residue) ? -1.0 :
                  view.containsResidue(residue) ? 1.0 : 0.0;
      }
      selData.push(data);
    }

    // store the flags in the actual interleaved vertex array. Each point of
    // the interpolated trace takes the flag of its nearest residue: unlike a
    // linear blend, this keeps a hovered residue (-1) full width next to a
    // selected one (1).
    const applied = this._applied = growFlags(this._applied, this._assocs.length);
    const interpolation = this._interpolation;
    for (i = 0; i < this._assocs.length; ++i) {
      const assoc = this._assocs[i]!;
      const a = selData[assoc.traceIndex]![Math.round(assoc.slice / interpolation)]!;
      if (applied[i] === a) {
        continue;
      }
      applied[i] = a;
      const va = assoc.vertexArray;
      for (j = assoc.vertStart ; j < assoc.vertEnd; ++j) {
        va.setSelected(j, a);
      }
    }
  }

  // see AtomVertexAssoc.setOpacity: val overrides the color's alpha for
  // the residues in view and survives recoloring, null clears it again.
  setOpacity(val: number | null, view: AssocView): void {
    const colorData: Float32Array[] = [];
    let i, j;
    const traces = this._structure.backboneTraces();
    for (i = 0; i < traces.length; ++i) {
      const trace = traces[i]!;
      let opacity = this._perResidueOpacity[i];
      if (opacity === undefined) {
        if (val === null) {
          // no override to clear
          colorData.push(this._composedColors(i, trace.length()));
          continue;
        }
        opacity = this._perResidueOpacity[i] =
            new Float32Array(trace.length()).fill(NaN);
      }
      for (j = 0; j < trace.length(); ++j) {
        if (!view.containsResidue(trace.residueAt(j))) {
          continue;
        }
        opacity[j] = val === null ? NaN : val;
      }
      colorData.push(this._composedColors(i, trace.length()));
    }

    this._uploadColors(colorData);
  }
}

export default {
  TraceVertexAssoc : TraceVertexAssoc,
  AtomVertexAssoc : AtomVertexAssoc
};
