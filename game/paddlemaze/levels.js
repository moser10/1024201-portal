/**
 * 24 original brick layouts. Old procedural shape/cut maps are unused.
 * Prime stages 2,3,5,7,11,13,17,19,23 spell PRIMENUMB in uppercase bricks.
 */

export const PRIME_LETTER_STAGES = Object.freeze({
  2: "P",
  3: "R",
  5: "I",
  7: "M",
  11: "E",
  13: "N",
  17: "U",
  19: "M",
  23: "B",
});

const LETTER_ART = Object.freeze({
  P: [
    "###########....",
    "##.......##....",
    "##.......##....",
    "###########....",
    "##.............",
    "##.............",
    "##.............",
    "##.............",
    "##.............",
  ],
  R: [
    "###########....",
    "##.......##....",
    "##.......##....",
    "###########....",
    "##..##.........",
    "##...##........",
    "##....##.......",
    "##.....##......",
    "##......##.....",
  ],
  I: [
    "...#########...",
    ".....#####.....",
    ".....#####.....",
    ".....#####.....",
    ".....#####.....",
    ".....#####.....",
    ".....#####.....",
    ".....#####.....",
    "...#########...",
  ],
  M: [
    "##.........##..",
    "###.......###..",
    "##.##...##.##..",
    "##..##.##..##..",
    "##...###...##..",
    "##....#....##..",
    "##.........##..",
    "##.........##..",
    "##.........##..",
  ],
  E: [
    "##############.",
    "##.............",
    "##.............",
    "###########....",
    "##.............",
    "##.............",
    "##.............",
    "##.............",
    "##############.",
  ],
  N: [
    "##.........##..",
    "###........##..",
    "##.##......##..",
    "##..##.....##..",
    "##...##....##..",
    "##....##...##..",
    "##.....##..##..",
    "##......##.##..",
    "##.......####..",
  ],
  U: [
    "##.........##..",
    "##.........##..",
    "##.........##..",
    "##.........##..",
    "##.........##..",
    "##.........##..",
    "##.........##..",
    ".##.......##...",
    "..#########....",
  ],
  B: [
    "############...",
    "##........##...",
    "##........##...",
    "############...",
    "##........##...",
    "##........##...",
    "##........##...",
    "##........##...",
    "############...",
  ],
});

/** Second M (stage 19): same letter, extra stem row so the mask is unique. */
const LETTER_ART_M2 = [
  ".##.........##.",
  ".###.......###.",
  ".##.##...##.##.",
  ".##..##.##..##.",
  ".##...###...##.",
  ".##....#....##.",
  ".##.........##.",
  ".##.........##.",
  ".##.........##.",
  ".##.........##.",
];

const DENSE_ART = Object.freeze({
  fortress: [
    "###############",
    "###############",
    "###.#.###.#.###",
    "##....###....##",
    "###.#.###.#.###",
    "##....###....##",
    "###.#.###.#.###",
    "###############",
    "###############",
  ],
  diamond: [
    ".....#####.....",
    "....#######....",
    "...#########...",
    "..#####.#####..",
    ".#####...#####.",
    "..#####.#####..",
    "...#########...",
    "....#######....",
    ".....#####.....",
  ],
  pyramid: [
    "......##......",
    ".....####.....",
    "....######....",
    "...########...",
    "..##########..",
    ".############.",
    "##############",
    "##############",
    "##############",
  ],
  nested: [
    "###############",
    "###############",
    "##...........##",
    "##.#########.##",
    "##.#########.##",
    "##.#########.##",
    "##...........##",
    "###############",
    "###############",
  ],
  wave: [
    "###############",
    "......###......",
    "#....#####....#",
    "#...###.##...##",
    "##.###...##.###",
    "#####....#####.",
    ".###......###..",
    "..#........#...",
    "###############",
  ],
  plus: [
    "###..#####..###",
    "###..#####..###",
    ".....#####.....",
    "###############",
    "###############",
    "###############",
    ".....#####.....",
    "###..#####..###",
    "###..#####..###",
  ],
  honeycomb: [
    "##.##.##.##.##.",
    ".##.##.##.##.##",
    "##.##.##.##.##.",
    ".##.##.##.##.##",
    "##.##.##.##.##.",
    ".##.##.##.##.##",
    "##.##.##.##.##.",
    ".##.##.##.##.##",
    "##.##.##.##.##.",
  ],
  stairs: [
    "####.......####",
    "#####.....#####",
    "######...######",
    "#######.#######",
    "###############",
    "###############",
    "###############",
    "###############",
    "###############",
  ],
  hourglass: [
    "###############",
    "###############",
    "....#######....",
    ".....#####.....",
    "......###......",
    ".....#####.....",
    "....#######....",
    "###############",
    "###############",
  ],
  tiles: [
    "###.###.###.###",
    "###.###.###.###",
    "###.###.###.###",
    "...............",
    "###.###.###.###",
    "###.###.###.###",
    "###.###.###.###",
    "...............",
    "###.###.###.###",
  ],
  pillars: [
    "##############",
    "##.##.##.##.##",
    "##.##.##.##.##",
    "##.##.##.##.##",
    "##############",
    "##.##.##.##.##",
    "##.##.##.##.##",
    "##.##.##.##.##",
    "##############",
  ],
  arch: [
    "......###......",
    ".....#####.....",
    "...#########...",
    "..###########..",
    "###############",
    "###############",
    "###############",
    "###############",
    "###############",
  ],
  meander: [
    "###############",
    "#####.#######.#",
    "##.#######.####",
    "#######.#######",
    "####.#######.##",
    "#.#######.#####",
    "######.########",
    "###.#######.###",
    "########.######",
    "###############",
  ],
  bowtie: [
    "###############",
    "...###...###...",
    "....###.###....",
    ".....#####.....",
    "......###......",
    ".....#####.....",
    "....###.###....",
    "...###...###...",
    "###############",
  ],
  islands: [
    "####.####.####.",
    "##.#.##.#.##.#.",
    "####.####.####.",
    "...............",
    "####.####.####.",
    "##.#.##.#.##.#.",
    "####.####.####.",
    "...............",
    "####.####.####.",
  ],
});

