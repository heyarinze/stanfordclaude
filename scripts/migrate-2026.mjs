#!/usr/bin/env node
// One-time migration from the 2025-26 schema to the 2026-27 schema.
//
//   projects/{id} -> builds/{id}      (same IDs, so old share links keep working)
//   library/{id}  -> resources/{id}
//   submittedBy   -> users/{uid}       (private; never copied into public docs)
//
// It never changes or deletes the old collections, and skips docs that already exist in the
// new ones (re-run it right before launch to pick up anything posted on the old site meanwhile).
//
// Usage (from this folder):
//   npm install
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/OUTSIDE/the/repo/service-account.json
//   node migrate-2026.mjs --dry-run      # prints what would happen, writes nothing
//   node migrate-2026.mjs                # writes
//
// Flags:
//   --dry-run               write nothing
//   --overwrite             replace docs that already exist in builds/resources
//   --drop-contact-emails   don't carry the old public "email" field over to contactEmail

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const OVERWRITE = args.has('--overwrite');
const DROP_CONTACT = args.has('--drop-contact-emails');
const YEAR = '2025-26';
const PROJECT_ID = 'claude-at-stanford';

// Mirrors assets/js/taxonomy.js. Anything else in "tools" moves to otherTools.
const CLAUDE_PRODUCTS = ['Claude', 'Claude Code', 'Claude Cowork', 'Claude Skills', 'Claude API', 'Claude Agent SDK', 'MCP'];
const RENAMES = { 'Claude Chat': 'Claude' };

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
if (!EMULATOR && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a service-account key stored OUTSIDE this repo.');
  process.exit(1);
}

initializeApp(EMULATOR ? { projectId: PROJECT_ID } : { credential: applicationDefault(), projectId: PROJECT_ID });
console.log(EMULATOR ? `Target: local emulator at ${EMULATOR}` : `Target: LIVE project ${PROJECT_ID}`);
const db = getFirestore();

const text = (v, max) => (typeof v === 'string' ? v.trim() : '').slice(0, max);
const uniq = (a) => [...new Set(a)];
const list = (v) => {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean);
  return [];
};
const httpUrl = (v) => (typeof v === 'string' && /^https?:\/\/\S+$/.test(v.trim()) ? v.trim().slice(0, 500) : '');
const email = (v) => (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? v.trim().toLowerCase().slice(0, 120) : '');

function splitTools(d) {
  const all = list(d.tools).map((t) => RENAMES[t] || t);
  return {
    tools: uniq(all.filter((t) => CLAUDE_PRODUCTS.includes(t))).slice(0, 10),
    otherTools: uniq([...all.filter((t) => !CLAUDE_PRODUCTS.includes(t)), ...list(d.otherTools)]).map((t) => t.slice(0, 80)).slice(0, 10),
  };
}

const created = (d, snap) => (d.createdAt instanceof Timestamp ? d.createdAt : snap.createTime);

function mapBuild(snap) {
  const d = snap.data();
  const warnings = [];
  const link = httpUrl(d.link);
  if (!link) warnings.push(`link "${d.link}" isn't http(s); left blank (owner must add one to edit)`);
  if (!d.submittedByUid) warnings.push('no owner uid; nobody can edit it (leads can still moderate)');
  const { tools, otherTools } = splitTools(d);
  return {
    warnings,
    data: {
      title: text(d.name, 80) || 'Untitled build',
      link,
      desc: text(d.desc, 600),
      tools,
      otherTools,
      categories: uniq(list(d.categories)).slice(0, 6),
      howBuilt: text(d.howBuilt, 6000),
      authorName: text(d.author, 80),
      linkedin: httpUrl(d.linkedin),
      contactEmail: DROP_CONTACT ? '' : email(d.email),
      ownerUid: d.submittedByUid || '',
      year: YEAR,
      status: 'published',
      featured: false,
      hearts: uniq(list(d.hearts)).filter((uid) => uid !== d.submittedByUid),
      createdAt: created(d, snap),
      updatedAt: FieldValue.serverTimestamp(),
      migratedFrom: `projects/${snap.id}`,
    },
  };
}

function mapResource(snap) {
  const d = snap.data();
  const warnings = [];
  const url = httpUrl(d.url);
  if (!url) warnings.push(`url "${d.url}" isn't http(s); left blank`);
  if (d.fileData || d.file) warnings.push('had an uploaded file; files are no longer supported and were not copied');
  return {
    warnings,
    data: {
      title: text(d.title, 80) || 'Untitled resource',
      url,
      why: text(d.why, 1000),
      tools: splitTools(d).tools,
      categories: uniq(list(d.categories)).slice(0, 6),
      authorName: text(d.author, 80),
      ownerUid: d.submittedByUid || '',
      year: YEAR,
      status: 'published',
      featured: false,
      createdAt: created(d, snap),
      updatedAt: FieldValue.serverTimestamp(),
      migratedFrom: `library/${snap.id}`,
    },
  };
}

async function migrate(from, to, mapper, users) {
  const [source, existing] = await Promise.all([db.collection(from).get(), db.collection(to).get()]);
  const have = new Set(existing.docs.map((d) => d.id));
  const writes = [];
  console.log(`\n${from} -> ${to}: ${source.size} source docs, ${have.size} already in ${to}`);
  for (const snap of source.docs) {
    const d = snap.data();
    if (d.submittedByUid && d.submittedBy) {
      const prev = users.get(d.submittedByUid);
      const at = created(d, snap);
      if (!prev || at.toMillis() < prev.createdAt.toMillis()) {
        users.set(d.submittedByUid, { email: email(d.submittedBy), name: text(d.author, 80), createdAt: at });
      }
    }
    const skip = have.has(snap.id) && !OVERWRITE;
    const { data, warnings } = mapper(snap);
    console.log(`  ${skip ? 'skip ' : 'write'} ${snap.id}  ${data.title}${data.hearts ? `  (${data.hearts.length} hearts)` : ''}`);
    warnings.forEach((w) => console.log(`        ! ${w}`));
    if (!skip) writes.push([db.collection(to).doc(snap.id), data]);
  }
  return writes;
}

async function commit(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach(([ref, data, opts]) => batch.set(ref, data, opts || {}));
    await batch.commit();
  }
}

const users = new Map();
const buildWrites = await migrate('projects', 'builds', mapBuild, users);
const resourceWrites = await migrate('library', 'resources', mapResource, users);
const existingUsers = new Set((await db.collection('users').get()).docs.map((d) => d.id));
const userWrites = [...users.entries()]
  .filter(([uid, u]) => u.email && (OVERWRITE || !existingUsers.has(uid)))
  .map(([uid, u]) => [db.collection('users').doc(uid), { ...u, updatedAt: FieldValue.serverTimestamp() }, { merge: true }]);

console.log(`\nusers: ${userWrites.length} private profiles (emails not printed)`);
console.log(`contact emails: ${DROP_CONTACT ? 'dropped' : 'carried over from the old public "email" field'}`);
console.log(`\nTotal writes: ${buildWrites.length} builds, ${resourceWrites.length} resources, ${userWrites.length} users`);

if (DRY) {
  console.log('\nDry run: nothing written. Re-run without --dry-run to apply.');
} else {
  await commit([...buildWrites, ...resourceWrites, ...userWrites]);
  console.log('\nDone. Old projects/library collections were not modified.');
}
