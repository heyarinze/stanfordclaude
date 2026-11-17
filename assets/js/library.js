// Library: articles, videos and guides members recommend for learning Claude, set as a reading list.

import { html, icons, listSentence, richText, safeUrl, smart } from './ui.js';
import { CLAUDE_PRODUCTS, RESOURCE_CATEGORIES, LIMITS } from './taxonomy.js';
import { mountGallery, byNewest, shareButton, statusTags } from './collection.js';

const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const recommender = (item) => item.authorName || 'a member';

function resourceRow(item) {
  const url = safeUrl(item.url);
  const type = (item.categories || [])[0];
  const facts = [host(url), type, `Recommended by ${recommender(item)}`].filter(Boolean);
  return html`
    <article class="row">
      <div>
        <h3><button type="button" data-action="open" data-id="${item.id}">${smart(item.title)}</button></h3>
        <p class="row-desc row-clamp">${smart(item.why)}</p>
        <p class="row-meta">${facts.join(' · ')}</p>
        ${item.featured || item.status === 'hidden' ? html`<div class="badge-row" style="margin-top:0.5rem">${statusTags(item, { year: false })}</div>` : ''}
      </div>
      <div class="row-actions">
        ${url ? html`<a class="text-link" href="${url}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}
      </div>
    </article>`;
}

function resourceDetail(item) {
  const url = safeUrl(item.url);
  const tools = item.tools || [];
  const cats = item.categories || [];
  return html`
    <div class="detail-actions">
      ${url ? html`<a class="btn btn-primary" href="${url}" target="_blank" rel="noopener noreferrer">Open ${host(url) || 'link'} ${icons.external}</a>` : ''}
      ${shareButton(item, 'link')}
      ${statusTags(item, { year: false })}
    </div>
    <div class="detail-section" style="margin-top:0;padding-top:0;border-top:0"><h3>Why ${recommender(item)} recommends it</h3><div class="rich">${richText(item.why, { smartQuotes: true })}</div></div>
    ${tools.length || cats.length ? html`<p class="detail-foot-note">${cats.length ? `${listSentence(cats)}. ` : ''}${tools.length ? `Covers ${listSentence(tools)}.` : ''}</p>` : ''}`;
}

export const libraryConfig = {
  collection: 'resources',
  param: 'r',
  noun: 'link',
  nounPlural: 'links',
  path: '/library',
  products: CLAUDE_PRODUCTS,
  categories: RESOURCE_CATEGORIES,
  defaultSort: 'newest',
  sorts: {
    newest: { label: 'Newest', fn: byNewest },
    title: { label: 'A–Z', fn: (a, b) => String(a.title).localeCompare(String(b.title)) },
  },
  searchText: (i) => [i.title, i.why, i.authorName, i.url, ...(i.tools || []), ...(i.categories || [])].join(' '),
  card: resourceRow,
  detail: resourceDetail,
  listClass: 'rows',
  skeletons: 4,
  titleNew: 'Add a link',
  titleEdit: 'Edit link',
  submitLabel: 'Add link',
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