function parseArt(lines) {
  if (!lines?.length) throw new Error("empty brick art");
  const cols = lines[0].length;
  return lines.map((line) => {
    if (line.length !== cols) throw new Error("ragged brick art");
    return [...line].map((ch) => (ch === "#" ? 1 : 0));
  });
}

function letterArt(letter, variant) {
  if (letter === "M" && variant === 2) return LETTER_ART_M2;
  const art = LETTER_ART[letter];
  if (!art) throw new Error(`Unknown letter ${letter}`);
  return art;
}

/**
 * Maze geometry is independent of brick silhouettes. Sawtooth ring pacing
 * still follows a hard four-ring stage with a two-ring relief after it.
 */
export const LEVEL_BLUEPRINTS = [
  { rows: 9, cols: 15, gates: [-141], guides: [1], bars: [[403, -201]], motif: "fortress" },
  { rows: 9, cols: 15, gates: [-188, 171], guides: [-1, 1], bars: [[441, 88]], letter: "P" },
  { rows: 9, cols: 15, gates: [-219, 8, 198], guides: [1, -1, 1], bars: [[387, -66], [459, 169]], letter: "R" },
  { rows: 9, cols: 15, gates: [131], guides: [-1], bars: [[428, 211]], motif: "diamond" },
  { rows: 9, cols: 15, gates: [-159, 184], guides: [1, -1], bars: [[396, 18], [471, -177]], letter: "I" },
  { rows: 9, cols: 14, gates: [-211, 22, 217], guides: [-1, 1, -1], bars: [[419, -129]], motif: "pyramid" },
  { rows: 9, cols: 15, gates: [-71], guides: [1], bars: [[379, 149], [448, -101]], letter: "M", letterVariant: 1 },
  { rows: 9, cols: 15, gates: [-227, 109], guides: [-1, -1], bars: [[437, 41]], motif: "nested" },
  { rows: 9, cols: 15, gates: [-173, 36, 221], guides: [1, 1, -1], bars: [[393, -191], [477, 91]], motif: "wave" },
  { rows: 9, cols: 15, gates: [214], guides: [-1], bars: [[411, -39]], motif: "plus" },
  { rows: 9, cols: 15, gates: [-109, 207], guides: [1, 1], bars: [[381, 188], [455, -169]], letter: "E" },
  { rows: 9, cols: 15, gates: [-233, -31, 176], guides: [-1, 1, 1], bars: [[433, -88]], motif: "honeycomb" },
  { rows: 9, cols: 15, gates: [47], guides: [-1], bars: [[399, 121], [468, -219]], letter: "N" },
  { rows: 9, cols: 15, gates: [-209, 79], guides: [1, -1], bars: [[444, -8]], motif: "stairs" },
  { rows: 9, cols: 15, gates: [-181, 27, 239], guides: [-1, -1, 1], bars: [[385, -151], [461, 171]], motif: "hourglass" },
  { rows: 9, cols: 15, gates: [-221], guides: [1], bars: [[425, 77]], motif: "tiles" },
  { rows: 9, cols: 15, gates: [-58, 219], guides: [-1, 1], bars: [[391, -227], [463, 29]], letter: "U" },
  { rows: 9, cols: 14, gates: [-228, -9, 151], guides: [1, -1, -1], bars: [[436, 208]], motif: "pillars" },
  { rows: 10, cols: 15, gates: [169], guides: [1], bars: [[382, -83], [451, 137]], letter: "M", letterVariant: 2 },
  { rows: 9, cols: 15, gates: [-179, 149], guides: [-1, 1], bars: [[418, -203]], motif: "arch" },
  { rows: 10, cols: 15, gates: [-213, 11, 228], guides: [1, 1, 1], bars: [[397, 58], [473, -148]], motif: "meander" },
  { rows: 9, cols: 15, gates: [-19], guides: [-1], bars: [[443, -193]], motif: "bowtie" },
  { rows: 9, cols: 15, gates: [-221, 193], guides: [1, -1], bars: [[389, 153], [457, -47]], letter: "B" },
  { rows: 9, cols: 15, gates: [-198, 61, 223], guides: [-1, 1, -1], bars: [[427, -121], [481, 214]], motif: "islands" },
];

