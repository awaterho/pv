// Symmetry copies for the custom-mesh add-ons (filled rings, bases, SNFG
// symbols), which build their geometry themselves: the same showRelated
// option pv's own render styles take, by drawing each residue once for
// every operator of the assembly that covers its chain.
import { mat3, mat4, vec3 } from 'gl-matrix';

interface CopyStructure {
  assembly(name: string): {
    generators(): { chains(): string[]; matrices(): mat4[] }[];
  } | null;
}

export interface Copy {
  // the operator, and which (label) chains it applies to
  matrix: mat4;
  chains: Set<string> | null;
}

// the copies to draw for showRelated: 'asym' (or none, or an assembly the
// structure doesn't have) is just the identity for all chains.
export function copiesFor(structure: unknown, showRelated?: string): Copy[] {
  const s = structure as Partial<CopyStructure>;
  const assembly = showRelated && showRelated !== 'asym' && typeof s.assembly === 'function'
    ? s.assembly(showRelated) : null;
  if (!assembly) {
    return [{ matrix: mat4.create(), chains: null }];
  }
  const copies: Copy[] = [];
  for (const generator of assembly.generators()) {
    const chains = new Set(generator.chains());
    for (const matrix of generator.matrices()) {
      copies.push({ matrix, chains });
    }
  }
  return copies;
}

interface Mesh {
  addTriangles(positions: ArrayLike<number>, options?: Record<string, unknown>): void;
  addTube(start: vec3, end: vec3, radius: number, options?: Record<string, unknown>): void;
}

// a stand-in for mesh that transforms everything added through it by
// matrix first: positions and tube ends by the full operator, normals by
// its rotation. Each shape is tagged as belonging to copy (customMesh's
// copy option), for picking and per-copy hover.
export function transformed<M extends Mesh>(mesh: M, matrix: mat4, copy: number): M {
  const rotation = mat3.fromMat4(mat3.create(), matrix);
  const p = vec3.create();
  const transform = (values: ArrayLike<number>, asNormals: boolean): number[] => {
    const out = new Array<number>(values.length);
    for (let i = 0; i < values.length; i += 3) {
      vec3.set(p, values[i]!, values[i + 1]!, values[i + 2]!);
      if (asNormals) {
        vec3.transformMat3(p, p, rotation);
      } else {
        vec3.transformMat4(p, p, matrix);
      }
      out[i] = p[0]!;
      out[i + 1] = p[1]!;
      out[i + 2] = p[2]!;
    }
    return out;
  };
  return Object.assign(Object.create(mesh) as M, {
    addTriangles(positions: ArrayLike<number>, options?: Record<string, unknown>): void {
      const opts: Record<string, unknown> = { ...options, copy };
      if (opts.normals !== undefined) {
        opts.normals = transform(opts.normals as ArrayLike<number>, true);
      }
      mesh.addTriangles(transform(positions, false), opts);
    },
    addTube(start: vec3, end: vec3, radius: number, options?: Record<string, unknown>): void {
      const s = vec3.transformMat4(vec3.create(), start, matrix);
      const e = vec3.transformMat4(vec3.create(), end, matrix);
      mesh.addTube(s, e, radius, { ...options, copy });
    },
    addSphere(center: vec3, radius: number, options?: Record<string, unknown>): void {
      const c = vec3.transformMat4(vec3.create(), center, matrix);
      (mesh as unknown as { addSphere(c: vec3, r: number, o?: unknown): void })
        .addSphere(c, radius, { ...options, copy });
    },
  });
}
