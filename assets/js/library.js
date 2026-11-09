// Library: articles, videos and guides members recommend for learning Claude.

import { html, icons, richText, safeUrl } from './ui.js';
import { CLAUDE_PRODUCTS, RESOURCE_CATEGORIES, LIMITS } from './taxonomy.js';
import { mountGallery, byNewest, shareButton, statusTags } from './collection.js';

const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

function resourceCard(item) {
  const url = safeUrl(item.url);
  return html`
    <article class="card item-card">
      <div class="card-top"><div class="badge-row">${statusTags(item)}${(item.categories || []).map((c) => html`<span class="tag">${c}</span>`)}</div></div>
      <h3><button type="button" data-action="open" data-id="${item.id}">${item.title}</button></h3>
      <p class="byline">Recommended by ${item.authorName || 'a member'}${url ? html` · ${host(url)}` : ''}</p>
      <p class="desc">${item.why}</p>
      ${(item.tools || []).length ? html`<div class="badge-row">${item.tools.map((t) => html`<span class="tag tag-accent">${t}</span>`)}</div>` : ''}
      <div class="card-foot">
        ${url ? html`<a class="btn btn-secondary btn-sm" href="${url}" target="_blank" rel="noopener noreferrer">Open ${icons.external}</a>` : html`<span></span>`}
        ${shareButton(item, 'resource')}
      </div>
    </article>`;
}

function resourceDetail(item) {
  const url = safeUrl(item.url);
  return html`
    <div class="detail-meta">
      <div class="badge-row">${statusTags(item)}${(item.categories || []).map((c) => html`<span class="tag">${c}</span>`)}</div>
      <p class="muted">Recommended by <strong>${item.authorName || 'a member'}</strong>${url ? html` · ${host(url)}` : ''}</p>
      <div class="btn-row">
        ${url ? html`<a class="btn btn-primary" href="${url}" target="_blank" rel="noopener noreferrer">Open resource ${icons.external}</a>` : ''}
        ${shareButton(item, 'resource')}
      </div>
    </div>
    <div class="detail-section"><h3>Why it's worth your time</h3><div class="rich">${richText(item.why)}</div></div>
    ${(item.tools || []).length ? html`<div class="detail-section"><h3>Covers</h3><div class="badge-row">${item.tools.map((t) => html`<span class="tag tag-accent">${t}</span>`)}</div></div>` : ''}`;
}

export const libraryConfig = {
  collection: 'resources',
  param: 'r',
  noun: 'resource',
  nounPlural: 'resources',
  path: '/library',
  products: CLAUDE_PRODUCTS,
  categories: RESOURCE_CATEGORIES,
  defaultSort: 'newest',
  sorts: {
    newest: { label: 'Newest', fn: byNewest },
    title: { label: 'A–Z', fn: (a, b) => String(a.title).localeCompare(String(b.title)) },
  },
  searchText: (i) => [i.title, i.why, i.authorName, i.url, ...(i.tools || []), ...(i.categories || [])].join(' '),
  card: resourceCard,
  detail: resourceDetail,
  titleNew: 'Add to the Library',
  titleEdit: 'Edit resource',
  submitLabel: 'Add resource',
  createExtras: () => ({}),
  prefill: (user) => ({ authorName: user.displayName || '' }),
  schema: [
    { name: 'title', label: 'Title', kind: 'text', required: true, max: LIMITS.title, placeholder: 'e.g. Getting started with Claude Code' },
    { name: 'url', label: 'Link', kind: 'url', required: true, max: LIMITS.url, placeholder: 'https://…' },
    { name: 'why', label: 'Why is it worth reading or watching?', kind: 'textarea', required: true, max: LIMITS.why, rows: 4, placeholder: 'Who is it for, and what will they get out of it?' },
    { name: 'tools', label: 'Claude products it covers', kind: 'checks', options: CLAUDE_PRODUCTS, maxItems: LIMITS.tools },
    { name: 'categories', label: 'Type', kind: 'checks', options: RESOURCE_CATEGORIES, maxItems: LIMITS.categories },
    { name: 'authorName', label: 'Your name', kind: 'text', required: true, max: LIMITS.name },
  ],
};

if (document.querySelector('[data-gallery="library"]')) mountGallery(libraryConfig);
