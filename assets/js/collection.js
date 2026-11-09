// Shared gallery engine for Builds and Library: loading, search/filter/sort with URL state,
// cards, detail dialog, submit/edit form, hearts, sharing and owner/lead actions.
// builds.js and library.js supply a config object; see mountGallery() below.

import {
  html, raw, icons, toast, wireDialog, confirmDialog, shareLink, safeUrl, toMillis, debounce,
} from './ui.js';
import * as fb from './firebase.js';
import { getConfig, yearLabel } from './config.js';

/* ---------- Data access ---------- */

const withId = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/* Session cache of public lists, so moving between pages renders instantly and refreshes behind
   the scenes (stale-while-revalidate). Per tab, short-lived, and purely a speed-up. */
const CACHE_TTL = 10 * 60 * 1000;
const cacheKey = (name) => `published:${name}`;
const toPlain = (item) => {
  const out = { ...item };
  ['createdAt', 'updatedAt', 'moderatedAt'].forEach((k) => { if (out[k]) out[k] = toMillis(out[k]); });
  return out;
};

export function peekPublished(collectionName) {
  try {
    const raw = sessionStorage.getItem(cacheKey(collectionName));
    if (!raw) return null;
    const { t, items } = JSON.parse(raw);
    return Date.now() - t < CACHE_TTL ? items : null;
  } catch {
    return null;
  }
}

export function storePublished(collectionName, items) {
  try {
    sessionStorage.setItem(cacheKey(collectionName), JSON.stringify({ t: Date.now(), items: items.map(toPlain) }));
  } catch { /* storage full or blocked: skip caching */ }
}

export async function fetchPublished(collectionName) {
  const q = fb.query(fb.collection(fb.db, collectionName), fb.where('status', '==', 'published'));
  const items = withId(await fb.getDocs(q));
  storePublished(collectionName, items);
  return items;
}

export async function fetchOwn(collectionName, uid) {
  const q = fb.query(fb.collection(fb.db, collectionName), fb.where('ownerUid', '==', uid));
  return withId(await fb.getDocs(q));
}

export async function fetchAll(collectionName) {
  return withId(await fb.getDocs(fb.collection(fb.db, collectionName)));
}

/** Lead-only: change status/featured. Rules allow leads to touch only these fields. */
export async function moderate(collectionName, id, patch, user) {
  await fb.updateDoc(fb.doc(fb.db, collectionName, id), {
    ...patch,
    moderatedBy: user.email.toLowerCase(),
    moderatedAt: fb.serverTimestamp(),
  });
}

export async function removeItem(collectionName, id) {
  await fb.deleteDoc(fb.doc(fb.db, collectionName, id));
}

export const byNewest = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);

/* ---------- Sign-in gate ---------- */

let signinDialog;
export async function ensureSignedIn(reason = 'to continue') {
  await fb.whenAuthReady();
  const { user } = fb.getSession();
  if (user) return user;
  if (!signinDialog) {
    signinDialog = document.createElement('dialog');
    signinDialog.className = 'dialog-sm';
    signinDialog.setAttribute('aria-labelledby', 'signin-title');
    document.body.append(signinDialog);
    wireDialog(signinDialog);
  }
  signinDialog.innerHTML = String(html`
    <div class="dialog-head">
      <h2 id="signin-title">Stanford sign-in</h2>
      <button type="button" class="dialog-close" data-close aria-label="Close">${icons.close}</button>
    </div>
    <div class="dialog-body">
      <p class="muted">Sign in with your <strong>@stanford.edu</strong> Google account ${reason}. Browsing is open to everyone.</p>
    </div>
    <div class="dialog-foot">
      <button type="button" class="btn btn-secondary" data-close>Not now</button>
      <button type="button" class="btn btn-primary" data-go>Sign in with Google</button>
    </div>`);
  return new Promise((resolve) => {
    let result = null;
    signinDialog.querySelector('[data-go]').addEventListener('click', async () => {
      result = await fb.signIn();
      signinDialog.close();
    });
    signinDialog.addEventListener('close', () => resolve(result), { once: true });
    signinDialog.showModal();
  });
}

