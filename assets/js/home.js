// Home page: recent builds, the next events from Luma, and the join links.

import { html, icons, toMillis } from './ui.js';
import { getConfig } from './config.js';
import { fetchPublished, peekPublished } from './collection.js';
import { buildCard } from './builds.js';
import { lumaEmbed } from './events.js';

const grid = document.querySelector('[data-featured]');
const allLink = document.querySelector('[data-all-builds]');
const newest = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);
let shown = '';

// Builds a lead has featured come first, then the newest.
function render(builds) {
  const picks = [...builds]
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || newest(a, b))
    .slice(0, 3);
  // Skip the repaint when fresh data matches what's already on screen.
  const signature = JSON.stringify([builds.length, picks.map((b) => [b.id, (b.hearts || []).length])]);
  if (signature === shown) return;
  shown = signature;

  if (allLink && builds.length > picks.length) allLink.textContent = `See all ${builds.length} builds`;
  grid.innerHTML = picks.length
    ? picks.map((b) => String(buildCard(b, {}, { teaser: true }))).join('')
    : String(html`<div class="empty" style="grid-column:1/-1"><h3>No builds yet</h3><div class="btn-row"><a class="btn btn-primary" href="/builds?submit=1">Share a build</a></div></div>`);
  grid.setAttribute('aria-busy', 'false');
}

// Paint from this tab's cache right away, then refresh.
const cached = peekPublished('builds');
if (cached) render(cached);

getConfig().then((config) => {
  if (config.slackUrl) {
    document.querySelectorAll('[data-join]').forEach((el) => {
      el.href = config.slackUrl;
      el.target = '_blank';
      el.rel = 'noopener';
      el.innerHTML = String(html`${icons.slack} Join the Slack`);
    });
  }
  document.querySelectorAll('[data-join-note]').forEach((el) => { el.hidden = Boolean(config.slackUrl); });

  const next = document.querySelector('[data-next-events]');
  const embed = lumaEmbed(config, { height: 460 });
  if (next && embed) {
    next.querySelector('[data-embed]').innerHTML = String(embed);
    next.hidden = false;
  }
});

try {
  render(await fetchPublished('builds'));
} catch (err) {
  console.error(err);
  if (!shown) {
    grid.innerHTML = String(html`<div class="empty" style="grid-column:1/-1"><p>Couldn't load builds. <a href="/builds">Open the gallery</a> or refresh the page.</p></div>`);
    grid.setAttribute('aria-busy', 'false');
  }
}
