/**
 * Guesses the LEGO color of a piece from its photo. Pure functions (no DOM): they take RGBA pixels
 * and the catalog colors, so they can be tested with synthetic images.
 *
 * It is a suggestion, not a measurement: lighting, flash, shadows and the camera's white balance move
 * every color. Distances are computed in CIE Lab with the lightness weighted down, so a brighter or
 * darker shot of the same plastic still lands on the same color.
 */
export type Lab = [number, number, number];

export interface Cluster {
  lab: Lab;
  /** Share of the piece's pixels (0-1). */
  share: number;
}

export interface PaletteColor {
  color_id: number;
  rgb: string | null;
  is_trans: boolean;
}

const L_WEIGHT = 0.6;

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function distance(a: Lab, b: Lab): number {
  const dl = (a[0] - b[0]) * L_WEIGHT;
  return Math.hypot(dl, a[1] - b[1], a[2] - b[2]);
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((p, q) => p - q);
  return s.length ? s[s.length >> 1] : 0;
};

/**
 * Main colors of the piece in the photo. The piece is assumed to be near the center and the
 * background to be what the border looks like; pixels that match the background are ignored. When
 * almost nothing differs from the background (a white piece on white paper) the whole center is used.
 */
export function pieceColors(data: Uint8ClampedArray | number[], width: number, height: number, k = 3): Cluster[] {
  const pixel = (x: number, y: number): Lab => {
    const i = (y * width + x) * 4;
    return rgbToLab(data[i], data[i + 1], data[i + 2]);
  };

  // background = per-channel median of a thin ring at the border
  const ring = Math.max(1, Math.round(Math.min(width, height) * 0.06));
  const border: Lab[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < ring || y < ring || x >= width - ring || y >= height - ring) border.push(pixel(x, y));
    }
  }
  const bg: Lab = [median(border.map((p) => p[0])), median(border.map((p) => p[1])), median(border.map((p) => p[2]))];

  // center region (inner 70%)
  const x0 = Math.floor(width * 0.15), x1 = Math.ceil(width * 0.85);
  const y0 = Math.floor(height * 0.15), y1 = Math.ceil(height * 0.85);
  const center: Lab[] = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) center.push(pixel(x, y));
  if (!center.length) return [];

  const fg = center.filter((p) => distance(p, bg) > 14);
  const pts = fg.length >= center.length * 0.08 ? fg : center;
  return kmeans(pts, k).filter((c) => c.share >= 0.12);
}

function kmeans(pts: Lab[], k: number): Cluster[] {
  // farthest-point initialisation: deterministic and spreads the seeds
  const cents: Lab[] = [pts[0]];
  while (cents.length < Math.min(k, pts.length)) {
    let best = pts[0], bestD = -1;
    for (const p of pts) {
      const d = Math.min(...cents.map((c) => distance(p, c)));
      if (d > bestD) { bestD = d; best = p; }
    }
    if (bestD < 6) break; // the rest is the same color
    cents.push(best);
  }
  let assign = new Array<number>(pts.length).fill(0);
  for (let it = 0; it < 8; it++) {
    assign = pts.map((p) => {
      let bi = 0, bd = Infinity;
      cents.forEach((c, i) => { const d = distance(p, c); if (d < bd) { bd = d; bi = i; } });
      return bi;
    });
    cents.forEach((_, i) => {
      const m = pts.filter((_p, j) => assign[j] === i);
      if (m.length) cents[i] = [m.reduce((s, p) => s + p[0], 0) / m.length, m.reduce((s, p) => s + p[1], 0) / m.length, m.reduce((s, p) => s + p[2], 0) / m.length];
    });
  }
  const counts = cents.map((_, i) => assign.filter((a) => a === i).length);
  return cents.map((lab, i) => ({ lab, share: counts[i] / pts.length })).sort((a, b) => b.share - a.share);
}

/**
 * Catalog colors ranked by how close they are to the piece's colors (dominant color counts most).
 * `known` (the colors this part exists in) go first; if fewer than `n` are known, the closest of the
 * others fill up to `n`. Colors without an rgb value are skipped; transparent ones are mildly demoted.
 */
export function suggestColors<T extends PaletteColor>(clusters: Cluster[], palette: T[], known: Set<number>, n = 5): Array<{ color: T; known: boolean }> {
  if (!clusters.length) return [];
  const total = clusters.reduce((s, c) => s + c.share, 0) || 1;
  const scored = palette
    .filter((c) => c.rgb && c.color_id >= 0)
    .map((c) => {
      const lab = rgbToLab(...hexToRgb(c.rgb!));
      const d = clusters.reduce((s, cl) => s + (cl.share / total) * distance(cl.lab, lab), 0);
      return { color: c, score: d + (c.is_trans ? 4 : 0), known: known.has(c.color_id) };
    })
    .sort((a, b) => a.score - b.score);
  const inKnown = scored.filter((s) => s.known).slice(0, n);
  const rest = scored.filter((s) => !s.known).slice(0, Math.max(0, n - inKnown.length));
  return [...inKnown, ...rest].sort((a, b) => a.score - b.score).map(({ color, known: k }) => ({ color, known: k }));
}
