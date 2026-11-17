// Team: this year's roster from /data/team.json. Until it is filled in, last year's team stands in.

import { html, listSentence } from './ui.js';
import { getJSON, yearLabel } from './config.js';
import { personCard, personProfile } from './people.js';
import { latestArchive } from './hackathon.js';

const grid = document.querySelector('[data-team]');
const yearEl = document.querySelector('[data-team-year]');

try {
  const team = await getJSON('/data/team.json');
  if (yearEl) yearEl.textContent = yearLabel(team.year);
  const members = team.members || [];
  if (members.length) {
    // Once anyone has a bio, each person gets a full row with the bio beside them. Otherwise, compact cards.
    const profiles = members.some((m) => m.bio);
    grid.className = profiles ? 'profiles' : 'people';
    grid.innerHTML = String(html`${members.map((m) => (profiles ? personProfile(m) : personCard(m, { heading: 'h2' })))}`);
  } else {
    const last = await latestArchive().catch(() => null);
    const people = last?.team || [];
    grid.innerHTML = String(html`
      <div class="empty">
        <h2>This year’s team isn’t posted yet.</h2>
        ${people.length ? html`<p>${listSentence(people.map((p) => p.name))} ran the club in ${yearLabel(last.year)}.</p>` : ''}
      </div>
      ${people.length ? html`
        <section class="section-tight" aria-labelledby="last-team">
          <div class="section-head"><h2 id="last-team">${yearLabel(last.year)} team</h2><a class="text-link" href="/archive?year=${encodeURIComponent(last.year)}">More from ${yearLabel(last.year)}</a></div>
          <div class="people">${people.map((p) => personCard(p))}</div>
        </section>` : ''}`);
  }
} catch (err) {
  console.error(err);
  grid.innerHTML = '<div class="empty"><p>Couldn’t load the team. Refresh to try again.</p></div>';
}
grid.setAttribute('aria-busy', 'false');
