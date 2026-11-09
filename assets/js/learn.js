// Learn: workshops and official resources from /data/workshops.json.

import { html, icons, safeUrl, formatDate, sparkArt } from './ui.js';
import { coverArt } from './covers.js';
import { getJSON } from './config.js';

const grid = document.querySelector('[data-workshops]');
const links = document.querySelector('[data-resources]');

function workshopCard(w) {
  const buttons = [
    ['slidesUrl', 'Slides'],
    ['recordingUrl', 'Recording'],
    ['repoUrl', 'Code'],
  ].map(([key, label]) => (safeUrl(w[key]) ? html`<a class="btn btn-secondary btn-sm" href="${safeUrl(w[key])}" target="_blank" rel="noopener noreferrer">${label}</a>` : ''));
  return html`
    <article class="card workshop">
      <div class="cover">${coverArt(w.title, { label: w.title })}</div>
      <div class="card-body">
      <span class="when">${w.date ? formatDate(/^\d{4}-\d{2}-\d{2}$/.test(w.date) ? `${w.date}T12:00:00` : w.date, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Date TBA'}${w.level ? ` · ${w.level}` : ''}</span>
      <h3>${w.title}</h3>
      ${w.summary ? html`<p>${w.summary}</p>` : ''}
      ${(w.tags || []).length ? html`<div class="badge-row">${w.tags.map((t) => html`<span class="tag">${t}</span>`)}</div>` : ''}
      <div class="btn-row">${buttons}</div>
      </div>
    </article>`;
}

try {
  const data = await getJSON('/data/workshops.json');
  const workshops = [...(data.workshops || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  grid.innerHTML = String(workshops.length
    ? html`${workshops.map(workshopCard)}`
    : html`<div class="empty" style="grid-column:1/-1">
        ${sparkArt({ className: 'empty-mark', strokeWidth: 8 })}
        <h3>This year's workshops are on the way</h3>
        <p>Slides, recordings and starter code from each session will land here. Upcoming sessions are on the events calendar.</p>
        <div class="btn-row"><a class="btn btn-primary" href="/events">${icons.calendar} See events</a><a class="btn btn-secondary" href="/library">Browse the Library</a></div>
      </div>`);
  links.innerHTML = String(html`${(data.resources || []).filter((r) => safeUrl(r.url)).map((r) => html`
    <li><a class="card" href="${safeUrl(r.url)}" target="_blank" rel="noopener noreferrer"><span><b>${r.title}</b><span>${r.description || ''}</span></span>${icons.arrowUpRight}</a></li>`)}`);
} catch (err) {
  console.error(err);
  grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><p>Couldn\'t load workshops. Refresh to try again.</p></div>';
}
grid.setAttribute('aria-busy', 'false');
