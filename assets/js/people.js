// A person on the Team page and in the Archive: square photo, name, role, text links.

import { html, initials, safeUrl } from './ui.js';

export function personCard(p) {
  const linkedin = safeUrl(p.linkedin);
  return html`
    <article class="person">
      <div class="person-photo">${p.photo ? html`<img src="${p.photo}" alt="" width="120" height="120" loading="lazy">` : initials(p.name)}</div>
      <div>
        <h3>${p.name}</h3>
        ${p.role ? html`<p class="role">${p.role}</p>` : ''}
        ${p.bio ? html`<p class="bio">${p.bio}</p>` : ''}
        ${linkedin || p.email ? html`
          <p class="person-links">
            ${linkedin ? html`<a href="${linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a>` : ''}
            ${p.email ? html`<a href="mailto:${p.email}">Email</a>` : ''}
          </p>` : ''}
      </div>
    </article>`;
}
