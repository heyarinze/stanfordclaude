// Home page: the wall of posters, last spring's hackathon, upcoming events and the join links.

import { html, icons, safeUrl, toMillis } from './ui.js';
import { getConfig, yearLabel } from './config.js';
import { fetchPublished, peekPublished } from './collection.js';
import { buildCard } from './builds.js';
import { coverMeta } from './covers.js';
import { lumaEmbed } from './events.js';
import { latestArchive, hackathonSummary, entryRows, numberWord } from './hackathon.js';

/* ---------- The wall ---------- */

const WALL = 8;
const wall = document.querySelector('[data-wall]');
const allLink = document.querySelector('[data-all-builds]');
const wallNote = document.querySelector('[data-wall-note]');
const hearts = (b) => (b.hearts || []).length;
const newest = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);
let shown = '';
let academicYear = '';
let lastBuilds = null;

/** Builds a lead has featured come first, then the most hearted, then the newest.
    Posts with next to no description stay off the home page (they are still in the gallery). */
function rank(builds) {
  return builds
    .filter((b) => b.featured || String(b.desc || '').trim().length >= 20)
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || hearts(b) - hearts(a) || newest(a, b));
}

/** Reorder the picks so that no poster sits beside one on the same paper (and, where the picks allow,
    not under one either, in the four-column layout). Earlier picks keep the earliest places they can. */
function arrange(picks, columns = 4) {
  const items = picks.map((b) => ({ b, paper: coverMeta(b.id).palette }));
  const search = (strict) => {
    const out = [];
    const used = new Array(items.length).fill(false);
    const place = () => {
      if (out.length === items.length) return true;
      const left = out.length % columns ? out[out.length - 1] : null;
      const above = out[out.length - columns] || null;
      for (let i = 0; i < items.length; i += 1) {
        const c = items[i];
        if (used[i] || (left && c.paper === left.paper) || (strict && above && c.paper === above.paper)) continue;
        used[i] = true; out.push(c);
        if (place()) return true;
        used[i] = false; out.pop();
      }
      return false;
    };
    return place() ? out : null;
  };
  return (search(true) || search(false) || items).map((c) => c.b);
}

function renderWall(builds) {
  lastBuilds = builds;
  const picks = arrange(rank(builds).slice(0, WALL));
  const thisYear = Boolean(academicYear) && builds.some((b) => b.year === academicYear);
  // Skip the repaint when fresh data matches what's already on screen.
  const signature = JSON.stringify([builds.length, picks.map((b) => b.id), academicYear, thisYear]);
  if (signature === shown) return;
  shown = signature;

  if (allLink && builds.length > picks.length) allLink.textContent = `All ${builds.length} builds`;
  if (wallNote && academicYear && builds.length) {
    wallNote.textContent = thisYear ? '' : `All from last year so far. Yours could be the first of ${yearLabel(academicYear)}.`;
    wallNote.hidden = thisYear;
  }
  wall.innerHTML = picks.length
    ? picks.map((b) => String(buildCard(b, {}, { teaser: true }))).join('')
    : String(html`<div class="empty"><h3>Nothing posted yet.</h3><div class="btn-row"><a class="btn btn-primary" href="/builds?submit=1">Add your build</a></div></div>`);
  wall.setAttribute('aria-busy', 'false');
}

// Paint from this tab's cache right away, then refresh.
const cached = peekPublished('builds');
if (cached) renderWall(cached);

/* ---------- Config-driven bits: the join path and the events calendar ---------- */

getConfig().then((config) => {
  academicYear = config.academicYear;
  if (lastBuilds) renderWall(lastBuilds);

  // With a Slack invite, joining is the main action. Until then the main button leads to the builds,
  // so nobody is sent to a dead end.
  const slack = safeUrl(config.slackUrl);
  if (slack) {
    const toSlack = (el) => { el.href = slack; el.target = '_blank'; el.rel = 'noopener'; el.innerHTML = String(html`${icons.slack} Join the Slack`); };
    document.querySelectorAll('[data-join]').forEach(toSlack);
    const primary = document.querySelector('[data-cta-primary]');
    const secondary = document.querySelector('[data-cta-secondary]');
    if (primary && secondary) {
      secondary.href = primary.getAttribute('href');
      secondary.textContent = primary.textContent;
      toSlack(primary);
    }
  }
  document.querySelectorAll('[data-join-note]').forEach((el) => { el.hidden = Boolean(slack); });

  const next = document.querySelector('[data-next-events]');
  const embed = lumaEmbed(config, { height: 460 });
  if (next && embed) {
    next.querySelector('[data-embed]').innerHTML = String(embed);
    next.hidden = false;
  }
});

/* ---------- Last spring's hackathon ---------- */

const hack = document.querySelector('[data-hackathon]');
if (hack) {
  latestArchive().then((year) => {
    const h = year?.hackathon;
    if (!h || !(h.winners || []).length) { hack.hidden = true; return; }
    const total = h.winners.length + (h.mentions || []).length;
    hack.querySelector('[data-hack-summary]').textContent = hackathonSummary(h);
    const all = hack.querySelector('[data-hack-all]');
    all.href = `/archive?year=${encodeURIComponent(year.year)}`;
    all.textContent = total > h.winners.length ? `See all ${numberWord(total)}` : 'See the archive';
    hack.querySelector('[data-hack-rows]').innerHTML = String(entryRows(h.winners, { clamp: true }));
  }).catch((err) => { console.error(err); hack.hidden = true; });
}

/* ---------- Fresh builds ---------- */

try {
  renderWall(await fetchPublished('builds'));
} catch (err) {
  console.error(err);
  if (!shown) {
    wall.innerHTML = String(html`<div class="empty"><h3>Couldn’t load builds.</h3><p><a href="/builds">Open the gallery</a>, or refresh the page.</p></div>`);
    wall.setAttribute('aria-busy', 'false');
  }
}
