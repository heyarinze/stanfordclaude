// Lead moderation. Access is enforced by Firestore rules (leads/{email}); this page only hides UI.

import { html, icons, toast, confirmDialog, formatDate, toMillis, debounce } from './ui.js';
import { yearLabel } from './config.js';
import * as fb from './firebase.js';
import { fetchAll, moderate, removeItem, ensureSignedIn } from './collection.js';

const root = document.querySelector('[data-admin]');
const KINDS = {
  builds: { label: 'Builds', collection: 'builds', path: '/builds', param: 'b', hearts: true },
  resources: { label: 'Library', collection: 'resources', path: '/library', param: 'r', hearts: false },
};
const state = { kind: 'builds', q: '', status: 'all' };
const data = { builds: [], resources: [] };
let session = fb.getSession();

function gate(message, action) {
  root.innerHTML = String(html`<div class="empty"><h3>${message}</h3>${action || ''}</div>`);
}

function rows() {
  const q = state.q.toLowerCase();
  return data[state.kind]
    .filter((i) => state.status === 'all'
      || (state.status === 'featured' ? i.featured : i.status === state.status))
    .filter((i) => !q || `${i.title} ${i.authorName}`.toLowerCase().includes(q))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

function renderTable() {
  const k = KINDS[state.kind];
  const list = rows();
  const table = root.querySelector('[data-table]');
  root.querySelector('[data-count]').textContent = `${list.length} of ${data[state.kind].length}`;
  root.querySelectorAll('[data-kind]').forEach((t) => { t.textContent = `${KINDS[t.dataset.kind].label} (${data[t.dataset.kind].length})`; });
  if (!list.length) { table.innerHTML = '<div class="empty">Nothing matches.</div>'; return; }
  table.innerHTML = String(html`
    <div class="table-wrap">
      <table>
        <thead><tr><th scope="col">Title</th><th scope="col">Year</th><th scope="col">Shared</th>${k.hearts ? html`<th scope="col">Hearts</th>` : ''}<th scope="col">Status</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
        <tbody>
          ${list.map((i) => html`
            <tr>
              <td class="title-cell"><a href="${k.path}?${k.param}=${encodeURIComponent(i.id)}">${i.title}</a><small>${i.authorName || 'Unknown'}</small></td>
              <td>${yearLabel(i.year)}</td>
              <td>${formatDate(i.createdAt)}</td>
              ${k.hearts ? html`<td>${(i.hearts || []).length}</td>` : ''}
              <td><div class="badge-row">
                ${i.status === 'hidden' ? html`<span class="tag tag-warn">Hidden</span>` : html`<span class="tag tag-success">Published</span>`}
                ${i.featured ? html`<span class="tag tag-accent">Featured</span>` : ''}
              </div></td>
              <td><div class="btn-row">
                <button type="button" class="btn btn-secondary btn-sm" data-act="feature" data-id="${i.id}">${i.featured ? 'Unfeature' : 'Feature'}</button>
                <button type="button" class="btn btn-secondary btn-sm" data-act="hide" data-id="${i.id}">${i.status === 'hidden' ? 'Unhide' : 'Hide'}</button>
                <button type="button" class="btn btn-ghost btn-sm" data-act="contact" data-id="${i.id}" title="Email the person who posted this">${icons.mail}<span class="visually-hidden">Email poster</span></button>
                <button type="button" class="btn btn-danger btn-sm" data-act="delete" data-id="${i.id}">Delete</button>
              </div></td>
            </tr>`)}
        </tbody>
      </table>
    </div>`);
}

function renderShell(leads) {
  root.innerHTML = String(html`
    <div class="tabs" role="tablist" aria-label="Collection">
      ${Object.entries(KINDS).map(([key, k]) => html`<button type="button" role="tab" data-kind="${key}" aria-selected="${key === state.kind ? 'true' : 'false'}">${k.label} (${data[key].length})</button>`)}
    </div>
    <div class="toolbar">
      <label class="search"><span class="visually-hidden">Search</span>${icons.search}<input type="search" name="q" placeholder="Search title or author" autocomplete="off"></label>
      <select name="status" aria-label="Filter by status">
        <option value="all">All</option><option value="published">Published</option><option value="hidden">Hidden</option><option value="featured">Featured</option>
      </select>
      <button type="button" class="btn btn-secondary btn-sm" data-act="export">Export JSON</button>
      <span class="result-count" data-count></span>
    </div>
    <div data-table></div>
    <section class="section">
      <h2 style="font-size:var(--text-xl); margin-bottom:var(--space-3)">Leads</h2>
      <p class="muted small" style="margin-bottom:var(--space-4)">To add a lead, create a document in the Firestore <code>leads</code> collection whose ID is their lowercase @stanford.edu email (Firebase console). See the README.</p>
      <div class="badge-row">${leads.map((l) => html`<span class="tag">${l}</span>`)}</div>
    </section>`);
  const q = root.querySelector('[name="q"]');
  q.value = state.q;
  q.addEventListener('input', debounce(() => { state.q = q.value.trim(); renderTable(); }, 120));
  const status = root.querySelector('[name="status"]');
  status.value = state.status;
  status.addEventListener('change', () => { state.status = status.value; renderTable(); });
  renderTable();
}

root.addEventListener('click', async (event) => {
  const tab = event.target.closest('[data-kind]');
  if (tab) {
    state.kind = tab.dataset.kind;
    root.querySelectorAll('[data-kind]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    renderTable();
    return;
  }
  const el = event.target.closest('[data-act]');
  if (!el) return;
  const k = KINDS[state.kind];
  const item = data[state.kind].find((i) => i.id === el.dataset.id);
  const { act } = el.dataset;
  try {
    if (act === 'export') {
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `claudeatstanford-${new Date().toISOString().slice(0, 10)}.json` });
      a.click();
      URL.revokeObjectURL(a.href);
    } else if (act === 'feature' || act === 'hide') {
      const patch = act === 'feature' ? { featured: !item.featured } : { status: item.status === 'hidden' ? 'published' : 'hidden' };
      await moderate(k.collection, item.id, patch, session.user);
      Object.assign(item, patch);
      renderTable();
    } else if (act === 'contact') {
      const snap = await fb.getDoc(fb.doc(fb.db, fb.COLLECTIONS.users, item.ownerUid || '_'));
      const email = snap.exists() ? snap.data().email : '';
      if (email) location.href = `mailto:${email}?subject=${encodeURIComponent(`Your Claude@Stanford post: ${item.title}`)}`;
      else toast('No email on file for this poster.', { error: true });
    } else if (act === 'delete') {
      const ok = await confirmDialog(`"${item.title}" will be removed for everyone. Consider hiding it instead. This can't be undone.`, { title: 'Delete permanently?', confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      await removeItem(k.collection, item.id);
      data[state.kind] = data[state.kind].filter((i) => i.id !== item.id);
      renderTable();
      toast('Deleted');
    }
  } catch (err) {
    console.error(err);
    toast('That didn\'t work. Check your connection and that you\'re listed as a lead.', { error: true });
  }
});

async function boot(next) {
  session = next;
  if (!session.user) {
    gate('Sign in to moderate', html`<div class="btn-row"><button class="btn btn-primary" type="button" data-signin>Sign in with Stanford</button></div>`);
    root.querySelector('[data-signin]').addEventListener('click', () => ensureSignedIn('to moderate'));
    return;
  }
  if (!session.isLead) {
    gate('Leads only', html`<p>You're signed in as ${session.user.email}, which isn't on the leads list. Ask an existing lead to add you.</p>`);
    return;
  }
  try {
    const [builds, resources, leadsSnap] = await Promise.all([
      fetchAll('builds'), fetchAll('resources'), fb.getDocs(fb.collection(fb.db, fb.COLLECTIONS.leads)),
    ]);
    Object.assign(data, { builds, resources });
    renderShell(leadsSnap.docs.map((d) => d.id).sort());
  } catch (err) {
    console.error(err);
    gate('Couldn\'t load moderation data', html`<p>Refresh to try again.</p>`);
  }
}

fb.onSession(boot);
