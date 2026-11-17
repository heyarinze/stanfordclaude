// Past years' material (data/archive/<year>.json), shared by the home page, Events, Team and the Archive.

import { html, listSentence, safeUrl } from './ui.js';
import { getJSON } from './config.js';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** 3 -> "three" (numbers up to ten are spelled out). */
export const numberWord = (n) => WORDS[n] ?? String(n);

/** The most recent archived year, or null if nothing is archived. */
export async function latestArchive() {
  const { years = [] } = await getJSON('/data/archive/index.json');
  const latest = [...years].sort().reverse()[0];
  return latest ? getJSON(`/data/archive/${latest}.json`) : null;
}

/** "Three winners and two honorable mentions." */
export function hackathonSummary(h) {
  const w = (h.winners || []).length;
  const m = (h.mentions || []).length;
  const parts = [];
  if (w) parts.push(`${numberWord(w)} ${w === 1 ? 'winner' : 'winners'}`);
  if (m) parts.push(`${numberWord(m)} honorable ${m === 1 ? 'mention' : 'mentions'}`);
  const text = parts.join(' and ');
  return text ? `${text[0].toUpperCase()}${text.slice(1)}.` : '';
}

/** One ruled row per entry. Winners get their place as a big numeral; pass clamp to cut descriptions to two lines. */
export function entryRows(entries = [], { ranked = true, clamp = false } = {}) {
  return html`
    <ol class="rows">
      ${entries.map((e) => {
        const link = safeUrl(e.link);
        const by = [listSentence(e.builders || []), e.track].filter(Boolean).join(' · ');
        return html`
          <li class="row${ranked ? ' row-ranked' : ''}">
            ${ranked ? html`<span class="row-num" aria-hidden="true">${e.place}</span>` : ''}
            <div>
              <h3>${ranked ? html`<span class="visually-hidden">Place ${e.place}: </span>` : ''}${e.title}</h3>
              ${by ? html`<p class="row-by">${by}</p>` : ''}
              <p class="row-desc${clamp ? ' row-clamp' : ''}">${e.desc}</p>
            </div>
            <div class="row-actions">${link ? html`<a class="text-link" href="${link}" target="_blank" rel="noopener noreferrer">Devpost</a>` : ''}</div>
          </li>`;
      })}
    </ol>`;
}
