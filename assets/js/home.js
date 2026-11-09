// Home page: hero (rotating verb, live stats, floating build chips), build ticker,
// featured bento, next events, join CTA.

import { html, icons, toMillis } from './ui.js';
import { getConfig, yearLabel } from './config.js';
import { fetchPublished } from './collection.js';
import { buildCard, buildCover } from './builds.js';
import { lumaEmbed } from './events.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Rotating verb (all words share one grid cell, so the line never reflows) ---------- */

const slot = document.querySelector('[data-hero-verb]');
if (slot && !reduceMotion) {
  const words = [...slot.children];
  let i = 0;
  setInterval(() => {
    const current = words[i];
    i = (i + 1) % words.length;
    current.classList.remove('is-active');
    current.classList.add('is-leaving');
    words[i].classList.remove('is-leaving');
    words[i].classList.add('is-active');
    setTimeout(() => current.classList.remove('is-leaving'), 600);
  }, 2800);
}

/* ---------- Config-driven bits ---------- */

const config = await getConfig();

const badge = document.querySelector('[data-hero-badge]');
if (badge) {
  badge.querySelector('[data-year]').textContent = yearLabel(config.academicYear);
  const text = badge.querySelector('[data-badge-text]');
  if (config.heroBadge) text.textContent = config.heroBadge;
}

document.querySelectorAll('[data-join]').forEach((el) => {
  if (!config.slackUrl) return;
  el.href = config.slackUrl;
  el.target = '_blank';
  el.rel = 'noopener';
  el.innerHTML = String(html`${icons.slack} Join the Slack`);
});
document.querySelectorAll('[data-join-note]').forEach((el) => { el.hidden = Boolean(config.slackUrl); });

const next = document.querySelector('[data-next-events]');
const embed = lumaEmbed(config, { height: 460 });
if (next && embed) {
  next.querySelector('[data-embed]').innerHTML = String(embed);
  next.hidden = false;
}

/* ---------- Live data ---------- */

function countUp(el, to) {
  if (reduceMotion || to === 0) { el.textContent = String(to); return; }
  const start = performance.now();
  const duration = 900 + Math.min(to, 60) * 12;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = String(Math.round(to * (1 - (1 - t) ** 3)));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const hearts = (b) => (b.hearts || []).length;
const newest = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);
const featuredEl = document.querySelector('[data-featured]');
const marquee = document.querySelector('[data-marquee]');

try {
  const [builds, resources] = await Promise.all([fetchPublished('builds'), fetchPublished('resources')]);

  // People who've shared something (migrated posts may not have an owner yet, so fall back to the name).
  const people = new Set([...builds, ...resources].map((i) => i.ownerUid || (i.authorName || '').trim().toLowerCase()).filter(Boolean));
  const stats = document.querySelector('[data-stats]');
  countUp(stats.querySelector('[data-stat="builds"]'), builds.length);
  countUp(stats.querySelector('[data-stat="resources"]'), resources.length);
  countUp(stats.querySelector('[data-stat="builders"]'), people.size);

  const featured = builds.filter((b) => b.featured).sort(newest);
  const rest = builds.filter((b) => !b.featured).sort((a, b) => hearts(b) - hearts(a) || newest(a, b));
  const picks = [...featured, ...rest].slice(0, 3);

  // Floating chips around the hero spark.
  picks.forEach((b, i) => {
    const chip = document.querySelector(`[data-chip="${i}"]`);
    if (!chip) return;
    chip.href = `/builds?b=${encodeURIComponent(b.id)}`;
    chip.innerHTML = String(html`<span class="thumb">${buildCover(b)}</span><span style="min-width:0"><b>${b.title}</b><span>♥ ${hearts(b)} · ${b.authorName || 'Stanford builder'}</span></span>`);
    chip.setAttribute('aria-label', `${b.title} by ${b.authorName || 'a Stanford builder'}`);
    chip.hidden = false;
  });

  // Ticker of every build title.
  if (marquee && builds.length) {
    const titles = [...builds].sort(newest).slice(0, 24);
    const list = (hidden) => html`<ul ${hidden ? html`aria-hidden="true"` : ''}>${titles.map((b) => html`<li><a href="/builds?b=${encodeURIComponent(b.id)}" ${hidden ? html`tabindex="-1"` : ''}>${b.title}</a></li>`)}</ul>`;
    marquee.querySelector('.marquee-track').innerHTML = String(html`${list(false)}${list(true)}`);
    marquee.style.setProperty('--marquee-duration', `${Math.max(30, titles.length * 4.5)}s`);
    marquee.classList.add('is-ready');
  } else if (marquee) {
    marquee.hidden = true;
  }

  featuredEl.innerHTML = picks.length
    ? picks.map((b, i) => String(buildCard(b, {}, { teaser: true, large: i === 0 }))).join('')
    : String(html`<div class="empty" style="grid-column:1/-1"><h3>No builds yet</h3><p>Be the first to share what you've made.</p><div class="btn-row"><a class="btn btn-primary" href="/builds?submit=1">${icons.plus} Share your build</a></div></div>`);
} catch (err) {
  console.error(err);
  if (marquee) marquee.hidden = true;
  featuredEl.innerHTML = String(html`<div class="empty" style="grid-column:1/-1"><h3>Builds couldn't load</h3><p><a href="/builds">Open the gallery</a> or refresh to try again.</p></div>`);
}
featuredEl.setAttribute('aria-busy', 'false');