/* ---------- Form schema helpers ----------
   Field kinds: text | url | email | textarea | checks (array from options) | list (comma-separated). */

function fieldMarkup(f) {
  const id = `f-${f.name}`;
  const opt = f.required ? '' : html` <span class="opt">(optional)</span>`;
  const hint = f.hint ? html`<span class="hint" id="${id}-hint">${f.hint}</span>` : '';
  const describedBy = f.hint ? html`aria-describedby="${id}-hint"` : '';
  if (f.kind === 'checks') {
    return html`
      <fieldset data-field="${f.name}">
        <legend>${f.label}${opt}</legend>
        <div class="check-grid">
          ${f.options.map((o) => html`<label class="check-chip"><input type="checkbox" name="${f.name}" value="${o}"><span>${o}</span></label>`)}
        </div>
        ${hint}
      </fieldset>`;
  }
  const common = html`id="${id}" name="${f.name}" ${f.max ? html`maxlength="${f.max}"` : ''} ${f.required ? 'required' : ''} placeholder="${f.placeholder || ''}" ${describedBy}`;
  const input = f.kind === 'textarea'
    ? html`<textarea ${common} rows="${f.rows || 4}"></textarea>`
    : html`<input type="${f.kind === 'list' ? 'text' : f.kind}" ${common} ${f.kind === 'email' ? 'autocomplete="email"' : ''}>`;
  const counter = f.kind === 'textarea' && f.max ? html`<span class="counter" data-counter-for="${f.name}">0 / ${f.max}</span>` : '';
  return html`<div class="field" data-field="${f.name}"><label for="${id}">${f.label}${opt}</label>${input}${hint}${counter}</div>`;
}

