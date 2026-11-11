// Builds gallery: projects members made with Claude.

import { esc, html, icons, listSentence, raw, richText, safeUrl, smart, splitList, toMillis } from './ui.js';
import { coverArt, coverMeta } from './covers.js';
import { yearLabel } from './config.js';
import { CLAUDE_PRODUCTS, BUILD_CATEGORIES, LIMITS } from './taxonomy.js';
import { mountGallery, byNewest, heartButton, shareButton, statusTags } from './collection.js';

const hearts = (item) => (item.hearts || []).length;
const author = (item) => item.authorName || 'a Stanford student';
/** A title set in a narrow space may wrap after an "@", so "Claude@Stanford" is never cut off or split mid-word. */
const posterTitle = (item) => raw(esc(smart(item.title)).replace(/@/g, '@<wbr>'));

/** A build's poster: its paper colour with the title set on it and the generated art underneath.
    Used on /builds and, with teaser: true (a link instead of a button, no actions), on the home page. */
export function buildCard(item, ctx, { teaser = false } = {}) {
  const meta = coverMeta(item.id);
  const link = safeUrl(item.link);
  return html`
    <article class="poster" style="--paper:${meta.paper};--paper-ink:${meta.ink}">
      <div class="poster-sheet">
        <div class="poster-plate">
          <h3>${teaser
            ? html`<a href="/builds?b=${encodeURIComponent(item.id)}">${posterTitle(item)}</a>`
            : html`<button type="button" data-action="open" data-id="${item.id}">${posterTitle(item)}</button>`}</h3>
          <p class="poster-by">by ${author(item)}</p>
        </div>
        <div class="poster-art">${coverArt(item.id)}</div>
      </div>
      <p class="poster-desc">${smart(item.desc)}</p>
      ${teaser ? '' : html`
        <div class="poster-meta">
          ${heartButton(item, ctx)}
          ${link ? html`<a class="text-link" href="${link}" target="_blank" rel="noopener noreferrer">Try it</a>` : ''}
          ${statusTags(item, { year: false })}
        </div>`}
    </article>`;
}

/** The top of the pop-up: the poster laid on its side, title on the left and art on the right. */
function buildDetailHead(item) {
  const meta = coverMeta(item.id);
  const linkedin = safeUrl(item.linkedin);
  return html`
    <div class="detail-band" style="--paper:${meta.paper};--paper-ink:${meta.ink}">
      <div class="detail-band-text">
        <h2 id="detail-title">${smart(item.title)}</h2>
        <p class="detail-by">by ${author(item)}${linkedin ? html` · <a href="${linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a>` : ''}${item.contactEmail ? html` · <a href="mailto:${item.contactEmail}">Email</a>` : ''}</p>
      </div>
      <div class="detail-band-art">${coverArt(item.id)}</div>
    </div>`;
}

function buildDetail(item, ctx) {
  const link = safeUrl(item.link);
  // A few of last year's posts had "other tools" split at commas inside brackets when they were moved
  // over ("GPT (parser, judge)" became two entries). Joining and re-splitting puts those back together.
  const tools = [...(item.tools || []), ...splitList((item.otherTools || []).join(', '))];
  const cats = item.categories || [];
  const ms = toMillis(item.createdAt);
  const when = ms ? new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : yearLabel(item.year);
  return html`
    <div class="detail-actions">
      ${link ? html`<a class="btn btn-primary" href="${link}" target="_blank" rel="noopener noreferrer">Open project ${icons.external}</a>` : ''}
      ${heartButton(item, ctx)}${shareButton(item, 'build')}
      ${statusTags(item, { year: false })}
    </div>
    <div class="detail-lede">${richText(item.desc, { smartQuotes: true })}</div>
    ${item.howBuilt ? html`<div class="detail-section"><h3>How I built it</h3><div class="rich">${richText(item.howBuilt)}</div></div>` : ''}
    <p class="detail-foot-note">${tools.length ? `Built with ${listSentence(tools)}. ` : ''}${cats.length ? `Filed under ${listSentence(cats)}. ` : ''}Shared ${when}.</p>`;
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
  detailHead: buildDetailHead,
  dialogClass: 'dialog-wide',
  titleNew: 'Add your build',
  titleEdit: 'Edit your build',
  submitLabel: 'Post build',
  createExtras: () => ({ hearts: [] }),
  prefill: (user) => ({ authorName: user.displayName || '' }),
  schema: [
    { name: 'title', label: 'Project name', kind: 'text', required: true, max: LIMITS.title, placeholder: 'e.g. AI Study Buddy' },
    { name: 'link', label: 'Link', kind: 'url', required: true, max: LIMITS.url, placeholder: 'https://…', hint: 'Live demo, GitHub repo, video or Devpost page.' },
    { name: 'desc', label: 'What does it do?', kind: 'textarea', required: true, max: LIMITS.desc, rows: 3, placeholder: 'One or two plain sentences. This shows under your poster.' },
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
