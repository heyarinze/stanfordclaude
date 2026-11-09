// Home page: hero stats, build ticker, featured builds, next events, join CTA.

import { html, icons, toMillis } from './ui.js';
import { getConfig, yearLabel } from './config.js';
import { fetchPublished } from './collection.js';
import { featureCard } from './builds.js';
import { lumaEmbed } from './events.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const config = await getConfig();

/* ---------- Config-driven bits ---------- */

const chip = document.querySelector('[data-hero-badge]');
if (chip) {
  chip.querySelector('[data-year]').textContent = yearLabel(config.academicYear);
  if (config.heroBadge) chip.querySelector('[data-badge-text]').textContent = config.heroBadge;
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
  const duration = 1100 + Math.min(to, 60) * 12;
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
  document.querySelectorAll('[data-build-count]').forEach((el) => { el.textContent = String(builds.length); });

  const featured = builds.filter((b) => b.featured).sort(newest);
  const rest = builds.filter((b) => !b.featured).sort((a, b) => hearts(b) - hearts(a) || newest(a, b));
  const picks = [...featured, ...rest].slice(0, 3);

  if (marquee && builds.length) {
    const titles = [...builds].sort(newest).slice(0, 24);
    const list = (dup) => html`<ul ${dup ? html`aria-hidden="true"` : ''}>${titles.map((b) => html`<li><a href="/builds?b=${encodeURIComponent(b.id)}" ${dup ? html`tabindex="-1"` : ''}>${b.title}</a></li>`)}</ul>`;
    marquee.querySelector('.marquee-track').innerHTML = String(html`${list(false)}${list(true)}`);
    marquee.style.setProperty('--marquee-duration', `${Math.max(36, titles.length * 5)}s`);
    marquee.classList.add('is-ready');
  } else if (marquee) {
    marquee.hidden = true;
  }

  featuredEl.innerHTML = picks.length
    ? picks.map((b, i) => String(featureCard(b, { large: i === 0 }))).join('')
    : String(html`<div class="empty" style="grid-column:1/-1"><h3>No builds yet</h3><p>Be the first to share what you've made.</p><div class="btn-row"><a class="btn btn-primary" href="/builds?submit=1">${icons.plus} Share your build</a></div></div>`);
} catch (err) {
  console.error(err);
  if (marquee) marquee.hidden = true;
  featuredEl.innerHTML = String(html`<div class="empty" style="grid-column:1/-1"><h3>Builds couldn't load</h3><p><a href="/builds">Open the gallery</a> or refresh to try again.</p></div>`);
}
featuredEl.setAttribute('aria-busy', 'false');
