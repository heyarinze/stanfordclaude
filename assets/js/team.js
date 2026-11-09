import { html } from './ui.js';
import { getJSON, yearLabel } from './config.js';
import { personCard } from './people.js';

const grid = document.querySelector('[data-team]');
const yearEl = document.querySelector('[data-team-year]');

try {
  const team = await getJSON('/data/team.json');
  if (yearEl) yearEl.textContent = yearLabel(team.year);
  const members = team.members || [];
  grid.innerHTML = String(members.length
    ? html`${members.map(personCard)}`
    : html`<div class="empty" style="grid-column:1/-1"><p>We haven't posted the ${yearLabel(team.year)} team yet.</p></div>`);
} catch (err) {
  console.error(err);
  grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><p>Couldn\'t load the team. Refresh to try again.</p></div>';
}
grid.setAttribute('aria-busy', 'false');
