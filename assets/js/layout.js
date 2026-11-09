// Shared header and footer for every page: <site-header current="builds"> and <site-footer>.
// Both render immediately (no network wait) and are patched once data/site.json arrives.
// Also: header scrolled state and reveal-on-scroll for elements marked [data-reveal].

import { html, icons, brandMark, initials } from './ui.js';
import { getConfig, yearLabel } from './config.js';

const NAV = [
  { key: 'builds', href: '/builds', label: 'Builds' },
  { key: 'library', href: '/library', label: 'Library' },
  { key: 'learn', href: '/learn', label: 'Learn' },
  { key: 'events', href: '/events', label: 'Events' },
  { key: 'perks', href: '/perks', label: 'Perks' },
  { key: 'team', href: '/team', label: 'Team' },
];
const DEFAULT_YEAR = '2026-27';

/** Point every [data-join-link] at the Slack invite once we know it. */
function applyJoinLinks(root, config) {
  if (!config.slackUrl) return;
  root.querySelectorAll('[data-join-link]').forEach((a) => {
    a.href = config.slackUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = String(html`${icons.slack} ${a.dataset.joinLink || 'Join the Slack'}`);
  });
}

class SiteHeader extends HTMLElement {
  connectedCallback() {
    const current = this.getAttribute('current');
    this.innerHTML = String(html`
      <a class="skip-link" href="#main">Skip to content</a>
      <header class="site-header">
        <div class="container">
          <a class="brand" href="/" aria-label="Claude@Stanford home">
            ${brandMark()}<span>Claude<span class="brand-at">@</span>Stanford</span>
          </a>
          <nav aria-label="Main">
            <ul class="nav-links" id="nav-links">
              ${NAV.map((item) => html`<li><a href="${item.href}" ${item.key === current ? html`aria-current="page"` : ''}>${item.label}</a></li>`)}
              <li class="nav-join-mobile"><a href="/#join" data-join-link="Join the Slack">Join</a></li>
            </ul>
          </nav>
          <div class="nav-actions">
            <a class="btn btn-primary btn-sm nav-join-desktop" href="/#join" data-join-link="Join the Slack">Join</a>
            <div class="auth-slot" data-auth-slot></div>
            <button class="nav-toggle" type="button" aria-controls="nav-links" aria-expanded="false" aria-label="Open menu">${icons.menu}</button>
          </div>
        </div>
      </header>`);

    const header = this.querySelector('.site-header');
    const toggle = this.querySelector('.nav-toggle');
    const links = this.querySelector('.nav-links');
    const setOpen = (open) => {
      links.classList.toggle('open', open);
      header.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      toggle.innerHTML = String(open ? icons.close : icons.menu);
    };
    toggle.addEventListener('click', () => setOpen(!links.classList.contains('open')));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && links.classList.contains('open')) { setOpen(false); toggle.focus(); }
    });
    links.addEventListener('click', (event) => { if (event.target.closest('a')) setOpen(false); });

    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    getConfig().then((config) => applyJoinLinks(this, config));
    this.mountAuth();
  }

  // Firebase loads shortly after the page so static pages paint first.
  mountAuth() {
    const slot = this.querySelector('[data-auth-slot]');
    const start = () => import('./firebase.js').then((fb) => {
      fb.onSession((session) => renderAuth(slot, session, fb));
    }).catch((err) => console.error('Auth failed to load', err));
    if (document.body.dataset.needsAuth !== undefined) start();
    else if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 800 });
    else setTimeout(start, 400);
  }
}

function renderAuth(slot, session, fb) {
  const { user, isLead } = session;
  if (!user) {
    slot.innerHTML = '<button type="button" class="btn btn-ghost btn-sm" data-signin>Sign in</button>';
    slot.querySelector('[data-signin]').addEventListener('click', () => fb.signIn());
    return;
  }
  const name = user.displayName || user.email;
  const first = String(name).split(/\s+/)[0];
  slot.innerHTML = String(html`
    <div class="user-menu">
      <button type="button" aria-haspopup="true" aria-expanded="false">
        <span class="avatar">${user.photoURL ? html`<img src="${user.photoURL}" alt="" referrerpolicy="no-referrer">` : initials(name)}</span>
        <span class="name">${first}</span>
      </button>
      <div class="user-menu-panel" hidden>
        <div class="who">Signed in as ${user.email}${isLead ? ' · Lead' : ''}</div>
        <a href="/builds?mine=1">My builds</a>
        <a href="/library?mine=1">My library posts</a>
        ${isLead ? html`<a href="/admin">Moderation</a>` : ''}
        <button type="button" data-signout>Sign out</button>
      </div>
    </div>`);
  const button = slot.querySelector('.user-menu > button');
  const panel = slot.querySelector('.user-menu-panel');
  const setOpen = (open) => { panel.hidden = !open; button.setAttribute('aria-expanded', String(open)); };
  button.addEventListener('click', (event) => { event.stopPropagation(); setOpen(panel.hidden); });
  document.addEventListener('click', (event) => { if (!slot.contains(event.target)) setOpen(false); });
  slot.addEventListener('keydown', (event) => { if (event.key === 'Escape') { setOpen(false); button.focus(); } });
  slot.querySelector('[data-signout]').addEventListener('click', async () => {
    await fb.signOutUser();
    setOpen(false);
  });
}

