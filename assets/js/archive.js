// Archive: one tab per academic year, each backed by /data/archive/<year>.json.

import { html } from './ui.js';
import { getJSON, yearLabel } from './config.js';
import { personCard } from './people.js';
import { entryRows } from './hackathon.js';

const tabs = document.querySelector('[data-archive-tabs]');
const panel = document.querySelector('[data-archive-panel]');

function renderYear(data) {
  const h = data.hackathon;
  const year = yearLabel(data.year);
  panel.innerHTML = String(html`
    ${data.summary ? html`<p class="lede">${data.summary}</p>` : ''}
    ${h ? html`
      <section class="section-tight" aria-labelledby="hack-${data.year}">
        <div class="section-head"><h2 id="hack-${data.year}">${h.name || 'Hackathon'}</h2>${h.when ? html`<p>${h.when}</p>` : ''}</div>
        ${entryRows(h.winners)}
        ${(h.mentions || []).length ? html`
          <h3 class="subhead">Honorable mentions</h3>
          ${entryRows(h.mentions, { ranked: false })}` : ''}
      </section>` : ''}
    ${(data.team || []).length ? html`
      <section class="section-tight" aria-labelledby="team-${data.year}">
        <div class="section-head"><h2 id="team-${data.year}">${year} team</h2></div>
        <div class="people">${data.team.map(personCard)}</div>
      </section>` : ''}
    <div class="section-tight section-links">
      <a class="text-link" href="/builds?year=${encodeURIComponent(data.year)}">${year} builds</a>
      <a class="text-link" href="/library?year=${encodeURIComponent(data.year)}">${year} library</a>
    </div>`);
}

async function show(year, { push = true } = {}) {
  tabs.querySelectorAll('[role="tab"]').forEach((t) => {
    const selected = t.dataset.year === year;
    t.setAttribute('aria-selected', String(selected));
    t.tabIndex = selected ? 0 : -1;
  });
  panel.setAttribute('aria-labelledby', `tab-${year}`);
  panel.setAttribute('aria-busy', 'true');
  try {
    renderYear(await getJSON(`/data/archive/${year}.json`));
  } catch (err) {
    console.error(err);
    panel.innerHTML = '<div class="empty"><p>Couldn’t load this year. Refresh to try again.</p></div>';
  }
  panel.setAttribute('aria-busy', 'false');
  if (push) history.replaceState(null, '', `/archive?year=${encodeURIComponent(year)}`);
}

try {
  const { years = [] } = await getJSON('/data/archive/index.json');
  const sorted = [...years].sort().reverse();
  tabs.innerHTML = String(html`${sorted.map((y) => html`<button type="button" role="tab" id="tab-${y}" data-year="${y}" aria-controls="archive-panel">${yearLabel(y)}</button>`)}`);
  tabs.addEventListener('click', (e) => { const t = e.target.closest('[role="tab"]'); if (t) show(t.dataset.year); });
  tabs.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const list = [...tabs.querySelectorAll('[role="tab"]')];
    const i = list.indexOf(document.activeElement);
    const next = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
    next.focus();
    show(next.dataset.year);
  });
  const requested = new URLSearchParams(location.search).get('year');
  if (sorted.length) show(sorted.includes(requested) ? requested : sorted[0], { push: false });
  else panel.innerHTML = '<div class="empty"><p>Nothing archived yet.</p></div>';
} catch (err) {
  console.error(err);
  panel.innerHTML = '<div class="empty"><p>Couldn’t load the archive. Refresh to try again.</p></div>';
}
