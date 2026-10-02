// The Symbol Nomenclature for Glycans (SNFG, Varki et al. 2015; see
// https://www.ncbi.nlm.nih.gov/glycans/snfg.html): every monosaccharide has
// a shape for its class (hexose = circle, HexNAc = square, ...) and a color
// for its stereochemistry (Glc = blue, Man = green, Gal = yellow, ...).
// In 3D the circle becomes a sphere, the square a cube, the triangle a
// cone and so on, as in Mol*'s and Sweet Unity Mol's 3D-SNFG.

export type Shape =
  | 'sphere'          // hexose
  | 'cube'            // HexNAc
  | 'crossedCube'     // hexosamine: cube split diagonally, half white
  | 'dividedDiamond'  // hexuronate: diamond split in half, half white
  | 'cone'            // deoxyhexose
  | 'dividedCone'     // deoxyHexNAc: cone split lengthwise, half white
  | 'flatRectangle'   // di-deoxyhexose
  | 'star'            // pentose
  | 'diamond'         // deoxynonulosonate (sialic acids)
  | 'flatDiamond'     // di-deoxynonulosonate
  | 'flatHexagon'     // unknown
  | 'pentagon';       // assigned

export interface SnfgSymbol {
  shape: Shape;
  color: [number, number, number];
}

// the SNFG palette (its CMYK values in RGB, 0-1)
function hex(value: string): [number, number, number] {
  return [parseInt(value.slice(1, 3), 16) / 255,
          parseInt(value.slice(3, 5), 16) / 255,
          parseInt(value.slice(5, 7), 16) / 255];
}
export const COLORS = {
  white: hex('#FFFFFF'),
  blue: hex('#0090BC'),
  green: hex('#00A651'),
  yellow: hex('#FFD400'),
  orange: hex('#F47920'),
  pink: hex('#F69EA1'),
  purple: hex('#A54399'),
  lightBlue: hex('#8FCCE9'),
  brown: hex('#A17A4D'),
  red: hex('#ED1C24'),
};
type ColorName = keyof typeof COLORS;

// [shape, [symbol name, color]...] -- one row of the SNFG table each
const TABLE: [Shape, [string, ColorName][]][] = [
  ['sphere', [['Glc', 'blue'], ['Man', 'green'], ['Gal', 'yellow'], ['Gul', 'orange'],
              ['Alt', 'pink'], ['All', 'purple'], ['Tal', 'lightBlue'], ['Ido', 'brown']]],
  ['cube', [['GlcNAc', 'blue'], ['ManNAc', 'green'], ['GalNAc', 'yellow'],
            ['GulNAc', 'orange'], ['AltNAc', 'pink'], ['AllNAc', 'purple'],
            ['TalNAc', 'lightBlue'], ['IdoNAc', 'brown']]],
  ['crossedCube', [['GlcN', 'blue'], ['ManN', 'green'], ['GalN', 'yellow'],
                   ['GulN', 'orange'], ['AltN', 'pink'], ['AllN', 'purple'],
                   ['TalN', 'lightBlue'], ['IdoN', 'brown']]],
  ['dividedDiamond', [['GlcA', 'blue'], ['ManA', 'green'], ['GalA', 'yellow'],
                      ['GulA', 'orange'], ['AltA', 'pink'], ['AllA', 'purple'],
                      ['TalA', 'lightBlue'], ['IdoA', 'brown']]],
  ['cone', [['Qui', 'blue'], ['Rha', 'green'], ['6dGul', 'orange'], ['6dAlt', 'pink'],
            ['6dTal', 'lightBlue'], ['Fuc', 'red']]],
  ['dividedCone', [['QuiNAc', 'blue'], ['RhaNAc', 'green'], ['6dAltNAc', 'pink'],
                   ['6dTalNAc', 'lightBlue'], ['FucNAc', 'red']]],
  ['flatRectangle', [['Oli', 'blue'], ['Tyv', 'green'], ['Abe', 'orange'], ['Par', 'pink'],
                     ['Dig', 'purple'], ['Col', 'lightBlue']]],
  ['star', [['Ara', 'green'], ['Lyx', 'yellow'], ['Xyl', 'orange'], ['Rib', 'pink']]],
  ['diamond', [['Kdn', 'green'], ['Neu5Ac', 'purple'], ['Neu5Gc', 'lightBlue'],
               ['Neu', 'brown'], ['Sia', 'red']]],
  ['flatDiamond', [['Pse', 'green'], ['Leg', 'yellow'], ['Aci', 'pink'],
                   ['4eLeg', 'lightBlue']]],
  ['flatHexagon', [['Bac', 'blue'], ['LDmanHep', 'green'], ['Kdo', 'yellow'],
                   ['Dha', 'orange'], ['DDmanHep', 'pink'], ['MurNAc', 'purple'],
                   ['MurNGc', 'lightBlue'], ['Mur', 'brown']]],
  ['pentagon', [['Api', 'blue'], ['Fru', 'green'], ['Tag', 'yellow'], ['Sor', 'orange'],
                ['Psi', 'pink']]],
];

const SYMBOLS = new Map<string, SnfgSymbol>();
for (const [shape, entries] of TABLE) {
  for (const [name, colorName] of entries) {
    SYMBOLS.set(name, { shape, color: COLORS[colorName] });
  }
}

// a sugar SNFG has no symbol for: a white flat hexagon, like 'unknown'
export const UNKNOWN: SnfgSymbol = { shape: 'flatHexagon', color: COLORS.white };

// the symbol for an SNFG name ('GlcNAc', 'Neu5Ac', ...), or UNKNOWN
export function symbolFor(name: string | null | undefined): SnfgSymbol {
  return (name && SYMBOLS.get(name)) || UNKNOWN;
}

// SNFG names of the most common PDB Chemical Component Dictionary sugars,
// for structures that don't carry the name themselves: mmCIF files from
// the PDB do (the reader stores it as the residue's 'snfg' prop), PDB
// format files and many other mmCIF files don't.
export const CCD_TO_SNFG: Record<string, string> = {
  GLC: 'Glc', BGC: 'Glc',
  MAN: 'Man', BMA: 'Man',
  GAL: 'Gal', GLA: 'Gal',
  NAG: 'GlcNAc', NDG: 'GlcNAc',
  NGA: 'GalNAc', A2G: 'GalNAc',
  GCS: 'GlcN', PA1: 'GlcN',
  GCU: 'GlcA', BDP: 'GlcA',
  ADA: 'GalA', GTR: 'GalA',
  IDR: 'IdoA',
  FUC: 'Fuc', FUL: 'Fuc',
  RAM: 'Rha',
  XYS: 'Xyl', XYP: 'Xyl',
  ARA: 'Ara', ARB: 'Ara',
  SIA: 'Neu5Ac', SLB: 'Neu5Ac',
  NGC: 'Neu5Gc', NGE: 'Neu5Gc',
  KDO: 'Kdo',
  FRU: 'Fru',
};
