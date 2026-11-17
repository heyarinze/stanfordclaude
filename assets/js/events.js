// Events: the club's own list (data/events.json), each with its RSVP link. Events move from
// "Coming up" to "Earlier this year" by themselves once they are over.
// A Luma calendar can also be embedded by setting lumaEmbedUrl in data/site.json.
// The home page uses the same pieces for its "Coming up" section.

import { html, icons, safeUrl, smart } from './ui.js';
import { getConfig, getJSON } from './config.js';
import { latestArchive, hackathonSummary, entryRows, numberWord } from './hackathon.js';

/* ---------- Dates: every date and time is Stanford's, wherever the visitor is ---------- */

const ZONE = 'America/Los_Angeles';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const GRACE = 3 * HOUR;   // with no end time, an event stays "coming up" until three hours after it starts
const format = (options) => { const f = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, ...options }); return (ms) => f.format(ms); };
const clock = format({ hour: 'numeric', minute: '2-digit' });                    // 5:30 PM
const dayName = format({ weekday: 'long', month: 'long', day: 'numeric' });      // Friday, November 20
const dateLine = format({ month: 'long', day: 'numeric', year: 'numeric' });     // November 20, 2026
const monthShort = format({ month: 'short' });
const dayNumber = format({ day: 'numeric' });