const RING_PACING = Object.freeze([
  2, 2, 3, 3, 4, 2, 3, 4,
  3, 2, 3, 4, 4, 2, 3, 4,
  3, 4, 2, 3, 4, 3, 4, 4,
]);

export function mazeRingPlan(index) {
  const ringCount = RING_PACING[index];
  if (!ringCount) throw new RangeError(`Unknown level ${index + 1}`);
  return {
    ringCount,
    openingsPerRing: ringCount === 2 ? 2 : 1,
  };
}

export function mazeEntryPath(index) {
  const bp = LEVEL_BLUEPRINTS[index];
  if (!bp) throw new RangeError(`Unknown level ${index + 1}`);
  const { ringCount } = mazeRingPlan(index);
  const direction = bp.guides[0] >= 0 ? 1 : -1;
  const base = Math.max(-55, Math.min(55, bp.gates[0] * 0.22));
  const ringCenters = Array.from({ length: ringCount }, (_, ring) => base + direction * ring * 52);
  const outer = ringCenters[ringCenters.length - 1];
  const deflectorCenters = bp.bars.map((_, bar) => outer + direction * (bar + 1) * 48);
  return { direction, ringCenters, deflectorCenters };
}

function brickArtFor(bp, number) {
  if (bp.letter) return letterArt(bp.letter, bp.letterVariant);
  const art = DENSE_ART[bp.motif];
  if (!art) throw new Error(`Missing motif ${bp.motif} for level ${number}`);
  return art;
}

export function buildLevelSpec(index) {
  const bp = LEVEL_BLUEPRINTS[index];
  if (!bp) throw new RangeError(`Unknown level ${index + 1}`);
  const number = index + 1;
  const expectedLetter = PRIME_LETTER_STAGES[number] || null;
  if (expectedLetter && bp.letter !== expectedLetter) {
    throw new Error(`Level ${number} must be letter ${expectedLetter}`);
  }
  if (!expectedLetter && bp.letter) {
    throw new Error(`Level ${number} should not be a letter stage`);
  }
  const art = brickArtFor(bp, number);
  const mask = parseArt(art);
  if (mask.length !== bp.rows || mask[0].length !== bp.cols) {
    throw new Error(`Level ${number} art size ${mask.length}x${mask[0].length} != ${bp.rows}x${bp.cols}`);
  }
  return {
    rows: bp.rows,
    cols: bp.cols,
    gates: bp.gates,
    guides: bp.guides,
    bars: bp.bars,
    letter: bp.letter || null,
    motif: bp.motif || null,
    number,
    speed: Math.min(430, 300 + index * 5),
    seed: 1042 + number * 201,
    mask,
  };
}

export function levelSignature(index) {
  const s = buildLevelSpec(index);
  return JSON.stringify({
    rows: s.rows,
    cols: s.cols,
    gates: s.gates,
    guides: s.guides,
    bars: s.bars,
    mask: s.mask,
  });
}
