// Home page: hero, live stats, featured builds, next events, join CTA.

import { html, icons, toMillis } from './ui.js';
import { getConfig, yearLabel } from './config.js';
import { fetchPublished } from './collection.js';
import { buildCard } from './builds.js';
import { lumaEmbed } from './events.js';

const config = await getConfig();

/* Hero badge + rotating verb */
const badge = document.querySelector('[data-hero-badge]');
if (badge) {
  badge.querySelector('[data-year]').textContent = yearLabel(config.academicYear);
  const extra = badge.querySelector('[data-badge-text]');
  if (config.heroBadge) extra.textContent = config.heroBadge; else extra.remove();
}

const verb = document.querySelector('[data-hero-verb]');
if (verb && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const words = ['building', 'learning', 'creating'];
  let i = 0;
  setInterval(() => {
    i = (i + 1) % words.length;
    verb.style.opacity = '0';
    setTimeout(() => { verb.textContent = words[i]; verb.style.opacity = '1'; }, 300);
  }, 2600);
}

/* Join CTA */
document.querySelectorAll('[data-join]').forEach((el) => {
  if (config.slackUrl) {
    el.href = config.slackUrl;
    el.target = '_blank';
    el.rel = 'noopener';
    el.innerHTML = String(html`${icons.slack} Join the Slack`);
  }
});
const joinNote = document.querySelector('[data-join-note]');
if (joinNote && !config.slackUrl) joinNote.hidden = false;
document.querySelectorAll('[data-join-slack]').forEach((el) => { el.hidden = !config.slackUrl; });

/* Next up (only when a Luma calendar is configured) */
const next = document.querySelector('[data-next-events]');
const embed = lumaEmbed(config, { height: 460 });
if (next && embed) {
  next.querySelector('[data-embed]').innerHTML = String(embed);
  next.hidden = false;
}

/* Stats + featured builds */
const featuredEl = document.querySelector('[data-featured]');
try {
  const [builds, resources] = await Promise.all([fetchPublished('builds'), fetchPublished('resources')]);
  const builders = new Set([...builds, ...resources].map((i) => i.ownerUid).filter(Boolean));
  const stats = document.querySelector('[data-stats]');
  stats.querySelector('[data-stat="builds"]').textContent = builds.length;
  stats.querySelector('[data-stat="resources"]').textContent = resources.length;
  stats.querySelector('[data-stat="builders"]').textContent = builders.size;
  stats.hidden = builds.length === 0;

  const hearts = (b) => (b.hearts || []).length;
  const featured = builds.filter((b) => b.featured).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  const rest = builds.filter((b) => !b.featured).sort((a, b) => hearts(b) - hearts(a) || toMillis(b.createdAt) - toMillis(a.createdAt));
  const picks = [...featured, ...rest].slice(0, 3);
  featuredEl.innerHTML = picks.length
    ? picks.map((b) => String(buildCard(b, {}, { teaser: true }))).join('')
    : String(html`<div class="empty" style="grid-column:1/-1"><h3>No builds yet</h3><p>Be the first to share what you've made.</p><div class="btn-row"><a class="btn btn-primary" href="/builds?submit=1">${icons.plus} Share your build</a></div></div>`);
} catch (err) {
  console.error(err);
  featuredEl.innerHTML = String(html`<div class="empty" style="grid-column:1/-1"><p>Builds couldn't load right now. <a href="/builds">Open the gallery</a></p></div>`);
}
featuredEl.setAttribute('aria-busy', 'false');
