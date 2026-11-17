// People on the Team page and in the Archive.
// personCard: the compact card (square photo or initials, name, role, text links).
// personProfile: the same, with the person's bio beside it. The Team page uses it once anyone has a bio.

import { html, initials, raw, richText, safeUrl } from './ui.js';

/** Photo (or initials), name, role and links. `tag` is the heading tag for the name. */
function identity(p, tag) {
  const linkedin = safeUrl(p.linkedin);
  return html`
    <div class="person-photo">${p.photo ? html`<img src="${p.photo}" alt="" width="120" height="120" loading="lazy">` : (p.initials || initials(p.name))}</div>
    <div>
      ${raw(`<${tag}>`)}${p.name}${raw(`</${tag}>`)}
      ${p.role ? html`<p class="role">${p.role}</p>` : ''}
      ${linkedin || p.email ? html`
        <p class="person-links">
          ${linkedin ? html`<a href="${linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a>` : ''}
          ${p.email ? html`<a href="mailto:${p.email}">Email</a>` : ''}
        </p>` : ''}
    </div>`;
}

/** The compact card. Pass heading: 'h2' where no section heading comes before the cards. */
export function personCard(p, { heading = 'h3' } = {}) {
  return html`<article class="person">${identity(p, heading === 'h2' ? 'h2' : 'h3')}</article>`;
}

/** A person with their bio: who they are on the left, the bio on the right. Blank lines in the bio start new paragraphs. */
export function personProfile(p) {
  return html`
    <article class="profile">
      <div class="person">${identity(p, 'h2')}</div>
      ${p.bio ? html`<div class="profile-bio">${richText(p.bio, { smartQuotes: true })}</div>` : ''}
    </article>`;
}
