// Archive: one tab per academic year, each backed by /data/archive/<year>.json.

import { html, icons, safeUrl } from './ui.js';
import { coverArt } from './covers.js';
import { getJSON, yearLabel } from './config.js';
import { personCard } from './people.js';

const tabs = document.querySelector('[data-archive-tabs]');
const panel = document.querySelector('[data-archive-panel]');
const PLACES = { 1: ['gold', 'First place'], 2: ['silver', 'Second place'], 3: ['bronze', 'Third place'] };

function winnerCard(w) {
  const [medal, label] = PLACES[w.place] || ['bronze', `Place ${w.place}`];
  const link = safeUrl(w.link);
  return html`
    <article class="card spotlight plaque plaque-${medal}">
      <div class="cover">${coverArt(w.title, { palette: medal, label: w.title })}</div>
      <div class="card-body">
        <span class="medal" aria-hidden="true">${w.place}</span>
        <span class="place">${label}</span>
        <h3>${w.title}</h3>
        ${w.track ? html`<div class="badge-row"><span class="tag tag-accent">${w.track}</span></div>` : ''}
        <p>${w.desc}</p>
        <div class="builders"><b>Built by</b>${(w.builders || []).join(' · ')}</div>
        ${link ? html`<a class="btn btn-secondary btn-sm" href="${link}" target="_blank" rel="noopener noreferrer" style="align-self:flex-start">View on Devpost ${icons.arrowUpRight}</a>` : ''}
      </div>
    </article>`;
}

function mentionCard(m) {
  const link = safeUrl(m.link);
  return html`
    <article class="card card-pad spotlight" style="display:grid; gap:var(--space-3); align-content:start; overflow:hidden">
      ${m.track ? html`<div class="badge-row"><span class="tag">${m.track}</span></div>` : ''}
      <h3>${m.title}</h3>
      <p class="muted small">${m.desc}</p>
      <p class="small"><span class="muted">Built by</span> ${(m.builders || []).join(' · ')}</p>
      ${link ? html`<a class="small" href="${link}" target="_blank" rel="noopener noreferrer">View project</a>` : ''}
    </article>`;
}

function renderYear(data) {
  const h = data.hackathon;
  panel.innerHTML = String(html`
    ${data.summary ? html`<p class="lede" style="margin-bottom:var(--space-6)">${data.summary}</p>` : ''}
    ${h ? html`
      <section class="section-tight" aria-labelledby="hack-${data.year}">
        <div class="section-head"><div><span class="eyebrow">${h.when || 'Hackathon'}</span><h2 id="hack-${data.year}">${h.name || 'Hackathon'}</h2></div></div>
        <div class="grid">${(h.winners || []).map(winnerCard)}</div>
        ${(h.mentions || []).length ? html`
          <h3 class="eyebrow" style="margin:var(--space-7) 0 var(--space-4)">Honorable mentions</h3>
          <div class="grid">${h.mentions.map(mentionCard)}</div>` : ''}
      </section>` : ''}
    ${(data.team || []).length ? html`
      <section class="section-tight" aria-labelledby="team-${data.year}">
        <div class="section-head"><div><span class="eyebrow">Leadership</span><h2 id="team-${data.year}">${yearLabel(data.year)} team</h2></div></div>
        <div class="grid grid-tight">${data.team.map(personCard)}</div>
      </section>` : ''}
    <section class="section-tight">
      <div class="btn-row">
        <a class="btn btn-secondary" href="/builds?year=${encodeURIComponent(data.year)}">Browse ${yearLabel(data.year)} builds</a>
        <a class="btn btn-ghost" href="/library?year=${encodeURIComponent(data.year)}">${yearLabel(data.year)} library</a>
      </div>
    </section>`);
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
    panel.innerHTML = '<div class="empty"><p>Couldn\'t load this year. Refresh to try again.</p></div>';
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
  panel.innerHTML = '<div class="empty"><p>Couldn\'t load the archive. Refresh to try again.</p></div>';
}