const WALL = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
/** What a clock and calendar at Stanford show at a moment: { year, month, day, hour, minute }. */
function wall(ms) {
  const p = {};
  for (const { type, value } of WALL.formatToParts(ms)) if (type !== 'literal') p[type] = Number(value);
  return p;
}
/** The moment at which the clock at Stanford shows this date and time (summer time included). */
function stanfordTime(y, mo, d, h = 0, mi = 0) {
  const target = Date.UTC(y, mo - 1, d, h, mi);
  const offset = (ms) => { const p = wall(ms); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - ms; };   // minus 8 or 7 hours
  return target - offset(target - offset(target));
}
const isoDate = (ms) => { const p = wall(ms); return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`; };

const STANFORD = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]\s*(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([ap])\.?m\.?)?)?$/i;
const EXACT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

/** Reads "2026-11-20 17:30" (a date and time at Stanford; "5:30 PM" also works), "2026-11-20" (the whole
    day), or a full ISO time that carries its own offset. Anything else is unreadable, never guessed at. */
function readTime(text) {
  const s = String(text ?? '').trim();
  if (EXACT.test(s)) return { ms: Date.parse(s), allDay: false };
  const m = STANFORD.exec(s);
  if (!m) return { ms: NaN, allDay: false };
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const allDay = m[4] === undefined;
  let h = allDay ? 0 : Number(m[4]);
  const mi = allDay ? 0 : Number(m[5]);
  if (m[6]) {
    if (h < 1 || h > 12) return { ms: NaN, allDay };
    h = (h % 12) + (m[6].toLowerCase() === 'p' ? 12 : 0);
  }
  const real = new Date(Date.UTC(y, mo - 1, d));   // February 30 would roll over into March
  if (real.getUTCMonth() !== mo - 1 || real.getUTCDate() !== d || h > 23 || mi > 59) return { ms: NaN, allDay };
  return { ms: stanfordTime(y, mo, d, h, mi), allDay };
}

/** "Friday, November 20 · 5:30 PM", with "to 7:30 PM" or "to Sunday, November 22" when there is an end. */
function whenText(e) {
  const from = e.allDay ? dayName(e.startMs) : `${dayName(e.startMs)} · ${clock(e.startMs)}`;
  if (Number.isNaN(e.endMs)) return from;
  if (dayName(e.endMs) === dayName(e.startMs)) return e.allDay || e.endAllDay ? from : `${from} to ${clock(e.endMs)}`;
  return `${from} to ${e.endAllDay ? dayName(e.endMs) : `${dayName(e.endMs)} · ${clock(e.endMs)}`}`;
}

/** When an event stops being "coming up": its end (the end of that day, if the end is only a date), or
    three hours after it starts (after the day, if the start is only a date). */
const endsAt = (e) => (Number.isNaN(e.endMs) ? e.startMs + (e.allDay ? DAY : 0) + GRACE : e.endMs + (e.endAllDay ? DAY : 0));

/* ---------- The list ---------- */

export function lumaEmbed(config, { height = 640 } = {}) {
  const src = safeUrl(config.lumaEmbedUrl);
  if (!src) return null;
  return html`<div class="embed-frame"><iframe src="${src}" title="Claude@Stanford events on Luma" height="${height}" loading="lazy" allowfullscreen aria-label="Events calendar"></iframe></div>`;
}

/** The events in data/events.json that have a title and a start that can be read. */
export async function loadEvents() {
  const { events } = await getJSON('/data/events.json');
  const list = [];
  for (const e of Array.isArray(events) ? events : []) {
    const start = readTime(e?.start);
    if (!e?.title || Number.isNaN(start.ms)) { console.warn('events.json: left out an entry with no title or a start that could not be read', e); continue; }
    const end = e.end ? readTime(e.end) : null;
    const endOk = Boolean(end) && end.ms >= start.ms;
    if (end && !endOk) console.warn('events.json: ignored an end that could not be read or comes before the start', e);
    list.push({ ...e, startMs: start.ms, allDay: start.allDay, endMs: endOk ? end.ms : NaN, endAllDay: endOk && end.allDay });
  }
  return list;
}

/** Events still to come (soonest first) and events that are over (latest first). */
export function splitEvents(events, now = Date.now()) {
  const over = (e) => endsAt(e) < now;
  return {
    upcoming: events.filter((e) => !over(e)).sort((a, b) => a.startMs - b.startMs),
    past: events.filter(over).sort((a, b) => b.startMs - a.startMs),
  };
}

/** One ruled row per event: the date set large, then what, when and where, the things worth knowing
    before you come, and the RSVP link.
    compact: a two-line summary and no notes (the home page). past: events that are over, also compact,
    with no RSVP and a recap link if there is one. */
export function eventRows(events, { past = false, compact = false } = {}) {
  const brief = past || compact;
  return html`
    <ol class="rows">
      ${events.map((e) => {
        const link = safeUrl(past ? e.recap : e.link);
        const label = past ? (e.recapLabel || 'Recap') : (e.linkLabel || 'RSVP');
        const notes = brief || !Array.isArray(e.notes) ? [] : e.notes.filter(Boolean);
        return html`
          <li class="row row-event${notes.length ? ' row-event-notes' : ''}">
            <div class="event-date" aria-hidden="true"><span class="event-month">${monthShort(e.startMs)}</span><span class="event-day">${dayNumber(e.startMs)}</span></div>
            <div class="event-main">
              <h3>${smart(e.title)}</h3>
              <p class="row-by"><time datetime="${e.allDay ? isoDate(e.startMs) : new Date(e.startMs).toISOString()}">${past ? dateLine(e.startMs) : whenText(e)}</time></p>
              ${e.place && !past ? html`<p class="event-where">${smart(e.place)}</p>` : ''}
              ${e.summary ? html`<p class="row-desc${brief ? ' row-clamp' : ''}">${smart(e.summary)}</p>` : ''}
            </div>
            ${notes.length ? html`<ul class="event-notes">${notes.map((n) => html`<li>${smart(n)}</li>`)}</ul>` : ''}
            ${link ? html`<div class="row-actions"><a class="${past ? 'text-link' : 'btn btn-primary'}" href="${link}" target="_blank" rel="noopener noreferrer">${label}</a></div>` : ''}
          </li>`;
      })}
    </ol>`;
}

/* ---------- The Events page ---------- */

const target = document.querySelector('[data-events]');
if (target) {
  const [config, events] = await Promise.all([getConfig(), loadEvents().catch((err) => { console.error(err); return []; })]);
  const { upcoming, past } = splitEvents(events);
  const embed = lumaEmbed(config);
  const calendar = safeUrl(config.lumaCalendarUrl);
  const slack = safeUrl(config.slackUrl);
  const subscribe = document.querySelector('[data-luma-subscribe]');
  if (subscribe && calendar) { subscribe.href = calendar; subscribe.hidden = false; }

  target.innerHTML = String(html`
    ${upcoming.length ? html`
      <section aria-labelledby="coming-up">
        <div class="section-head"><h2 id="coming-up">Coming up</h2></div>
        ${eventRows(upcoming)}
      </section>` : ''}
    ${!upcoming.length && !embed ? html`
      <div class="empty">
        <h2>Nothing on the calendar yet.</h2>
        <p>${past.length ? 'The next event hasn’t been scheduled. When it is, it will show up here with a link to RSVP.' : 'This year’s first events haven’t been scheduled. When they are, they’ll show up here with a link to RSVP.'}</p>
        ${slack ? html`<div class="btn-row"><a class="btn btn-primary" href="${slack}" target="_blank" rel="noopener">${icons.slack} Join the Slack to hear first</a></div>` : ''}
      </div>` : ''}
    ${embed ? html`
      <section class="${upcoming.length ? 'section-tight' : ''}" aria-labelledby="calendar">
        <div class="section-head"><h2 id="calendar">Calendar</h2></div>
        ${embed}
      </section>` : ''}
    ${past.length ? html`
      <section class="section-tight" aria-labelledby="earlier">
        <div class="section-head"><h2 id="earlier">Earlier this year</h2></div>
        ${eventRows(past, { past: true })}
      </section>` : ''}
    <div data-last-year></div>`);

  // Until this year has events of its own to look back on, show how last year ended.
  if (!past.length) {
    latestArchive().then((year) => {
      const h = year?.hackathon;
      if (!h || !(h.winners || []).length) return;
      const total = h.winners.length + (h.mentions || []).length;
      target.querySelector('[data-last-year]').innerHTML = String(html`
        <section class="section split" aria-labelledby="last-hack">
          <div>
            <h2 id="last-hack">Last year ended with a hackathon</h2>
            <p>${hackathonSummary(h)}</p>
            <a class="text-link" href="/archive?year=${encodeURIComponent(year.year)}">${total > h.winners.length ? `See all ${numberWord(total)}` : 'See the archive'}</a>
          </div>
          ${entryRows(h.winners, { clamp: true })}
        </section>`);
    }).catch((err) => console.error(err));
  }
}
