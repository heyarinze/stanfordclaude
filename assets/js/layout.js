// Shared header and footer for every page: <site-header current="builds"> and <site-footer>.
// Both render immediately and are patched once data/site.json arrives.

import { html, brandMark, initials } from './ui.js';
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
const brand = () => html`${brandMark()}<span>Claude<span class="brand-at">@</span>Stanford</span>`;

/** Point every [data-join-link] at the Slack invite once we know it. Until then they lead to the join section. */
function applyJoinLinks(root, config) {
  if (!config.slackUrl) return;
  root.querySelectorAll('[data-join-link]').forEach((a) => {
    a.href = config.slackUrl;
    a.target = '_blank';
    a.rel = 'noopener';
  });
}

class SiteHeader extends HTMLElement {
  connectedCallback() {
    const current = this.getAttribute('current');
    this.innerHTML = String(html`
      <a class="skip-link" href="#main">Skip to content</a>
      <header class="site-header">
        <div class="container">
          <a class="brand" href="/" aria-label="Claude@Stanford home">${brand()}</a>
          <nav aria-label="Main">
            <ul class="nav-links" id="nav-links">
              ${NAV.map((item) => (item.key === current
                ? html`<li><a href="${item.href}" aria-current="page">${item.label}<i class="nav-ink"></i></a></li>`
                : html`<li><a href="${item.href}">${item.label}</a></li>`))}
              <li class="nav-extra"><a class="btn btn-bone" href="/#join" data-join-link>Join the club</a><button type="button" data-signin>Sign in</button></li>
            </ul>
          </nav>
          <div class="nav-actions">
            <a class="btn btn-bone btn-sm nav-join" href="/#join" data-join-link>Join</a>
            <div class="auth-slot" data-auth-slot></div>
            <button class="nav-toggle" type="button" aria-controls="nav-links" aria-expanded="false">Menu</button>
          </div>
        </div>
      </header>`);

    // Phones: "Menu" opens the links as a full-screen sheet.
    const toggle = this.querySelector('.nav-toggle');
    const links = this.querySelector('.nav-links');
    const setOpen = (open) => {
      links.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
      // While the sheet covers the page, keep the keyboard and screen readers out of what is behind it.
      document.querySelectorAll('main, site-footer').forEach((el) => { el.inert = open; });
    };
    toggle.addEventListener('click', () => {
      const open = !links.classList.contains('open');
      setOpen(open);
      if (open) links.querySelector('a')?.focus();   // the links sit before the button, so Tab alone would skip them
    });
    matchMedia('(min-width: 901px)').addEventListener('change', (event) => { if (event.matches) setOpen(false); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && links.classList.contains('open')) { setOpen(false); toggle.focus(); }
    });
    links.addEventListener('click', (event) => { if (event.target.closest('a, button')) setOpen(false); });
    links.querySelector('[data-signin]').addEventListener('click', () => {
      import('./firebase.js').then((fb) => fb.signIn()).catch((err) => console.error('Sign-in failed to load', err));
    });

    getConfig().then((config) => applyJoinLinks(this, config));
    this.mountAuth();
    watchPageScripts();
  }

  // Firebase loads shortly after the page so static pages paint first.
  mountAuth() {
    const header = this.querySelector('.site-header');
    const slot = this.querySelector('[data-auth-slot]');
    const start = () => import('./firebase.js').then((fb) => {
      fb.onSession((session) => renderAuth(header, slot, session, fb));
    }).catch((err) => console.error('Auth failed to load', err));
    if (document.body.dataset.needsAuth !== undefined) start();
    else if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 800 });
    else setTimeout(start, 400);
  }
}

/* If a page's own script can't load (a script host that is blocked or unreachable), say so once
   instead of leaving grey placeholders up for good. */
function watchPageScripts() {
  const failed = () => {
    const stuck = new Set([
      ...document.querySelectorAll('main [aria-busy="true"]'),
      ...[...document.querySelectorAll('main .skeleton')].map((s) => s.parentElement),
      ...[...document.querySelectorAll('main [data-gallery]')].filter((el) => !el.children.length),
    ]);
    let said = false;
    stuck.forEach((el) => {
      el.setAttribute('aria-busy', 'false');
      if (said) { const section = el.closest('section'); (section && !section.querySelector('h1') ? section : el).hidden = true; return; }   // one message is enough
      said = true;
      el.innerHTML = '<div class="empty"><h2>This part of the page didn’t load.</h2><p>Check your connection. If you use a content blocker, allow scripts from gstatic.com, which this page needs. Then reload.</p><div class="btn-row"><button class="btn btn-secondary" type="button">Reload the page</button></div></div>';
      el.querySelector('button').addEventListener('click', () => location.reload());
    });
  };
  document.querySelectorAll('script[type="module"][src]').forEach((s) => s.addEventListener('error', failed, { once: true }));
}

function renderAuth(header, slot, session, fb) {
  const { user, isLead } = session;
  header.classList.toggle('is-signed-in', Boolean(user));
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
        <a href="/library?mine=1">My library links</a>
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
          <div class="footer-top">
            <a class="brand" href="/" aria-label="Claude@Stanford home">${brand()}</a>
            <ul class="footer-links" data-footer-links>
              ${NAV.map((item) => html`<li><a href="${item.href}">${item.label}</a></li>`)}
              <li><a href="/archive">Archive</a></li>
            </ul>
          </div>
          <div class="footer-bottom">
            <span class="powered-by">Supported by <img src="/assets/img/anthropic-wordmark.png" alt="Anthropic" width="89" height="10"></span>
            <span>Claude@Stanford <span data-footer-year>${yearLabel(DEFAULT_YEAR)}</span> · Original site by <a href="https://www.linkedin.com/in/arinzeobiezue/" target="_blank" rel="noopener">Arinze Obiezue</a></span>
          </div>
        </div>
      </footer>`);
    getConfig().then((config) => {
      this.querySelector('[data-footer-year]').textContent = yearLabel(config.academicYear);
      if (config.contactEmail) {
        const li = document.createElement('li');
        li.innerHTML = String(html`<a href="mailto:${config.contactEmail}">Contact</a>`);
        this.querySelector('[data-footer-links]').append(li);
      }
    });
  }
}

customElements.define('site-header', SiteHeader);
customElements.define('site-footer', SiteFooter);
