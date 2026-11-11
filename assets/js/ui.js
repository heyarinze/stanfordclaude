// Small UI toolkit: safe HTML templating, icons, toasts, confirm dialogs.

/* ---------- Safe templating ----------
   html`...` escapes every interpolated value unless it is itself the result of
   html`` or raw(). Use it for all markup built from user-submitted data. */

export class Raw {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

export const raw = (value) => new Raw(String(value));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

function renderValue(value) {
  if (value == null || value === false) return '';
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  return esc(value);
}

export function html(strings, ...values) {
  let out = '';
  strings.forEach((str, i) => {
    out += str;
    if (i < values.length) out += renderValue(values[i]);
  });
  return new Raw(out);
}

/** Returns the URL if it is http(s), otherwise null. Blocks javascript: and data: links. */
export function safeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Member-written text -> paragraphs, bullet and numbered lists, and auto-linked URLs, plus the few bits
    of Markdown people type out of habit: **bold**, `code`, "# heading" lines and "---" rules.
    Everything is escaped first; only these fixed tags are ever added around it.
    smartQuotes sets typographer's quotes (never inside links); leave it off for text that may hold code. */
export function richText(text, { smartQuotes = false } = {}) {
  const blocks = String(text || '').replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  const marks = (escaped) => escaped
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*(\S(?:[^*\n]*?\S)?)\*\*/g, '<strong>$1</strong>');   // "**bold**", but not "2 ** 3 ** 4"
  const words = (part) => marks(esc(smartQuotes ? smart(part) : part));
  const linkify = (line) => {
    let out = '';
    let last = 0;
    for (const m of line.matchAll(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g)) {
      const url = esc(m[0]);
      out += `${words(line.slice(last, m.index))}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      last = m.index + m[0].length;
    }
    return out + words(line.slice(last));
  };
  const out = [];
  for (const block of blocks) {
    let para = [];
    let list = null;   // { tag, start, items } while consecutive list lines are being collected
    const flushPara = () => { if (para.length) out.push(`<p>${para.map(linkify).join('<br>')}</p>`); para = []; };
    const flushList = () => {
      if (list) out.push(`<${list.tag}${list.start > 1 ? ` start="${list.start}"` : ''}>${list.items.map((item) => `<li>${linkify(item)}</li>`).join('')}</${list.tag}>`);
      list = null;
    };
    for (const line of block.split('\n')) {
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
      const heading = line.match(/^\s*#{1,6}\s+(.*?)\s*#*\s*$/);
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushPara(); flushList(); out.push('<hr>'); }
      else if (heading && heading[1]) { flushPara(); flushList(); out.push(`<h4>${linkify(heading[1])}</h4>`); }
      else if (bullet || numbered) {
        flushPara();
        const tag = bullet ? 'ul' : 'ol';
        if (list && list.tag !== tag) flushList();
        if (!list) list = { tag, start: numbered ? Number(numbered[1]) : 1, items: [] };
        list.items.push(bullet ? bullet[1] : numbered[2]);
      } else { flushList(); para.push(line); }
    }
    flushPara();
    flushList();
  }
  return raw(out.join(''));
}

/** Typographer's quotes for member-written text: "like this" becomes “like this”, it's becomes it’s. */
export function smart(text) {
  return String(text ?? '')
    .replace(/(^|[\s(\[{—–-])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s(\[{“—–-])'/g, '$1‘')
    .replace(/'/g, '’');
}

/** "A, B (x, y); C" -> ["A", "B (x, y)", "C"]: split at commas and semicolons, but never inside brackets. */
export const splitList = (text) => String(text ?? '').split(/[,;](?![^()]*\))/).map((s) => s.trim()).filter(Boolean);

/** ["A", "B", "C"] -> "A, B and C" */
export const listSentence = (list = []) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list.join(''));

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const n = new Date(ts).getTime();
  return Number.isNaN(n) ? 0 : n;
}

export function formatDate(ts, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const ms = toMillis(ts);
  return ms ? new Date(ms).toLocaleDateString('en-US', opts) : '';
}

export function debounce(fn, wait = 150) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

/* ---------- Icons (Lucide-style strokes, inline so they inherit color) ---------- */

const svg = (body, extra = '') => raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`);

export const icons = {
  heart: svg('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'),
  share: svg('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  arrowUpRight: raw('<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  external: svg('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
  search: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  linkedin: raw('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/></svg>'),
  mail: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/>'),
  slack: raw('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5.04 15.17a2.53 2.53 0 0 1-2.52 2.52A2.53 2.53 0 0 1 0 15.17a2.53 2.53 0 0 1 2.52-2.52h2.52v2.52Zm1.27 0a2.53 2.53 0 0 1 2.52-2.52 2.53 2.53 0 0 1 2.52 2.52v6.31A2.53 2.53 0 0 1 8.83 24a2.53 2.53 0 0 1-2.52-2.52v-6.31ZM8.83 5.04a2.53 2.53 0 0 1-2.52-2.52A2.53 2.53 0 0 1 8.83 0a2.53 2.53 0 0 1 2.52 2.52v2.52H8.83Zm0 1.27a2.53 2.53 0 0 1 2.52 2.52 2.53 2.53 0 0 1-2.52 2.52H2.52A2.53 2.53 0 0 1 0 8.83a2.53 2.53 0 0 1 2.52-2.52h6.31Zm10.13 2.52a2.53 2.53 0 0 1 2.52-2.52A2.53 2.53 0 0 1 24 8.83a2.53 2.53 0 0 1-2.52 2.52h-2.52V8.83Zm-1.27 0a2.53 2.53 0 0 1-2.52 2.52 2.53 2.53 0 0 1-2.52-2.52V2.52A2.53 2.53 0 0 1 15.17 0a2.53 2.53 0 0 1 2.52 2.52v6.31Zm-2.52 10.13a2.53 2.53 0 0 1 2.52 2.52A2.53 2.53 0 0 1 15.17 24a2.53 2.53 0 0 1-2.52-2.52v-2.52h2.52Zm0-1.27a2.53 2.53 0 0 1-2.52-2.52 2.53 2.53 0 0 1 2.52-2.52h6.31A2.53 2.53 0 0 1 24 15.17a2.53 2.53 0 0 1-2.52 2.52h-6.31Z"/></svg>'),
};

/** The Claude-style spark used as the brand mark. */
export function brandMark(cls = 'brand-mark') {
  let d = '';
  for (let i = 0; i < 12; i += 1) {
    const a = (i * Math.PI) / 6 + (i % 2 ? 0.12 : 0);
    const r1 = 2.6;
    const r2 = i % 2 ? 9.2 : 11;
    const f = (n) => n.toFixed(2);
    d += `M${f(12 + r1 * Math.cos(a))} ${f(12 + r1 * Math.sin(a))}L${f(12 + r2 * Math.cos(a))} ${f(12 + r2 * Math.sin(a))}`;
  }
  return raw(`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="${d}"/></svg>`);
}

/* ---------- Toasts ----------
   Short messages at the bottom of the screen. An open pop-up (a modal <dialog>) covers the page and
   switches the rest of it off, so a message left in the page would be dimmed, hidden behind the pop-up
   and never read out. So the one region that holds messages
   - sits inside whichever pop-up is on top, or in the page when none is open, and moves as pop-ups
     open and close (a message has to outlive the pop-up it appeared in: "Posted" arrives as the form
     closes, and a sign-in error arrives as the sign-in prompt closes);
   - is a popover, which draws it above the pop-up, at the bottom of the screen, wherever it sits. */

let region = null;
const openDialogs = [];   // in the order they opened: the last one is on top

function placeRegion() {
  if (!region) return;
  const host = openDialogs.filter((d) => d.isConnected && d.open).pop() || document.body;
  if (region.parentElement !== host) host.append(region);   // moving a popover closes it
  try { if (!region.matches(':popover-open')) region.showPopover(); } catch { /* no popover support: it is still position: fixed */ }
}

if (typeof MutationObserver === 'function') new MutationObserver((records) => {
  for (const { target } of records) {
    if (target.nodeName !== 'DIALOG') continue;
    const at = openDialogs.indexOf(target);
    if (target.open && at < 0) openDialogs.push(target);
    else if (!target.open && at >= 0) openDialogs.splice(at, 1);
  }
  placeRegion();
}).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['open'] });

export function toast(message, { error = false, duration = 3800 } = {}) {
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('popover', 'manual');
  }
  placeRegion();
  const el = document.createElement('div');
  el.className = `toast${error ? ' error' : ''}`;
  el.textContent = message;
  // Added on the next frame. The region has to be on the page first for a screen reader to read the
  // message out, and frames only come while the page is visible, so the message's time starts then.
  requestAnimationFrame(() => {
    region.append(el);
    setTimeout(() => el.classList.add('settled'), 250);   // once it has arrived, moving it doesn't replay the entrance
    setTimeout(() => el.remove(), duration);
  });
}

/* ---------- Dialog helpers ---------- */

/** Wire close buttons and backdrop clicks for a <dialog>. */
export function wireDialog(dialog, { onClose } = {}) {
  // A click on the backdrop closes the dialog, but only if the press also started there. Otherwise
  // selecting text in a form and letting go outside it would throw the form away.
  let pressedBackdrop = false;
  dialog.addEventListener('pointerdown', (event) => { pressedBackdrop = event.target === dialog; });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && pressedBackdrop) dialog.close();
    if (event.target.closest('[data-close]')) dialog.close();
  });
  if (onClose) dialog.addEventListener('close', onClose);
  return dialog;
}

export function confirmDialog(message, { title = 'Are you sure?', confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog-sm';
    dialog.innerHTML = String(html`
      <div class="dialog-head"><h2>${title}</h2></div>
      <div class="dialog-body"><p class="muted">${message}</p></div>
      <div class="dialog-foot">
        <button type="button" class="btn btn-secondary" value="cancel">Cancel</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" value="ok">${confirmLabel}</button>
      </div>`);
    let result = false;
    let pressedBackdrop = false;
    dialog.addEventListener('pointerdown', (event) => { pressedBackdrop = event.target === dialog; });
    dialog.addEventListener('click', (event) => {
      const button = event.target.closest('button[value]');
      if (button) { result = button.value === 'ok'; dialog.close(); }
      else if (event.target === dialog && pressedBackdrop) dialog.close();
    });
    dialog.addEventListener('close', () => { dialog.remove(); resolve(result); });
    document.body.append(dialog);
    dialog.showModal();
  });
}

/** Share via the native sheet on mobile, otherwise copy to the clipboard. */
export async function shareLink(url, title) {
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title, url }); return; } catch (err) { if (err.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    window.prompt('Copy this link:', url);
  }
}
