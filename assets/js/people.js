// Person card shared by the Team page and the Archive.

import { html, icons, initials, safeUrl } from './ui.js';

export function personCard(p) {
  const photo = p.photo ? html`<img src="${p.photo}" alt="" width="96" height="96" loading="lazy">` : initials(p.name);
  const linkedin = safeUrl(p.linkedin);
  return html`
    <article class="card person">
      <span class="avatar avatar-lg">${photo}</span>
      <h3>${p.name}</h3>
      ${p.role ? html`<p class="role">${p.role}</p>` : ''}
      ${p.bio ? html`<p class="bio">${p.bio}</p>` : ''}
      ${linkedin || p.email ? html`
        <div class="btn-row">
          ${linkedin ? html`<a class="btn btn-secondary btn-sm" href="${linkedin}" target="_blank" rel="noopener noreferrer">${icons.linkedin} LinkedIn</a>` : ''}
          ${p.email ? html`<a class="btn btn-secondary btn-sm" href="mailto:${p.email}">${icons.mail} Email</a>` : ''}
        </div>` : ''}
    </article>`;
}