function readForm(form, schema) {
  const data = {};
  for (const f of schema) {
    if (f.kind === 'checks') {
      const values = [...form.querySelectorAll(`input[name="${f.name}"]:checked`)].map((el) => el.value);
      if (f.maxItems && values.length > f.maxItems) return { error: `Pick at most ${f.maxItems} for "${f.label}".`, field: f.name };
      data[f.name] = values;
      continue;
    }
    const raw = form.elements[f.name].value.trim();
    if (f.kind === 'list') {
      const values = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
      if (f.maxItems && values.length > f.maxItems) return { error: `List at most ${f.maxItems} other tools.`, field: f.name };
      if (f.maxEach && values.some((v) => v.length > f.maxEach)) return { error: `Each tool name must be under ${f.maxEach} characters.`, field: f.name };
      data[f.name] = values;
      continue;
    }
    if (f.required && !raw) return { error: `"${f.label}" is required.`, field: f.name };
    if (f.max && raw.length > f.max) return { error: `"${f.label}" must be ${f.max} characters or fewer.`, field: f.name };
    if (raw && f.kind === 'url' && !safeUrl(raw)) return { error: `"${f.label}" must be a full link starting with https://`, field: f.name };
    if (raw && f.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return { error: `"${f.label}" doesn't look like an email address.`, field: f.name };
    data[f.name] = f.kind === 'url' && raw ? safeUrl(raw) : raw;
  }
  return { data };
}

function fillForm(form, schema, item, prefill) {
  form.reset();
  for (const f of schema) {
    const value = item ? item[f.name] : prefill[f.name];
    if (f.kind === 'checks') {
      const set = new Set(value || []);
      form.querySelectorAll(`input[name="${f.name}"]`).forEach((el) => { el.checked = set.has(el.value); });
    } else if (f.kind === 'list') {
      form.elements[f.name].value = (value || []).join(', ');
    } else {
      form.elements[f.name].value = value || '';
    }
    form.elements[f.name]?.removeAttribute?.('aria-invalid');
  }
  form.querySelectorAll('[data-counter-for]').forEach((c) => updateCounter(form, c));
}

function updateCounter(form, counter) {
  const el = form.elements[counter.dataset.counterFor];
  const max = Number(el.getAttribute('maxlength'));
  counter.textContent = `${el.value.length} / ${max}`;
  counter.classList.toggle('over', el.value.length >= max);
}

/* ---------- Gallery ---------- */

/**
 * cfg = {
 *   collection, param, noun, nounPlural, path, hasHearts,
 *   categories, products,
 *   sorts: { key: { label, fn } }, defaultSort,
 *   searchText(item) -> string,
 *   card(item, ctx) -> Raw, detail(item, ctx) -> Raw,
 *   schema: [...fields], titleNew, titleEdit, submitLabel,
 *   createExtras() -> object of extra fields on create,
 *   prefill(user) -> object,
 * }
 */
export async function mountGallery(cfg) {
  const root = document.querySelector('[data-gallery]');
  const config = await getConfig();
  const params = new URLSearchParams(location.search);
  const state = {
    q: params.get('q') || '',
    tool: params.get('tool') || '',
    cat: params.get('cat') || '',
    year: params.get('year') || '',
    sort: cfg.sorts[params.get('sort')] ? params.get('sort') : cfg.defaultSort,
    mine: params.get('mine') === '1',
  };
  let items = [];
  let loaded = false;
  let loadError = null;
  let session = fb.getSession();
  let editingId = null;

  /* Toolbar */
  root.innerHTML = String(html`
    <div class="toolbar-wrap">
      <div class="toolbar" role="search">
        <label class="search">
          <span class="visually-hidden">Search ${cfg.nounPlural}</span>
          ${icons.search}
          <input type="search" name="q" placeholder="Search ${cfg.nounPlural}, people, tools…" autocomplete="off">
        </label>
        <select name="tool" aria-label="Filter by Claude product"><option value="">All products</option></select>
        <select name="year" aria-label="Filter by academic year"><option value="">All years</option></select>
        <select name="sort" aria-label="Sort">
          ${Object.entries(cfg.sorts).map(([key, s]) => html`<option value="${key}">${s.label}</option>`)}
        </select>
        <span class="result-count" data-count aria-live="polite"></span>
      </div>
      <div class="chips" role="group" aria-label="Filter by category" data-chips></div>
    </div>
    <div class="notice notice-info" data-mine hidden style="margin-bottom:var(--space-5)">
      ${icons.info}<span>Showing only your ${cfg.nounPlural}. <a href="${cfg.path}">Show everyone's</a></span>
    </div>
    <div class="grid" data-grid aria-busy="true">
      ${[1, 2, 3, 4, 5, 6].map(() => raw('<div class="skeleton"></div>'))}
    </div>`);

  const toolbar = root.querySelector('.toolbar');
  const chips = root.querySelector('[data-chips]');
  const grid = root.querySelector('[data-grid]');
  const countEl = root.querySelector('[data-count]');
  toolbar.elements = {
    q: toolbar.querySelector('[name="q"]'),
    tool: toolbar.querySelector('[name="tool"]'),
    year: toolbar.querySelector('[name="year"]'),
    sort: toolbar.querySelector('[name="sort"]'),
  };
  toolbar.elements.q.value = state.q;
  toolbar.elements.sort.value = state.sort;

  function fillSelect(select, values, current, label = (v) => v) {
    const keep = select.options[0].outerHTML;
    select.innerHTML = keep + values.map((v) => String(html`<option value="${v}">${label(v)}</option>`)).join('');
    select.value = values.includes(current) ? current : '';
  }

  function refreshFilterOptions() {
    const uniq = (list) => [...new Set(list.filter(Boolean))];
    const tools = uniq([...cfg.products, ...items.flatMap((i) => i.tools || [])]);
    const cats = uniq([...cfg.categories, ...items.flatMap((i) => i.categories || [])]);
    const years = uniq([config.academicYear, ...items.map((i) => i.year)]).sort().reverse();
    fillSelect(toolbar.elements.tool, tools, state.tool);
    fillSelect(toolbar.elements.year, years, state.year, yearLabel);
    if (state.cat && !cats.includes(state.cat)) state.cat = '';
    chips.innerHTML = String(html`${['', ...cats].map((c) => html`<button type="button" class="chip" data-chip="${c}" aria-pressed="${state.cat === c ? 'true' : 'false'}">${c || 'All'}</button>`)}`);
  }

  function syncUrl() {
    const p = new URLSearchParams(location.search);
    for (const key of ['q', 'tool', 'cat', 'year']) { if (state[key]) p.set(key, state[key]); else p.delete(key); }
    if (state.sort !== cfg.defaultSort) p.set('sort', state.sort); else p.delete('sort');
    if (state.mine) p.set('mine', '1'); else p.delete('mine');
    const qs = p.toString();
    history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}`);
  }

  const onFilter = () => {
    state.q = toolbar.elements.q.value.trim();
    state.tool = toolbar.elements.tool.value;
    state.year = toolbar.elements.year.value;
    state.sort = toolbar.elements.sort.value;
    syncUrl();
    render();
  };
  toolbar.elements.q.addEventListener('input', debounce(onFilter, 120));
  ['tool', 'year', 'sort'].forEach((k) => toolbar.elements[k].addEventListener('change', onFilter));
  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-chip]');
    if (!chip) return;
    state.cat = chip.dataset.chip;
    chips.querySelectorAll('[data-chip]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    syncUrl();
    render();
  });

  /* Context for templates */
  function ctxFor(item) {
    const uid = session.user?.uid;
    const isOwner = Boolean(uid && item.ownerUid === uid);
    const hearts = item.hearts || [];
    return {
      session,
      isOwner,
      isLead: session.isLead,
      hearted: Boolean(uid && hearts.includes(uid)),
      heartCount: hearts.length,
      canHeart: !isOwner,
    };
  }

  function visibleItems() {
    const q = state.q.toLowerCase();
    const uid = session.user?.uid;
    return items
      .filter((i) => i.status === 'published' || (uid && i.ownerUid === uid) || session.isLead)
      .filter((i) => !state.mine || (uid && i.ownerUid === uid))
      .filter((i) => !state.tool || (i.tools || []).includes(state.tool))
      .filter((i) => !state.cat || (i.categories || []).includes(state.cat))
      .filter((i) => !state.year || i.year === state.year)
      .filter((i) => !q || cfg.searchText(i).toLowerCase().includes(q))
      .sort(cfg.sorts[state.sort].fn);
  }

  function render() {
    root.querySelector('[data-mine]').hidden = !state.mine;
    if (!loaded) return;
    grid.setAttribute('aria-busy', 'false');
    if (loadError) {
      countEl.textContent = '';
      grid.innerHTML = String(html`<div class="empty"><h3>Couldn't load ${cfg.nounPlural}</h3><p>Check your connection and try again.</p><div class="btn-row"><button class="btn btn-secondary" type="button" data-action="reload">Try again</button></div></div>`);
      return;
    }
    if (state.mine && !session.user) {
      countEl.textContent = '';
      grid.innerHTML = String(html`<div class="empty"><h3>Sign in to see your ${cfg.nounPlural}</h3><div class="btn-row"><button class="btn btn-primary" type="button" data-action="signin">Sign in with Stanford</button></div></div>`);
      return;
    }
    const list = visibleItems();
    countEl.textContent = `${list.length} ${list.length === 1 ? cfg.noun : cfg.nounPlural}`;
    if (!list.length) {
      const filtered = state.q || state.tool || state.cat || state.year || state.mine;
      grid.innerHTML = String(filtered
        ? html`<div class="empty"><h3>No ${cfg.nounPlural} match</h3><p>Try a different search or clear the filters.</p><div class="btn-row"><button class="btn btn-secondary" type="button" data-action="clear">Clear filters</button></div></div>`
        : html`<div class="empty"><h3>No ${cfg.nounPlural} yet</h3><div class="btn-row"><button class="btn btn-primary" type="button" data-action="submit">${icons.plus} ${cfg.submitLabel}</button></div></div>`);
      return;
    }
    grid.innerHTML = list.map((item) => String(cfg.card(item, ctxFor(item)))).join('');
  }

  async function load() {
    loadError = null;
    try {
      const published = await fetchPublished(cfg.collection);
      const byId = new Map(published.map((i) => [i.id, i]));
      const uid = session.user?.uid;
      if (session.isLead) {
        (await fetchAll(cfg.collection)).forEach((i) => byId.set(i.id, i));
      } else if (uid) {
        (await fetchOwn(cfg.collection, uid)).forEach((i) => byId.set(i.id, i));
      }
      items = [...byId.values()];
    } catch (err) {
      console.error(err);
      loadError = err;
    }
    loaded = true;
    refreshFilterOptions();
    render();
  }

  /* Detail dialog */
  const detail = document.createElement('dialog');
  detail.setAttribute('aria-labelledby', 'detail-title');
  detail.innerHTML = String(html`
    <button type="button" class="dialog-close dialog-x" data-close aria-label="Close">${icons.close}</button>
    <div class="dialog-cover" data-cover hidden></div>
    <div class="dialog-head"><h2 id="detail-title"></h2></div>
    <div class="dialog-body" data-body></div>
    <div class="dialog-foot" data-foot hidden></div>`);
  document.body.append(detail);
  let detailId = null;
  wireDialog(detail, {
    onClose: () => {
      detailId = null;
      const p = new URLSearchParams(location.search);
      if (p.has(cfg.param)) { p.delete(cfg.param); const qs = p.toString(); history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}`); }
    },
  });

  function renderDetail(item) {
    const ctx = ctxFor(item);
    const coverEl = detail.querySelector('[data-cover]');
    const cover = cfg.detailCover ? cfg.detailCover(item) : null;
    coverEl.hidden = !cover;
    if (cover) coverEl.innerHTML = String(cover);
    detail.querySelector('#detail-title').textContent = item.title;
    detail.querySelector('[data-body]').innerHTML = String(cfg.detail(item, ctx));
    const foot = detail.querySelector('[data-foot]');
    const actions = [];
    if (ctx.isOwner) actions.push(html`<button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${item.id}">Edit</button>`);
    if (ctx.isLead) {
      actions.push(html`<button type="button" class="btn btn-secondary btn-sm" data-action="feature" data-id="${item.id}">${item.featured ? 'Unfeature' : 'Feature'}</button>`);
      actions.push(html`<button type="button" class="btn btn-secondary btn-sm" data-action="hide" data-id="${item.id}">${item.status === 'hidden' ? 'Unhide' : 'Hide'}</button>`);
    }
    if (ctx.isOwner || ctx.isLead) actions.push(html`<button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${item.id}">Delete</button>`);
    foot.hidden = !actions.length;
    foot.innerHTML = String(html`${actions}`);
  }

  function openDetail(id, { updateUrl = true } = {}) {
    const item = items.find((i) => i.id === id);
    if (!item) return false;
    detailId = id;
    renderDetail(item);
    if (!detail.open) detail.showModal();
    if (updateUrl) {
      const p = new URLSearchParams(location.search);
      p.set(cfg.param, id);
      history.replaceState(null, '', `${location.pathname}?${p}`);
    }
    return true;
  }

  /* Submit / edit form */
  const formDialog = document.createElement('dialog');
  formDialog.setAttribute('aria-labelledby', 'form-title');
  formDialog.innerHTML = String(html`
    <form novalidate>
      <div class="dialog-head"><h2 id="form-title"></h2><button type="button" class="dialog-close" data-close aria-label="Close">${icons.close}</button></div>
      <div class="dialog-body">
        <div class="form-error" data-error role="alert" hidden></div>
        ${cfg.schema.map(fieldMarkup)}
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn btn-secondary" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary" data-submit></button>
      </div>
    </form>`);
  document.body.append(formDialog);
  wireDialog(formDialog);
  const form = formDialog.querySelector('form');
  const formError = formDialog.querySelector('[data-error]');
  form.addEventListener('input', (event) => {
    const counter = form.querySelector(`[data-counter-for="${event.target.name}"]`);
    if (counter) updateCounter(form, counter);
    event.target.removeAttribute('aria-invalid');
  });

  async function openForm(item = null) {
    const user = await ensureSignedIn(item ? 'to edit' : `to share a ${cfg.noun}`);
    if (!user) return;
    editingId = item ? item.id : null;
    formDialog.querySelector('#form-title').textContent = item ? cfg.titleEdit : cfg.titleNew;
    formDialog.querySelector('[data-submit]').textContent = item ? 'Save changes' : cfg.submitLabel;
    formError.hidden = true;
    fillForm(form, cfg.schema, item, cfg.prefill(user));
    if (detail.open) detail.close();
    formDialog.showModal();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { data, error, field } = readForm(form, cfg.schema);
    if (error) {
      formError.textContent = error;
      formError.hidden = false;
      const el = form.elements[field];
      if (el?.setAttribute) { el.setAttribute('aria-invalid', 'true'); el.focus(); } else form.querySelector(`[data-field="${field}"] input`)?.focus();
      return;
    }
    const button = formDialog.querySelector('[data-submit]');
    button.disabled = true;
    const user = fb.getSession().user;
    try {
      let id = editingId;
      if (editingId) {
        await fb.updateDoc(fb.doc(fb.db, cfg.collection, editingId), { ...data, updatedAt: fb.serverTimestamp() });
        toast('Saved');
      } else {
        await fb.saveUserProfile(user, data.authorName);
        const ref = await fb.addDoc(fb.collection(fb.db, cfg.collection), {
          ...data,
          ...cfg.createExtras(),
          ownerUid: user.uid,
          year: config.academicYear,
          status: 'published',
          featured: false,
          createdAt: fb.serverTimestamp(),
          updatedAt: fb.serverTimestamp(),
        });
        id = ref.id;
        toast('Posted');
      }
      formDialog.close();
      await load();
      openDetail(id);
    } catch (err) {
      console.error(err);
      formError.textContent = 'Couldn\'t save. Check the fields and try again. If it keeps failing, ping a lead in the Slack.';
      formError.hidden = false;
    } finally {
      button.disabled = false;
    }
  });

  /* Hearts */
  async function toggleHeart(item, button) {
    const user = await ensureSignedIn('to heart builds');
    if (!user) return;
    if (item.ownerUid === user.uid) { toast('You can\'t heart your own build.'); return; }
    const before = item.hearts || [];
    const had = before.includes(user.uid);
    item.hearts = had ? before.filter((u) => u !== user.uid) : [...before, user.uid];
    render();
    if (detailId === item.id) renderDetail(item);
    const selector = `[data-action="heart"][data-id="${CSS.escape(item.id)}"]`;
    const refocus = () => (button && detail.contains(button) ? detail : grid).querySelector(selector)?.focus();
    refocus();
    try {
      await fb.updateDoc(fb.doc(fb.db, cfg.collection, item.id), {
        hearts: had ? fb.arrayRemove(user.uid) : fb.arrayUnion(user.uid),
      });
      storePublished(cfg.collection, items.filter((i) => i.status === 'published'));
    } catch (err) {
      console.error(err);
      item.hearts = before;
      render();
      if (detailId === item.id) renderDetail(item);
      toast('Couldn\'t update your heart. Try again.', { error: true });
      refocus();
    }
  }

  /* Actions (event delegation) */
  document.addEventListener('click', async (event) => {
    const el = event.target.closest('[data-action]');
    if (!el || el.closest('[data-admin]')) return;
    const { action, id } = el.dataset;
    const item = id ? items.find((i) => i.id === id) : null;
    const user = fb.getSession().user;
    switch (action) {
      case 'open': openDetail(id); break;
      case 'submit': openForm(); break;
      case 'signin': ensureSignedIn(`to see your ${cfg.nounPlural}`); break;
      case 'reload': loaded = false; load(); break;
      case 'clear':
        Object.assign(state, { q: '', tool: '', cat: '', year: '', mine: false });
        toolbar.elements.q.value = '';
        refreshFilterOptions();
        syncUrl();
        render();
        break;
      case 'share': {
        const url = `${location.origin}${cfg.path}?${cfg.param}=${encodeURIComponent(id)}`;
        shareLink(url, item?.title || 'Claude@Stanford');
        break;
      }
      case 'heart': if (item) toggleHeart(item, el); break;
      case 'edit': if (item) openForm(item); break;
      case 'delete': {
        if (!item) break;
        const ok = await confirmDialog(`"${item.title}" will be removed for everyone. This can't be undone.`, { title: `Delete this ${cfg.noun}?`, confirmLabel: 'Delete', danger: true });
        if (!ok) break;
        try {
          await removeItem(cfg.collection, item.id);
          items = items.filter((i) => i.id !== item.id);
          if (detail.open) detail.close();
          render();
          toast('Deleted');
        } catch (err) { console.error(err); toast('Couldn\'t delete. Try again.', { error: true }); }
        break;
      }
      case 'feature':
      case 'hide': {
        if (!item || !session.isLead) break;
        const patch = action === 'feature'
          ? { featured: !item.featured }
          : { status: item.status === 'hidden' ? 'published' : 'hidden' };
        try {
          await moderate(cfg.collection, item.id, patch, user);
          Object.assign(item, patch);
          render();
          renderDetail(item);
          toast(action === 'feature' ? (item.featured ? 'Featured on the home page' : 'Unfeatured') : (item.status === 'hidden' ? 'Hidden from the public' : 'Visible again'));
        } catch (err) { console.error(err); toast('Moderation failed. Are you listed as a lead?', { error: true }); }
        break;
      }
      default: break;
    }
  });

  /* Boot: paint from the session cache right away, then refresh from Firestore. */
  render();
  const deepLink = params.get(cfg.param);
  let openedFromCache = false;
  const cached = peekPublished(cfg.collection);
  if (cached) {
    items = cached;
    loaded = true;
    refreshFilterOptions();
    render();
    if (deepLink) openedFromCache = openDetail(deepLink, { updateUrl: false });
  }
  await load();
  if (openedFromCache && detail.open) {
    const fresh = items.find((i) => i.id === detailId);
    if (fresh) renderDetail(fresh);
  }

  if (deepLink && !openedFromCache && !openDetail(deepLink, { updateUrl: false })) {
    // Might be the signed-in owner's hidden item; retry once auth is known.
    await fb.whenAuthReady();
    session = fb.getSession();
    if (session.user) await load();
    if (!openDetail(deepLink, { updateUrl: false })) toast(`That ${cfg.noun} isn't available anymore.`);
  }
  if (params.get('submit') === '1') {
    const p = new URLSearchParams(location.search); p.delete('submit');
    history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}`);
    openForm();
  }

  let firstSession = true;
  fb.onSession((next) => {
    const changed = next.user?.uid !== session.user?.uid || next.isLead !== session.isLead;
    session = next;
    if (firstSession) { firstSession = false; if (!next.user) { render(); return; } }
    if (changed || next.user) load().then(() => { if (detailId) { const it = items.find((i) => i.id === detailId); if (it) renderDetail(it); } });
  });
}

/* ---------- Shared bits for card templates ---------- */

export function heartButton(item, ctx) {
  const label = ctx.isOwner ? 'Your build' : (ctx.hearted ? 'Remove heart' : 'Heart this build');
  return html`<button type="button" class="heart-btn" data-action="heart" data-id="${item.id}" aria-pressed="${ctx.hearted ? 'true' : 'false'}" ${ctx.canHeart ? '' : 'disabled'} title="${label}" aria-label="${label}, ${ctx.heartCount} ${ctx.heartCount === 1 ? 'heart' : 'hearts'}">${icons.heart}<span>${ctx.heartCount}</span></button>`;
}

export function shareButton(item, noun = 'link') {
  return html`<button type="button" class="icon-btn" data-action="share" data-id="${item.id}" title="Share ${noun}" aria-label="Share ${noun}">${icons.share}</button>`;
}

export function statusTags(item, { year = true } = {}) {
  return html`${item.featured ? html`<span class="tag tag-accent">Featured</span>` : ''}${item.status === 'hidden' ? html`<span class="tag tag-warn">Hidden</span>` : ''}${year && item.year ? html`<span class="tag">${yearLabel(item.year)}</span>` : ''}`;
}