class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = String(html`
      <footer class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-about">
              <a class="brand" href="/">${brandMark()}<span>Claude<span class="brand-at">@</span>Stanford</span></a>
              <p>A student-run community at Stanford for building, learning and creating with Claude.</p>
              <div class="powered-by">Powered by <img src="/assets/img/anthropic-wordmark.png" alt="Anthropic" width="98" height="11"></div>
            </div>
            <div>
              <h2>Community</h2>
              <ul>
                <li><a href="/builds">Builds</a></li>
                <li><a href="/library">Library</a></li>
                <li><a href="/events">Events</a></li>
              </ul>
            </div>
            <div>
              <h2>Learn</h2>
              <ul>
                <li><a href="/learn">Workshops</a></li>
                <li><a href="/perks">Perks &amp; credits</a></li>
              </ul>
            </div>
            <div>
              <h2>Club</h2>
              <ul data-footer-club>
                <li><a href="/team">Team</a></li>
                <li><a href="/archive">Archive</a></li>
                <li><a href="/#join" data-join-link="Slack">Join</a></li>
              </ul>
            </div>
          </div>
          <div class="footer-bottom">
            <span>Claude@Stanford · <span data-footer-year>${yearLabel(DEFAULT_YEAR)}</span></span>
            <span>Built with Claude Code. Original site by <a href="https://www.linkedin.com/in/arinzeobiezue/" target="_blank" rel="noopener">Arinze Obiezue</a>.</span>
          </div>
        </div>
        <div class="footer-wordmark" aria-hidden="true">Claude<em>@</em>Stanford</div>
      </footer>`);
    getConfig().then((config) => {
      applyJoinLinks(this, config);
      this.querySelector('[data-footer-year]').textContent = yearLabel(config.academicYear);
      if (config.contactEmail) {
        const li = document.createElement('li');
        li.innerHTML = String(html`<a href="mailto:${config.contactEmail}">Contact</a>`);
        this.querySelector('[data-footer-club]').append(li);
      }
    });
  }
}

customElements.define('site-header', SiteHeader);
customElements.define('site-footer', SiteFooter);

/* ---------- Ambient light + cursor spotlight ---------- */

if (!document.querySelector('.aurora')) {
  const aurora = document.createElement('div');
  aurora.className = 'aurora';
  aurora.setAttribute('aria-hidden', 'true');
  aurora.innerHTML = '<i class="a"></i><i class="b"></i><i class="c"></i>';
  document.body.prepend(aurora);
}

// Cards marked .spotlight get a soft light under the pointer (CSS reads --mx/--my).
document.addEventListener('pointermove', (event) => {
  const el = event.target.closest?.('.spotlight');
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${event.clientX - r.left}px`);
  el.style.setProperty('--my', `${event.clientY - r.top}px`);
}, { passive: true });

/* ---------- Reveal on scroll ---------- */

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealer = 'IntersectionObserver' in window && !reduceMotion
  ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        revealer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 })
  : null;

/* ---------- Static cover slots: <div class="cover" data-cover-seed="…" data-palette data-pattern> ---------- */

const coverSlots = document.querySelectorAll('[data-cover-seed]');
if (coverSlots.length) {
  import('./covers.js').then(({ coverArt }) => {
    coverSlots.forEach((el) => {
      el.innerHTML = String(coverArt(el.dataset.coverSeed, { palette: el.dataset.palette, pattern: el.dataset.pattern }));
    });
  });
}

/** Start revealing [data-reveal] elements inside root (call again for content added later). */
export function reveal(root = document) {
  root.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => {
    if (revealer) revealer.observe(el);
    else el.classList.add('is-in');
  });
}
reveal();
