// Events: the club's own list (data/events.json), each with its RSVP link. Events move from
// "Coming up" to "Past events" by themselves once they are over.
// This file draws the Events page and the home page's "Coming up" section. It needs nothing from
// Firebase, so both still show when the sign-in scripts can't load.
// A Luma calendar can also be embedded by setting lumaEmbedUrl in data/site.json.

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
/** The moment at which the clock at Stanford shows this date and time (summer time included).
    A day past the end of a month rolls into the next one, so "day + 1" is always tomorrow. */
function stanfordTime(y, mo, d, h = 0, mi = 0) {
  const target = Date.UTC(y, mo - 1, d, h, mi);
  const offset = (ms) => { const p = wall(ms); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - ms; };   // minus 8 or 7 hours
  return target - offset(target - offset(target));
}
const isoDate = (ms) => { const p = wall(ms); return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`; };
const realDay = (y, mo, d) => { const t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d; };   // not February 30

const TIME = String.raw`(\d{1,2})(?::(\d{2}))?(?::\d{2})?(?:\s*([ap])\.?m\.?)?`;
const STANFORD = new RegExp(String.raw`^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ,]\s*${TIME})?$`, 'i');
const TIME_ONLY = new RegExp(`^${TIME}$`, 'i');
const EXACT = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;
const ZONE_WORD = /\s*\b(?:PT|PST|PDT|Pacific(?:\s+time)?)\.?$/i;   // "5:30 PM PT" says nothing new: every time here is Pacific

/** "17:30", "5:30 PM" or "5pm" as [hour, minute] on a 24-hour clock; null if it can't be read. */
function clockTime(hour, minute, half) {
  let h = Number(hour);
  const mi = minute === undefined ? 0 : Number(minute);
  if (half) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (half.toLowerCase() === 'p' ? 12 : 0);
  } else if (minute === undefined) {
    return null;   // a bare "5" could be morning or evening
  }
  return h > 23 || mi > 59 ? null : [h, mi];
}

/** Reads a start or an end as typed in events.json. Gives { ms, allDay, nextDay }, or null.
    - "2026-11-20 17:30", "2026-11-20 5:30 PM", "2026-11-20 5pm": that date and time at Stanford
    - "2026-11-20": the whole day (nextDay is the midnight that ends it)
    - "19:30" or "7:30 PM", for an end only: that time on the day the event starts
    - a full ISO time that carries its own offset
    Anything else is unreadable. It is left out rather than guessed at. */
function readTime(text, start) {
  const s = String(text ?? '').trim().replace(ZONE_WORD, '');
  const exact = EXACT.exec(s);
  if (exact) return realDay(Number(exact[1]), Number(exact[2]), Number(exact[3])) ? { ms: Date.parse(s), allDay: false } : null;
  const only = start ? TIME_ONLY.exec(s) : null;
  if (only) {
    const t = clockTime(only[1], only[2], only[3]);
    if (!t) return null;
    const day = wall(start.ms);
    const sameDay = stanfordTime(day.year, day.month, day.day, t[0], t[1]);
    // "10 PM" to "1 AM" ends the next morning.
    return { ms: sameDay > start.ms ? sameDay : stanfordTime(day.year, day.month, day.day + 1, t[0], t[1]), allDay: false };
  }
  const m = STANFORD.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!realDay(y, mo, d)) return null;
  if (m[4] === undefined) return { ms: stanfordTime(y, mo, d), allDay: true, nextDay: stanfordTime(y, mo, d + 1) };
  const t = clockTime(m[4], m[5], m[6]);
  return t ? { ms: stanfordTime(y, mo, d, t[0], t[1]), allDay: false } : null;
}

/** One entry from the file, with its times worked out; null if it has no title or no readable start.
    untilMs is when it stops being "coming up": its end (the end of that day, if the end is only a date),
    or three hours after it starts (after the day, if the start is only a date). */
function readEvent(e) {
  if (!e || typeof e.title !== 'string' || !e.title.trim()) return null;
  const start = readTime(e.start);
  if (!start) return null;
  const typedEnd = e.end === undefined || e.end === null || e.end === '' ? null : readTime(e.end, start);
  const end = typedEnd && (typedEnd.allDay ? typedEnd.nextDay : typedEnd.ms) > start.ms ? typedEnd : null;
  if (!end && e.end) console.warn('events.json: ignored an end that could not be read, or is not after the start', e);
  return {
    ...e,
    startMs: start.ms,
    allDay: start.allDay,
    endMs: end ? end.ms : NaN,
    endAllDay: Boolean(end && end.allDay),
    untilMs: end ? (end.allDay ? end.nextDay : end.ms) : (start.allDay ? start.nextDay : start.ms) + GRACE,
  };
}

/** "Friday, November 20 · 5:30 PM", with "to 7:30 PM" or "to Sunday, November 22" when there is an end. */
function whenText(e) {
  const from = e.allDay ? dayName(e.startMs) : `${dayName(e.startMs)} · ${clock(e.startMs)}`;
  if (Number.isNaN(e.endMs)) return from;
  const timed = !e.allDay && !e.endAllDay;
  const lateNight = timed && e.endMs - e.startMs < DAY && wall(e.endMs).hour < 6;   // 10 PM to 1 AM is one evening
  if (lateNight || dayName(e.endMs) === dayName(e.startMs)) return timed ? `${from} to ${clock(e.endMs)}` : from;
  return `${from} to ${e.endAllDay ? dayName(e.endMs) : `${dayName(e.endMs)} · ${clock(e.endMs)}`}`;
}

/* ---------- The list ---------- */

export function lumaEmbed(config, { height = 640 } = {}) {
  const src = safeUrl(config.lumaEmbedUrl);
  if (!src) return null;
  return html`<div class="embed-frame"><iframe src="${src}" title="Claude@Stanford events on Luma" height="${height}" loading="lazy" allowfullscreen aria-label="Events calendar"></iframe></div>`;
}

/** The entries in the file, however the list was typed: { "events": [ … ] } as documented, a bare list,
    or a single entry where the list should be. null means the file isn't an events file at all. */
function entriesIn(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return null;
  const key = Object.keys(data).find((k) => k.toLowerCase() === 'events');
  const found = key ? data[key] : 'title' in data || 'start' in data ? data : Object.keys(data).length ? null : [];
  if (Array.isArray(found)) return found;
  return found && typeof found === 'object' ? [found] : null;
}

/** The events in data/events.json that have a title and a start that can be read.
    Throws if the file can't be loaded or isn't an events file, so a broken file is never mistaken for an empty calendar. */
export async function loadEvents() {
  const entries = entriesIn(await getJSON('/data/events.json'));
  if (!entries) throw new Error('data/events.json should look like { "events": [ … ] }');
  const list = [];
  for (const e of entries) {
    const event = readEvent(e);
    if (event) list.push(event);
    else console.warn('events.json: left out an entry with no title or a start that could not be read', e);
  }
  return list;
}

/** Events still to come (soonest first) and events that are over (latest first). */
export function splitEvents(events, now = Date.now()) {
  const over = (e) => e.untilMs < now;
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
        const label = String((past ? e.recapLabel : e.linkLabel) || (past ? 'Recap' : 'RSVP'));
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
            ${link ? html`<div class="row-actions"><a class="${past ? 'text-link' : 'btn btn-primary'}" href="${link}" target="_blank" rel="noopener noreferrer" aria-label="${label}: ${smart(e.title)} (opens in a new tab)">${label}</a></div>` : ''}
          </li>`;
      })}
    </ol>`;
}

/** Show a section that was held back until its content arrived, without moving what the reader is
    looking at. Most browsers keep the reader's place by themselves when something appears above it
    (scroll anchoring). Where the browser doesn't, as when a link to /#join has already scrolled past
    this spot, do the same by hand. */
function reveal(section) {
  const below = section.nextElementSibling;
  const before = below ? below.getBoundingClientRect().top : 0;
  section.hidden = false;
  if (!below || before > 0 || (window.CSS && CSS.supports('overflow-anchor', 'auto'))) return;
  const moved = below.getBoundingClientRect().top - before;
  if (moved) window.scrollBy(0, moved);
}

/* ---------- The Events page ---------- */

const target = document.querySelector('[data-events]');
if (target) {
  const [config, loaded] = await Promise.all([getConfig(), loadEvents().catch((err) => { console.error(err); return null; })]);
  const { upcoming, past } = splitEvents(loaded || []);
  const failed = !loaded;
  const embed = lumaEmbed(config);
  const calendar = safeUrl(config.lumaCalendarUrl);
  const slack = safeUrl(config.slackUrl);
  const subscribe = document.querySelector('[data-luma-subscribe]');
  if (subscribe && calendar) { subscribe.href = calendar; subscribe.hidden = false; }

  const nothing = failed
    ? ['Couldn’t load events.', 'Refresh to try again.']
    : past.length
      ? ['Nothing coming up right now.', 'The next event hasn’t been scheduled. When it is, it will show up here with a link to RSVP.']
      : ['Nothing on the calendar yet.', 'This year’s first events haven’t been scheduled. When they are, they’ll show up here with a link to RSVP.'];

  target.innerHTML = String(html`
    ${upcoming.length ? html`
      <section aria-labelledby="coming-up">
        <div class="section-head"><h2 id="coming-up">Coming up</h2></div>
        ${eventRows(upcoming)}
      </section>` : ''}
    ${!upcoming.length && !embed ? html`
      <div class="empty">
        <h2>${nothing[0]}</h2>
        <p>${nothing[1]}</p>
        ${slack && !failed ? html`<div class="btn-row"><a class="btn btn-primary" href="${slack}" target="_blank" rel="noopener">${icons.slack} Join the Slack to hear first</a></div>` : ''}
      </div>` : ''}
    ${embed ? html`
      <section class="${upcoming.length ? 'section-tight' : ''}" aria-labelledby="calendar">
        <div class="section-head"><h2 id="calendar">Calendar</h2></div>
        ${embed}
      </section>` : ''}
    ${past.length ? html`
      <section class="section-tight" aria-labelledby="past-events">
        <div class="section-head"><h2 id="past-events">Past events</h2></div>
        ${eventRows(past, { past: true })}
      </section>` : ''}
    <div data-last-year></div>`);
  target.setAttribute('aria-busy', 'false');

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

/* ---------- The home page's "Coming up": the next two events, or the Luma calendar if only that is set up ---------- */

const next = document.querySelector('[data-next-events]');
if (next) {
  const [config, events] = await Promise.all([getConfig(), loadEvents().catch((err) => { console.error(err); return []; })]);
  const { upcoming } = splitEvents(events);
  const content = upcoming.length ? eventRows(upcoming.slice(0, 2), { compact: true }) : lumaEmbed(config, { height: 460 });
  if (content) {
    next.querySelector('[data-embed]').innerHTML = String(content);
    reveal(next);
  }
}
