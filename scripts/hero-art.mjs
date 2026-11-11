// Makes the home page drawing (assets/img/quad-night-*.webp) from the club's original logo art.
//
// The logo (docs/brand/logo.png) includes a small ink drawing of Hoover Tower and the Main Quad.
// This script lifts the drawing out, enlarges it, and re-inks it for the dark page as a two-colour
// "night print": bone linework, with the windows and arches lit in clay. Run it only if you want to
// change the artwork; the finished images are committed.
//
//   node scripts/hero-art.mjs
//
// Needs Google Chrome (set CHROME=/path/to/chrome if it is somewhere unusual) and cwebp
// (brew install webp). No npm packages.

import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WIDTHS = [1440, 800];            // large screens, and phones at 2x
const QUALITY = { 1440: ['52', '72'], 800: ['58', '78'] };   // cwebp -q and -alpha_q

/* ---------- A minimal headless-Chrome driver (DevTools protocol over a WebSocket) ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = mkdtempSync(join(tmpdir(), 'hero-art-'));
const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(work, 'profile')}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });

async function evaluateInPage(expression) {
  for (let i = 0; i < 80; i += 1) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch { /* Chrome is still starting */ }
    await sleep(150);
  }
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const reply = new Promise((resolve, reject) => {
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      if (message.error || message.result.exceptionDetails) reject(new Error(message.error?.message || message.result.exceptionDetails.exception?.description));
      else resolve(message.result.result.value);
    };
  });
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  return reply;
}

/* ---------- The image work, run inside the page so it can use <canvas> ---------- */

