#!/usr/bin/env node
// One-time migration of the 2025-26 data into the 2026-27 Firebase project.
//
// Source: the old project "claude-at-stanford" (owned by Arinze). Its old rules make the
//         projects/library collections publicly readable, so this reads them over the public
//         REST API. Nothing in the old project is changed.
// Target: the new project (default: the one in ../.firebaserc), written with the Admin SDK.
//
//   projects/{id} -> builds/{id}      same IDs, so old share links keep working
//   library/{id}  -> resources/{id}
//   submittedBy   -> claims/{email}   private list of that person's posts
//
// Sign-in IDs differ between Firebase projects, so migrated posts arrive with ownerUid ''.
// The site links them to the right person on their first sign-in, using claims/{email}
// (see claimLegacyPosts in assets/js/firebase.js), then deletes that claims doc.
//
// Safe to re-run: posts already in the target are skipped unless --overwrite.
//
// Usage (from this folder):
//   npm install
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/OUTSIDE/the/repo/new-project-key.json
//   node migrate-2026.mjs --dry-run      # prints what would happen, writes nothing
//   node migrate-2026.mjs                # writes
//
// Flags:
//   --dry-run               write nothing
//   --overwrite             replace posts that already exist in the target
//   --drop-contact-emails   don't carry the old public "email" field over to contactEmail
//   --target=<projectId>    write somewhere other than the .firebaserc default
//
// Local testing: set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 to write to the emulator instead.

import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const DRY = flag('dry-run');
const OVERWRITE = flag('overwrite');
const DROP_CONTACT = flag('drop-contact-emails');
const YEAR = '2025-26';

const SOURCE_PROJECT = 'claude-at-stanford';
const SOURCE_KEY = 'AIzaSyBp25Gon7aTdre7BfH3SE3scFxPTOygB10'; // public web API key of the old project
const SOURCE = `https://firestore.googleapis.com/v1/projects/${SOURCE_PROJECT}/databases/(default)/documents`;

const TARGET = args.find((a) => a.startsWith('--target='))?.split('=')[1]
  || JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8')).projects.default;

if (TARGET === SOURCE_PROJECT) {
  console.error('Target is the old project. Point .firebaserc (or --target=) at the new project.');
  process.exit(1);
}

// Mirrors assets/js/taxonomy.js. Anything else in "tools" moves to otherTools.
const CLAUDE_PRODUCTS = ['Claude', 'Claude Code', 'Claude Cowork', 'Claude Skills', 'Claude API', 'Claude Agent SDK', 'MCP'];
const RENAMES = { 'Claude Chat': 'Claude' };

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
if (!EMULATOR && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a service-account key for the NEW project, stored OUTSIDE this repo.');
  process.exit(1);
}
initializeApp(EMULATOR ? { projectId: TARGET } : { credential: applicationDefault(), projectId: TARGET });
const db = getFirestore();
console.log(`Source: ${SOURCE_PROJECT} (public, read-only)`);
console.log(`Target: ${EMULATOR ? `emulator at ${EMULATOR}, project ${TARGET}` : `LIVE project ${TARGET}`}`);

/* ---------- Reading the old project over REST ---------- */

function decode(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return Timestamp.fromDate(new Date(v.timestampValue));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]));
  return undefined;
}

async function readSource(collection) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${SOURCE}/${collection}?pageSize=300&key=${SOURCE_KEY}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Reading ${collection} from ${SOURCE_PROJECT} failed (${res.status}). Has the old project been locked already?`);
    const body = await res.json();
    for (const d of body.documents || []) {
      docs.push({
        id: d.name.split('/').pop(),
        createTime: Timestamp.fromDate(new Date(d.createTime)),
        data: Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, decode(v)])),
      });
    }
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return docs;
}

/* ---------- Mapping ---------- */

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

const created = (src) => (src.data.createdAt instanceof Timestamp ? src.data.createdAt : src.createTime);

function mapBuild(src) {
  const d = src.data;
  const warnings = [];
  const link = httpUrl(d.link);
  if (!link) warnings.push(`link "${d.link}" isn't http(s); left blank (owner must add one to edit)`);
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
      ownerUid: '',
      year: YEAR,
      status: 'published',
      featured: false,
      hearts: uniq(list(d.hearts)),
      createdAt: created(src),
      updatedAt: FieldValue.serverTimestamp(),
      migratedFrom: `${SOURCE_PROJECT}/projects/${src.id}`,
    },
  };
}

function mapResource(src) {
  const d = src.data;
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
      ownerUid: '',
      year: YEAR,
      status: 'published',
      featured: false,
      createdAt: created(src),
      updatedAt: FieldValue.serverTimestamp(),
      migratedFrom: `${SOURCE_PROJECT}/library/${src.id}`,
    },
  };
}

/* ---------- Run ---------- */

const claims = new Map(); // email -> { name, builds: [], resources: [] }
let unclaimable = 0;

async function migrate(from, to, mapper) {
  const [source, existing] = await Promise.all([readSource(from), db.collection(to).get()]);
  const have = new Set(existing.docs.map((d) => d.id));
  const writes = [];
  console.log(`\n${from} -> ${to}: ${source.length} source docs, ${have.size} already in ${to}`);
  for (const src of source) {
    const skip = have.has(src.id) && !OVERWRITE;
    const { data, warnings } = mapper(src);
    const owner = email(src.data.submittedBy);
    if (!owner) { warnings.push('no submitter email; nobody can claim it (leads can still moderate)'); }
    console.log(`  ${skip ? 'skip ' : 'write'} ${src.id}  ${data.title}${data.hearts ? `  (${data.hearts.length} hearts)` : ''}`);
    warnings.forEach((w) => console.log(`        ! ${w}`));
    if (skip) continue;
    writes.push([db.collection(to).doc(src.id), data]);
    if (owner) {
      const c = claims.get(owner) || { name: text(src.data.author, 80), builds: [], resources: [] };
      c[to].push(src.id);
      claims.set(owner, c);
    } else {
      unclaimable += 1;
    }
  }
  return writes;
}

const buildWrites = await migrate('projects', 'builds', mapBuild);
const resourceWrites = await migrate('library', 'resources', mapResource);
// arrayUnion keeps re-runs additive if someone's claims doc still exists.
const claimWrites = [...claims.entries()].map(([who, c]) => [
  db.collection('claims').doc(who),
  {
    name: c.name,
    ...(c.builds.length ? { builds: FieldValue.arrayUnion(...c.builds) } : {}),
    ...(c.resources.length ? { resources: FieldValue.arrayUnion(...c.resources) } : {}),
    createdAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
]);

console.log(`\nclaims: ${claimWrites.length} private claim docs (emails not printed)${unclaimable ? `, ${unclaimable} posts without an owner email` : ''}`);
console.log(`contact emails: ${DROP_CONTACT ? 'dropped' : 'carried over from the old public "email" field'}`);
console.log(`\nTotal writes: ${buildWrites.length} builds, ${resourceWrites.length} resources, ${claimWrites.length} claims`);

if (DRY) {
  console.log('\nDry run: nothing written. Re-run without --dry-run to apply.');
} else {
  const all = [...buildWrites, ...resourceWrites, ...claimWrites];
  for (let i = 0; i < all.length; i += 400) {
    const batch = db.batch();
    all.slice(i, i + 400).forEach(([ref, data, opts]) => batch.set(ref, data, opts || {}));
    await batch.commit();
  }
  console.log(`\nDone. Nothing in ${SOURCE_PROJECT} was modified.`);
}
