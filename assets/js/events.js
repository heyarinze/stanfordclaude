// Events: embeds the club's Luma calendar when site.json has lumaEmbedUrl.
// Also used on the home page for the "Coming up" section.

import { html, icons, safeUrl } from './ui.js';
import { getConfig } from './config.js';
import { latestArchive, hackathonSummary, entryRows, numberWord } from './hackathon.js';

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
  if (embed) {
    target.innerHTML = String(embed);
  } else {
    // No calendar yet: say so plainly, then show what last year looked like.
    target.innerHTML = String(html`
      <div class="empty">
        <h3>Nothing on the calendar yet.</h3>
        <p>This year’s first events haven’t been scheduled. When they are, they’ll show up here and you’ll RSVP on Luma.</p>
        ${slack ? html`<div class="btn-row"><a class="btn btn-primary" href="${slack}" target="_blank" rel="noopener">${icons.slack} Join the Slack to hear first</a></div>` : ''}
      </div>
      <div data-last-year></div>`);
    latestArchive().then((year) => {
      const h = year?.hackathon;
      if (!h || !(h.winners || []).length) return;
      const total = h.winners.length + (h.mentions || []).length;
      target.querySelector('[data-last-year]').innerHTML = String(html`
        <section class="section split" aria-labelledby="last-hack">
          <div>
            <h2 id="last-hack">Last year ended with a hackathon</h2>
            <p>${hackathonSummary(h)}</p>
            <a class="text-link" href="/archive?year=${encodeURIComponent(year.year)}">${total > h.winners.length ? `See all ${numberWord(total)}` : 'See the archive'}</a>
          </div>
          ${entryRows(h.winners, { clamp: true })}
        </section>`);
    }).catch((err) => console.error(err));
  }
}