// Coordinates below are in the 500px logo (first block) or in the 4x enlargement (the rest).
const pageCode = `(async () => {
  const LOGO = ${JSON.stringify(`data:image/png;base64,${readFileSync(join(root, 'docs/brand/logo.png')).toString('base64')}`)};
    const CREAM = [241, 235, 226], CLAY = [217, 119, 87];   // --ink and --accent in tokens.css
    const img = new Image();
    img.src = LOGO;
    await img.decode();
    const S = 4, W = img.width, H = img.height, UW = W * S, UH = H * S;
    const src = document.createElement('canvas'); src.width = W; src.height = H;
    const sx = src.getContext('2d'); sx.drawImage(img, 0, 0);
    const sd = sx.getImageData(0, 0, W, H).data;

    // Ink map: dark, opaque, not the orange spark; the wordmark and script lettering are masked out.
    const roofY = (x) => (x >= 170 ? 213 + (500 - x) * 0.415 : 345);
    const g1 = document.createElement('canvas'); g1.width = W; g1.height = H;
    const gx = g1.getContext('2d'); const gd = gx.createImageData(W, H);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4;
      const r = sd[i], g = sd[i + 1], b = sd[i + 2], a = sd[i + 3] / 255;
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const orange = r > 150 && r - b > 60;
      const keep = (x < 112 && y >= 188) || (x >= 112 && y >= roofY(x) - 7);
      const v = keep && !orange ? Math.round((1 - lum) * a * 255) : 0;
      gd.data[i] = v; gd.data[i + 1] = v; gd.data[i + 2] = v; gd.data[i + 3] = 255;
    }
    gx.putImageData(gd, 0, 0);

    // Smooth upscale, then threshold: crisp, slightly rough edges like a lino print.
    const up = document.createElement('canvas'); up.width = UW; up.height = UH;
    const ux = up.getContext('2d'); ux.imageSmoothingEnabled = true; ux.imageSmoothingQuality = 'high';
    ux.drawImage(g1, 0, 0, UW, UH);
    const ud = ux.getImageData(0, 0, UW, UH);
    const smooth = (e0, e1, t) => { const k = Math.min(1, Math.max(0, (t - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
    const alpha = new Float32Array(UW * UH);
    for (let p = 0; p < UW * UH; p += 1) alpha[p] = smooth(0.38, 0.62, ud.data[p * 4] / 255);

    // "Lit" areas = thick masses (openings that were solid black in the drawing) inside the buildings.
    // Find them with an erosion (box minimum), then grow back and keep only where there is ink.
    const hard = new Uint8Array(UW * UH); for (let p = 0; p < UW * UH; p += 1) hard[p] = alpha[p] > 0.5 ? 1 : 0;
    const boxMin = (srcArr, r) => {  // separable erosion
      const tmp = new Uint8Array(UW * UH), out = new Uint8Array(UW * UH);
      for (let y = 0; y < UH; y += 1) for (let x = 0; x < UW; x += 1) { let m = 1; for (let d = -r; d <= r && m; d += 1) { const xx = x + d; if (xx < 0 || xx >= UW || !srcArr[y * UW + xx]) m = 0; } tmp[y * UW + x] = m; }
      for (let y = 0; y < UH; y += 1) for (let x = 0; x < UW; x += 1) { let m = 1; for (let d = -r; d <= r && m; d += 1) { const yy = y + d; if (yy < 0 || yy >= UH || !tmp[yy * UW + x]) m = 0; } out[y * UW + x] = m; }
      return out;
    };
    const boxMax = (srcArr, r) => {  // separable dilation
      const tmp = new Uint8Array(UW * UH), out = new Uint8Array(UW * UH);
      for (let y = 0; y < UH; y += 1) for (let x = 0; x < UW; x += 1) { let m = 0; for (let d = -r; d <= r && !m; d += 1) { const xx = x + d; if (xx >= 0 && xx < UW && srcArr[y * UW + xx]) m = 1; } tmp[y * UW + x] = m; }
      for (let y = 0; y < UH; y += 1) for (let x = 0; x < UW; x += 1) { let m = 0; for (let d = -r; d <= r && !m; d += 1) { const yy = y + d; if (yy >= 0 && yy < UH && tmp[yy * UW + x]) m = 1; } out[y * UW + x] = m; }
      return out;
    };
    const core = boxMin(hard, 5);
    // Label the thick masses and decide per mass (not per pixel) whether it is a lit opening.
    const TOP = 186 * S;
    const eaveY = (x) => TOP + 655 - (x - 690) * 0.271;
    const labels = new Int32Array(UW * UH);
    const litCore = new Uint8Array(UW * UH);
    const stack = new Int32Array(UW * UH);
    let next = 0, litMasses = 0;
    for (let start = 0; start < UW * UH; start += 1) {
      if (!core[start] || labels[start]) continue;
      next += 1;
      let sp = 0, n = 0, sxm = 0, sym = 0, minY = UH, maxY = 0, minX = UW, maxX = 0;
      const members = [];
      stack[sp++] = start; labels[start] = next;
      while (sp) {
        const p = stack[--sp]; const x = p % UW, y = (p - x) / UW;
        members.push(p); n += 1; sxm += x; sym += y;
        if (y < minY) minY = y; if (y > maxY) maxY = y; if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (x > 0 && core[p - 1] && !labels[p - 1]) { labels[p - 1] = next; stack[sp++] = p - 1; }
        if (x < UW - 1 && core[p + 1] && !labels[p + 1]) { labels[p + 1] = next; stack[sp++] = p + 1; }
        if (y > 0 && core[p - UW] && !labels[p - UW]) { labels[p - UW] = next; stack[sp++] = p - UW; }
        if (y < UH - 1 && core[p + UW] && !labels[p + UW]) { labels[p + UW] = next; stack[sp++] = p + UW; }
      }
      const cx = sxm / n, cy = sym / n, h = maxY - minY, w = maxX - minX;
      let lit = false;
      if (cx >= 745 && cy > eaveY(cx) + 34) lit = !(cy > TOP + 1150 && h < 90);          // main facade: windows and arches, not low shrubs
      else if (cx >= 425 && cx < 745 && cy > TOP + 905 && cy < TOP + 1015 && h < 100) lit = true;   // low wing windows
      else if (cx >= 200 && cx < 410 && cy > TOP + 255 && cy < TOP + 570 && w < 120) lit = true;   // tower belfry and slits
      // Long thin masses are cornices and pilasters, not openings.
      const fill = n / Math.max(1, (w + 1) * (h + 1));
      if (lit && ((fill < 0.34 && (w > 170 || h > 170)) || (h > 3.4 * (w + 1) && h > 140) || (w > 4 * (h + 1) && w > 140))) lit = false;
      if (lit) { litMasses += 1; for (const p of members) litCore[p] = 1; }
    }
    const grown = boxMax(litCore, 8);

    // The drawing is cropped on the left, through the trees. Instead of a hard straight edge, let the ink
    // break up into coarse specks over the last stretch, the way a print thins out at the edge of the block.
    const EDGE = 210, CELL = 7;
    const speck = (cx, cy) => { let h = (cx * 374761393 + cy * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    // Only the trees (the bottom band) fade; the tower above them stays whole.
    const keepAtEdge = (x, y) => x >= EDGE || y - TOP < 915 || speck(Math.floor(x / CELL), Math.floor(y / CELL)) < Math.pow(x / EDGE, 1.6);

    const out = document.createElement('canvas'); out.width = UW; out.height = UH - TOP;
    const ox = out.getContext('2d'); const od = ox.createImageData(UW, UH - TOP);
    for (let y = TOP; y < UH; y += 1) for (let x = 0; x < UW; x += 1) {
      const p = y * UW + x, a = alpha[p];
      if (a <= 0 || !keepAtEdge(x, y)) continue;
      const lit = grown[p] === 1;
      const c = lit ? CLAY : CREAM;
      const o = ((y - TOP) * UW + x) * 4;
      od.data[o] = c[0]; od.data[o + 1] = c[1]; od.data[o + 2] = c[2]; od.data[o + 3] = Math.round(a * 255);
    }
    ox.putImageData(od, 0, 0);
    const files = {};
    for (const w of ${JSON.stringify(WIDTHS)}) {
      const c = document.createElement('canvas'); c.width = w; c.height = Math.round(out.height * w / out.width);
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(out, 0, 0, c.width, c.height);
      files[w] = c.toDataURL('image/png');
    }
    return files;
})()`;

try {
  const files = await evaluateInPage(pageCode);
  for (const w of WIDTHS) {
    const png = join(work, `quad-night-${w}.png`);
    const webp = join(root, `assets/img/quad-night-${w}.webp`);
    writeFileSync(png, Buffer.from(files[w].split(',')[1], 'base64'));
    execFileSync('cwebp', ['-quiet', '-q', QUALITY[w][0], '-alpha_q', QUALITY[w][1], '-m', '6', png, '-o', webp]);
    console.log(`wrote assets/img/quad-night-${w}.webp (${Math.round(readFileSync(webp).length / 1024)} KB)`);
  }
} finally {
  chrome.kill();
  await new Promise((resolve) => { chrome.once('exit', resolve); setTimeout(resolve, 3000); });   // let Chrome let go of its profile
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
process.exit(0);
