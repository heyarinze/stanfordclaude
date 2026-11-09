// Builds gallery: projects members made with Claude.

import { html, icons, richText, safeUrl, toMillis } from './ui.js';
import { coverArt } from './covers.js';
import { yearLabel } from './config.js';
import { CLAUDE_PRODUCTS, BUILD_CATEGORIES, LIMITS } from './taxonomy.js';
import { mountGallery, byNewest, heartButton, shareButton, statusTags } from './collection.js';

const hearts = (item) => (item.hearts || []).length;

export const buildCover = (item) => coverArt(item.id, { label: item.title });

/** Card used on /builds and, with teaser: true, on the home page. */
export function buildCard(item, ctx, { teaser = false } = {}) {
  const allTools = item.tools || [];
  const tools = allTools.slice(0, 3);
  const cats = (item.categories || []).slice(0, 3);
  return html`
    <article class="card item-card build-card">
      <div class="cover">${buildCover(item)}<div class="cover-tags">${statusTags(item)}</div></div>
      <div class="card-body">
        <h3>${teaser
          ? html`<a href="/builds?b=${encodeURIComponent(item.id)}">${item.title}</a>`
          : html`<button type="button" data-action="open" data-id="${item.id}">${item.title}</button>`}</h3>
        <p class="byline">by ${item.authorName || 'a Stanford builder'}</p>
        <p class="desc">${item.desc}</p>
        ${tools.length ? html`<div class="badge-row">${tools.map((t) => html`<span class="tag tag-accent">${t}</span>`)}${allTools.length > tools.length ? html`<span class="tag">+${allTools.length - tools.length}</span>` : ''}</div>` : ''}
        <div class="card-foot">
          <div class="hashtags">${cats.map((c) => html`<span class="hashtag">#${c}</span>`)}</div>
          <div class="btn-row" style="gap:0.35rem; flex-wrap:nowrap">
            ${teaser
              ? html`<span class="heart-btn" aria-label="${hearts(item)} hearts">${icons.heart}<span>${hearts(item)}</span></span>`
              : html`${heartButton(item, ctx)}${shareButton(item, 'build')}`}
          </div>
        </div>
      </div>
    </article>`;
}

function buildDetail(item, ctx) {
  const link = safeUrl(item.link);
  const linkedin = safeUrl(item.linkedin);
  const tools = item.tools || [];
  const other = item.otherTools || [];
  return html`
    <div class="detail-meta">
      <div class="badge-row">${statusTags(item)}${(item.categories || []).map((c) => html`<span class="hashtag">#${c}</span>`)}</div>
      <p class="muted">
        by <strong>${item.authorName || 'a Stanford builder'}</strong>
        ${linkedin ? html` · <a href="${linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a>` : ''}
        ${item.contactEmail ? html` · <a href="mailto:${item.contactEmail}">${item.contactEmail}</a>` : ''}
      </p>
      <div class="btn-row">
        ${link ? html`<a class="btn btn-primary" href="${link}" target="_blank" rel="noopener noreferrer">Open project ${icons.external}</a>` : ''}
        ${heartButton(item, ctx)}${shareButton(item, 'build')}
      </div>
    </div>
    <div class="detail-section"><h3>About</h3><div class="rich">${richText(item.desc)}</div></div>
    ${tools.length || other.length ? html`
      <div class="detail-section"><h3>Built with</h3>
        <div class="badge-row">${tools.map((t) => html`<span class="tag tag-accent">${t}</span>`)}${other.map((t) => html`<span class="tag">${t}</span>`)}</div>
      </div>` : ''}
    ${item.howBuilt ? html`<div class="detail-section"><h3>How I built it</h3><div class="rich">${richText(item.howBuilt)}</div></div>` : ''}
    <p class="hint" style="margin-top:var(--space-5)">Shared ${yearLabel(item.year)}${toMillis(item.createdAt) ? html` · ${new Date(toMillis(item.createdAt)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}</p>`;
}

export const buildsConfig = {
  collection: 'builds',
  param: 'b',
  noun: 'build',
  nounPlural: 'builds',
  path: '/builds',
  products: CLAUDE_PRODUCTS,
  categories: BUILD_CATEGORIES,
  defaultSort: 'newest',
  sorts: {
    newest: { label: 'Newest', fn: byNewest },
    hearts: { label: 'Most hearted', fn: (a, b) => hearts(b) - hearts(a) || byNewest(a, b) },
  },
  searchText: (i) => [i.title, i.desc, i.authorName, ...(i.tools || []), ...(i.otherTools || []), ...(i.categories || [])].join(' '),
  card: buildCard,
  detail: buildDetail,
  detailCover: buildCover,
  titleNew: 'Share a build',
  titleEdit: 'Edit your build',
  submitLabel: 'Share build',
  createExtras: () => ({ hearts: [] }),
  prefill: (user) => ({ authorName: user.displayName || '' }),
  schema: [
    { name: 'title', label: 'Project name', kind: 'text', required: true, max: LIMITS.title, placeholder: 'e.g. AI Study Buddy' },
    { name: 'link', label: 'Link', kind: 'url', required: true, max: LIMITS.url, placeholder: 'https://…', hint: 'Live demo, GitHub repo, video or Devpost page.' },
    { name: 'desc', label: 'What does it do?', kind: 'textarea', required: true, max: LIMITS.desc, rows: 3, placeholder: 'One or two sentences. This shows on the card.' },
    { name: 'tools', label: 'Claude products used', kind: 'checks', options: CLAUDE_PRODUCTS, maxItems: LIMITS.tools },
    { name: 'otherTools', label: 'Other tools', kind: 'list', placeholder: 'e.g. Cursor, Supabase, Figma', hint: 'Comma-separated.', maxItems: LIMITS.otherTools, maxEach: LIMITS.otherTool },
    { name: 'categories', label: 'Categories', kind: 'checks', options: BUILD_CATEGORIES, maxItems: LIMITS.categories },
    { name: 'howBuilt', label: 'How I built it', kind: 'textarea', max: LIMITS.howBuilt, rows: 6, placeholder: 'Your process: prompts, workflow, what worked, what surprised you. Blank lines start new paragraphs; lines starting with "- " become a list.' },
    { name: 'authorName', label: 'Your name', kind: 'text', required: true, max: LIMITS.name },
    { name: 'linkedin', label: 'LinkedIn URL', kind: 'url', max: LIMITS.url, placeholder: 'https://linkedin.com/in/…' },
    { name: 'contactEmail', label: 'Contact email', kind: 'email', max: 120, hint: 'Shown publicly so people can reach out about your project. Leave blank to keep it private.' },
  ],
};

if (document.querySelector('[data-gallery="builds"]')) mountGallery(buildsConfig);
