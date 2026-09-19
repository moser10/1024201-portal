/**
 * 24 hand-curated blueprints. Every row has a unique combination of brick
 * topology, gate positions, channel direction and lower maze bars.
 */
export const LEVEL_BLUEPRINTS = [
  { rows: 7, cols: 12, shape: 0, gates: [-138], guides: [1], bars: [[405, -210]] },
  { rows: 8, cols: 13, shape: 1, gates: [-196, 164], guides: [-1, 1], bars: [[438, 96]] },
  { rows: 9, cols: 14, shape: 2, gates: [-224, 0, 206], guides: [1, -1, 1], bars: [[390, -72], [462, 178]] },
  { rows: 7, cols: 15, shape: 3, gates: [126], guides: [-1], bars: [[432, 204]] },
  { rows: 8, cols: 12, shape: 4, gates: [-162, 191], guides: [1, -1], bars: [[398, 12], [468, -184]] },
  { rows: 9, cols: 13, shape: 5, gates: [-208, 18, 222], guides: [-1, 1, -1], bars: [[424, -136]] },
  { rows: 7, cols: 14, shape: 6, gates: [-68], guides: [1], bars: [[382, 156], [450, -108]] },
  { rows: 8, cols: 15, shape: 7, gates: [-230, 112], guides: [-1, -1], bars: [[442, 38]] },
  { rows: 9, cols: 12, shape: 8, gates: [-176, 32, 218], guides: [1, 1, -1], bars: [[396, -196], [474, 84]] },
  { rows: 7, cols: 13, shape: 9, gates: [218], guides: [-1], bars: [[416, -42]] },
  { rows: 8, cols: 14, shape: 10, gates: [-104, 210], guides: [1, 1], bars: [[386, 194], [452, -174]] },
  { rows: 9, cols: 15, shape: 11, gates: [-238, -28, 180], guides: [-1, 1, 1], bars: [[436, -92]] },
  { rows: 7, cols: 12, shape: 12, gates: [42], guides: [-1], bars: [[402, 118], [470, -224]] },
  { rows: 8, cols: 13, shape: 13, gates: [-212, 74], guides: [1, -1], bars: [[448, -12]] },
  { rows: 9, cols: 14, shape: 14, gates: [-188, 24, 236], guides: [-1, -1, 1], bars: [[388, -158], [458, 164]] },
  { rows: 7, cols: 15, shape: 15, gates: [-226], guides: [1], bars: [[428, 72]] },
  { rows: 8, cols: 12, shape: 16, gates: [-54, 224], guides: [-1, 1], bars: [[394, -232], [466, 24]] },
  { rows: 9, cols: 13, shape: 17, gates: [-230, -4, 154], guides: [1, -1, -1], bars: [[440, 212]] },
  { rows: 7, cols: 14, shape: 18, gates: [172], guides: [1], bars: [[384, -88], [454, 132]] },
  { rows: 8, cols: 15, shape: 19, gates: [-184, 146], guides: [-1, 1], bars: [[422, -208]] },
  { rows: 9, cols: 12, shape: 20, gates: [-216, 8, 232], guides: [1, 1, 1], bars: [[400, 54], [476, -152]] },
  { rows: 7, cols: 13, shape: 21, gates: [-16], guides: [-1], bars: [[446, -198]] },
  { rows: 8, cols: 14, shape: 22, gates: [-224, 198], guides: [1, -1], bars: [[392, 150], [460, -52]] },
  { rows: 9, cols: 15, shape: 23, gates: [-204, 56, 226], guides: [-1, 1, -1], bars: [[430, -126], [486, 218]] },
];

// Sawtooth pacing: hard four-ring stages are followed by relief stages.
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

/**
 * One readable diagonal route from the lowest deflector through every ring.
 * Coordinates are offsets from the board center; inner ring comes first.
 */
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

function baseShape(shape, row, col, rows, cols) {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  switch (shape % 8) {
    case 0: return !(row > 1 && row < rows - 2 && col > 2 && col < cols - 3);
    case 1: return (row + col) % 3 !== 0;
    case 2: return Math.abs(col - cx) <= row + 2;
    case 3: return row % 2 === 0 || col % 3 !== 1;
    case 4: return Math.abs(col - cx) + Math.abs(row - cy) <= Math.min(rows, cols) * 0.58;
    case 5: return col < 2 || col >= cols - 2 || row < 2 || row >= rows - 2 || (row + col) % 4 === 0;
    case 6: return Math.sin((col / cols) * Math.PI * 3 + row * 0.8) > -0.35;
    default: return (row * 3 + col * 5) % 7 !== 0;
  }
}

export function buildLevelSpec(index) {
  const bp = LEVEL_BLUEPRINTS[index];
  if (!bp) throw new RangeError(`Unknown level ${index + 1}`);
  const mask = [];
  for (let row = 0; row < bp.rows; row++) {
    const line = [];
    for (let col = 0; col < bp.cols; col++) {
      const base = baseShape(bp.shape, row, col, bp.rows, bp.cols);
      // Per-level cuts make all 24 brick arrays unique, not just rotated copies.
      const cut = (row * 17 + col * 31 + bp.shape * 13) % (11 + (bp.shape % 5)) === 0;
      line.push(base && !cut ? 1 : 0);
    }
    mask.push(line);
  }
  return {
    ...bp,
    number: index + 1,
    speed: Math.min(430, 300 + index * 5),
    seed: 1042 + (index + 1) * 201,
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
