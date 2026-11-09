// Events: embeds the club's Luma calendar when site.json has lumaEmbedUrl.
// Also used on the home page for the "Coming up" section.

import { html, icons, safeUrl } from './ui.js';
import { getConfig, yearLabel } from './config.js';

export function lumaEmbed(config, { height = 640 } = {}) {
  const src = safeUrl(config.lumaEmbedUrl);
  if (!src) return null;
  return html`<div class="embed-frame"><iframe src="${src}" title="Claude@Stanford events on Luma" height="${height}" loading="lazy" allowfullscreen aria-label="Events calendar"></iframe></div>`;
}

const target = document.querySelector('[data-events]');
if (target) {
  const config = await getConfig();
  const embed = lumaEmbed(config);
  const calendar = safeUrl(config.lumaCalendarUrl);
  const slack = safeUrl(config.slackUrl);
  const subscribe = document.querySelector('[data-luma-subscribe]');
  if (subscribe && calendar) { subscribe.href = calendar; subscribe.hidden = false; }
  target.innerHTML = String(embed || html`
    <div class="empty">
      <h3>No events posted yet</h3>
      <p>The ${yearLabel(config.academicYear)} calendar will show up here once the first events are scheduled.</p>
      ${slack ? html`<div class="btn-row"><a class="btn btn-primary" href="${slack}" target="_blank" rel="noopener">${icons.slack} Join the Slack</a></div>` : ''}
    </div>`);
}
