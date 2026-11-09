// Events: embeds the club's Luma calendar when site.json has lumaEmbedUrl.
// Also used on the home page to show the "Next up" block.

import { html, icons, safeUrl } from './ui.js';
import { getConfig } from './config.js';

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
      <h3>The ${config.academicYear.replace('-', '–')} calendar is coming soon</h3>
      <p>Tablings, workshops, demo nights and buildathons will be posted here.${slack ? ' Join the Slack to hear first.' : ''}</p>
      <div class="btn-row">
        ${slack ? html`<a class="btn btn-primary" href="${slack}" target="_blank" rel="noopener">${icons.slack} Join the Slack</a>` : ''}
        <a class="btn btn-secondary" href="/archive">See past events</a>
      </div>
    </div>`);
}
