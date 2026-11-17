// Generative cover art for builds.
// Each cover is deterministic: the same seed (a post ID) always gives the same artwork,
// drawn from a small set of warm papers and geometric patterns built around the Claude spark.
// A build's poster is its paper colour with the title set on it and this art underneath.

import { raw } from './ui.js';

function hashString(value) {
  let h = 2166136261 >>> 0;
  for (const ch of String(value)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// bg is the paper, a/b/c are the shapes, ink is the colour of type set on the paper.
// Clay is #D97757 on dark papers and #C2552E on light ones, where the lighter clay would wash out.
const PALETTES = {
  blush: { bg: '#F1D8C6', a: '#C2552E', b: '#8C1515', c: '#241F1A', ink: '#241F1A' },
  ink: { bg: '#241F1A', a: '#D97757', b: '#F1E8DA', c: '#C99A2E', ink: '#F1E8DA' },
  sand: { bg: '#E8DDC6', a: '#C2552E', b: '#54613F', c: '#241F1A', ink: '#241F1A' },
  cardinal: { bg: '#8C1515', a: '#F3D5C0', b: '#D97757', c: '#2A0B0B', ink: '#F3D5C0' },
  sage: { bg: '#D9E0CC', a: '#3F5A39', b: '#C2552E', c: '#241F1A', ink: '#241F1A' },
  clay: { bg: '#D97757', a: '#241F1A', b: '#F6E2D2', c: '#8C1515', ink: '#1A1410' },
};
// The order matters: a post's paper is picked by position, so reordering reshuffles every cover.
const PALETTE_ROTATION = ['blush', 'ink', 'sand', 'cardinal', 'sage', 'clay'];

const W = 400;
const H = 220;
const f = (n) => Math.round(n * 10) / 10;

function spark(cx, cy, r1, r2, color, width, rays = 12, twist = 0.12) {
  let d = '';
  for (let i = 0; i < rays; i += 1) {
    const a = (i * 2 * Math.PI) / rays + (i % 2 ? twist : 0);
    const outer = i % 2 ? r2 * 0.82 : r2;
    d += `M${f(cx + r1 * Math.cos(a))} ${f(cy + r1 * Math.sin(a))}L${f(cx + outer * Math.cos(a))} ${f(cy + outer * Math.sin(a))}`;
  }
  return `<path d="${d}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" fill="none"/>`;
}

const PATTERNS = {
  // A big, partly cropped spark with a solid moon.
  spark(r, p) {
    const cx = 250 + r() * 110;
    const cy = 50 + r() * 120;
    const moonX = 40 + r() * 120;
    const moonY = 150 + r() * 50;
    return [
      `<circle cx="${f(moonX)}" cy="${f(moonY)}" r="${f(26 + r() * 22)}" fill="${p.b}"/>`,
      spark(cx, cy, 22, 150 + r() * 40, p.a, 15 + r() * 6),
    ].join('');
  },
  // Concentric arcs from a corner, like a rising sun.
  arcs(r, p) {
    const corner = r() < 0.5 ? [0, H] : [W, H];
    const colors = [p.a, p.b, p.c, p.a];
    let out = '';
    for (let i = 9; i >= 1; i -= 1) {
      out += `<circle cx="${corner[0]}" cy="${corner[1]}" r="${i * 38}" fill="${i % 2 ? colors[(i >> 1) % colors.length] : p.bg}"/>`;
    }
    return out;
  },
  // A quiet dot grid with one bright orbit.
  dots(r, p) {
    let out = '';
    const ox = 140 + r() * 180;
    const oy = 50 + r() * 120;
    for (let x = 14; x < W; x += 24) {
      for (let y = 14; y < H; y += 24) {
        const near = Math.hypot(x - ox, y - oy) < 64;
        out += `<circle cx="${x}" cy="${y}" r="${near ? 3.6 : 2.2}" fill="${near ? p.a : p.c}" opacity="${near ? 1 : 0.22}"/>`;
      }
    }
    return `${out}<circle cx="${f(ox)}" cy="${f(oy)}" r="78" fill="none" stroke="${p.b}" stroke-width="3"/>`
      + `<circle cx="${f(ox + 55)}" cy="${f(oy - 55)}" r="9" fill="${p.b}"/>`;
  },
  // Half sun on the horizon with thin rays.
  sunrise(r, p) {
    const cx = 80 + r() * 240;
    const cy = H - 10;
    let rays = '';
    for (let i = 0; i <= 18; i += 1) {
      const a = Math.PI + (i * Math.PI) / 18;
      rays += `M${f(cx + 96 * Math.cos(a))} ${f(cy + 96 * Math.sin(a))}L${f(cx + 520 * Math.cos(a))} ${f(cy + 520 * Math.sin(a))}`;
    }
    return `<path d="${rays}" stroke="${p.a}" stroke-width="2.4" opacity="0.55"/>`
      + `<circle cx="${f(cx)}" cy="${cy}" r="82" fill="${p.a}"/>`
      + `<rect x="0" y="${cy}" width="${W}" height="${H - cy}" fill="${p.b}"/>`;
  },
  // Diagonal stripes behind a porthole.
  stripes(r, p) {
    const angle = 25 + r() * 40;
    let lines = '';
    for (let x = -W; x < W * 2; x += 30) lines += `<rect x="${x}" y="-200" width="11" height="${H + 400}" fill="${p.a}"/>`;
    const cx = 90 + r() * 220;
    const cy = 70 + r() * 80;
    return `<g transform="rotate(${f(angle)} ${W / 2} ${H / 2})" opacity="0.75">${lines}</g>`
      + `<circle cx="${f(cx)}" cy="${f(cy)}" r="64" fill="${p.bg}"/>`
      + `<circle cx="${f(cx)}" cy="${f(cy)}" r="64" fill="none" stroke="${p.c}" stroke-width="5"/>`
      + spark(cx, cy, 9, 40, p.b, 6);
  },
  // Layered waves.
  waves(r, p) {
    const colors = [p.a, p.b, p.c];
    let out = '';
    for (let i = 0; i < 3; i += 1) {
      const base = 95 + i * 42;
      const amp = 14 + r() * 18;
      const phase = r() * Math.PI * 2;
      let d = `M0 ${H}L0 ${f(base)}`;
      for (let x = 0; x <= W; x += 20) d += `L${x} ${f(base + amp * Math.sin(phase + x / 46))}`;
      d += `L${W} ${H}Z`;
      out += `<path d="${d}" fill="${colors[i]}" opacity="${i === 2 ? 1 : 0.92}"/>`;
    }
    return `<circle cx="${f(60 + r() * 280)}" cy="${f(46 + r() * 20)}" r="22" fill="${p.a}"/>${out}`;
  },
};
const PATTERN_ROTATION = Object.keys(PATTERNS);

// Avalanche the hash so palette and pattern come from independent bits. SALT was chosen so the
// 2025-26 builds spread evenly across palettes and patterns; changing it reshuffles every cover.
const SALT = 3183;
function mix(h) {
  let x = (h ^ SALT) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function pick(seed) {
  const h = mix(hashString(seed || 'claude'));
  const palette = PALETTE_ROTATION[h % PALETTE_ROTATION.length];
  const pattern = PATTERN_ROTATION[(h >>> 12) % PATTERN_ROTATION.length];
  return { h, palette, pattern };
}

/** What a poster needs to know about a cover: its paper, the ink for type on it, and which design it got. */
export function coverMeta(seed) {
  const { palette, pattern } = pick(seed);
  return { paper: PALETTES[palette].bg, ink: PALETTES[palette].ink, palette, pattern };
}

/** Returns an inline SVG (Raw) that fills its container (CSS sizes it). */
export function coverArt(seed) {
  const { h, palette, pattern } = pick(seed);
  const r = prng(h);
  const p = PALETTES[palette];
  const draw = PATTERNS[pattern];
  const body = draw(r, p);
  return raw(`<svg class="cover-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false"><rect width="${W}" height="${H}" fill="${p.bg}"/>${body}</svg>`);
}
