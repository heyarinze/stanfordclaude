// Firestore rules tests. Run from this folder: npm install && npm test
// Uses the local emulator only (project "demo-claude-at-stanford"), never the real database.

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where,
  serverTimestamp, arrayUnion, arrayRemove, Timestamp,
} from 'firebase/firestore';

const PROJECT = 'demo-claude-at-stanford';
let env;

const ALICE = { uid: 'alice', email: 'alice@stanford.edu', email_verified: true };
const BOB = { uid: 'bob', email: 'bob@stanford.edu', email_verified: true };
const LEAD = { uid: 'lead', email: 'lead@stanford.edu', email_verified: true };
const GMAIL = { uid: 'mallory', email: 'mallory@gmail.com', email_verified: true };
const UNVERIFIED = { uid: 'eve', email: 'eve@stanford.edu', email_verified: false };

const as = (u) => env.authenticatedContext(u.uid, { email: u.email, email_verified: u.email_verified }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

function newBuild(owner, overrides = {}) {
  return {
    title: 'Study Buddy',
    link: 'https://example.com',
    desc: 'Helps you study.',
    tools: ['Claude Code'],
    otherTools: ['Supabase'],
    categories: ['Learning'],
    howBuilt: '',
    authorName: 'Alice A',
    linkedin: '',
    contactEmail: '',
    ownerUid: owner.uid,
    year: '2026-27',
    status: 'published',
    featured: false,
    hearts: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function newResource(owner, overrides = {}) {
  return {
    title: 'Great guide',
    url: 'https://example.com/guide',
    why: 'Clear and short.',
    tools: [],
    categories: ['How-To'],
    authorName: 'Alice A',
    ownerUid: owner.uid,
    year: '2026-27',
    status: 'published',
    featured: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

// Seed data with rules disabled.
async function seed(fn) {
  await env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
}

const stamp = Timestamp.fromDate(new Date('2026-02-01'));
const seededBuild = (owner, extra = {}) => ({
  ...newBuild(owner), createdAt: stamp, updatedAt: stamp, ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, 'leads', LEAD.email), { role: 'Lead' });
    await setDoc(doc(db, 'builds', 'pub'), seededBuild(ALICE));
    await setDoc(doc(db, 'builds', 'hid'), seededBuild(ALICE, { status: 'hidden' }));
    await setDoc(doc(db, 'resources', 'res'), { ...newResource(ALICE), createdAt: stamp, updatedAt: stamp });
    await setDoc(doc(db, 'users', ALICE.uid), { email: ALICE.email, name: 'Alice A', updatedAt: stamp });
  });
});

describe('reading', () => {
  test('anyone reads published builds', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'builds', 'pub')));
    await assertSucceeds(getDocs(query(collection(anon(), 'builds'), where('status', '==', 'published'))));
  });
  test('public cannot read hidden builds or list everything', async () => {
    await assertFails(getDoc(doc(anon(), 'builds', 'hid')));
    await assertFails(getDocs(collection(anon(), 'builds')));
    await assertFails(getDoc(doc(as(BOB), 'builds', 'hid')));
  });
  test('owner reads own hidden build; owner query works', async () => {
    await assertSucceeds(getDoc(doc(as(ALICE), 'builds', 'hid')));
    await assertSucceeds(getDocs(query(collection(as(ALICE), 'builds'), where('ownerUid', '==', ALICE.uid))));
  });
  test('lead lists everything', async () => {
    await assertSucceeds(getDocs(collection(as(LEAD), 'builds')));
  });
  test('users/* is private', async () => {
    await assertFails(getDoc(doc(anon(), 'users', ALICE.uid)));
    await assertFails(getDoc(doc(as(BOB), 'users', ALICE.uid)));
    await assertSucceeds(getDoc(doc(as(ALICE), 'users', ALICE.uid)));
    await assertSucceeds(getDoc(doc(as(LEAD), 'users', ALICE.uid)));
  });
  test('leads: self-check allowed, others not', async () => {
    await assertSucceeds(getDoc(doc(as(BOB), 'leads', BOB.email)));
    await assertFails(getDoc(doc(as(BOB), 'leads', LEAD.email)));
    await assertFails(getDocs(collection(as(BOB), 'leads')));
    await assertSucceeds(getDocs(collection(as(LEAD), 'leads')));
  });
});

describe('creating builds', () => {
  test('Stanford user creates a valid build', async () => {
    await assertSucceeds(addDoc(collection(as(ALICE), 'builds'), newBuild(ALICE)));
  });
  test('non-Stanford, unverified and signed-out users cannot', async () => {
    await assertFails(addDoc(collection(as(GMAIL), 'builds'), newBuild(GMAIL)));
    await assertFails(addDoc(collection(as(UNVERIFIED), 'builds'), newBuild(UNVERIFIED)));
    await assertFails(addDoc(collection(anon(), 'builds'), newBuild(ALICE)));
  });
  test('cannot spoof owner, pre-feature, pre-heart or hide', async () => {
    await assertFails(addDoc(collection(as(ALICE), 'builds'), newBuild(BOB)));
    await assertFails(addDoc(collection(as(ALICE), 'builds'), newBuild(ALICE, { featured: true })));
    await assertFails(addDoc(collection(as(ALICE), 'builds'), newBuild(ALICE, { hearts: ['bob'] })));
    await assertFails(addDoc(collection(as(ALICE), 'builds'), newBuild(ALICE, { status: 'hidden' })));
    await assertFails(addDoc(collection(as(ALICE), 'builds'), newBuild(ALICE, { createdAt: stamp })));
  });
  test('validates content', async () => {
    await assertFails(addDoc(collection(as(ALICE), 'builds'), newBuild(ALICE, { link: 'javascript:alert(1)' })));
    await assertFails(addDoc(collection(as(ALICE), 'builds'), newBuild(ALICE, { title: '' })));
    await assertFails(addDoc(collection(as(ALICE), 'builds'), newBuild(ALICE, { desc: 'x'.repeat(601) })));
    await assertFails(addDoc(collection(as(ALICE), 'builds'), newBuild(ALICE, { otherTools: ['x'.repeat(901)] })));
    await assertFails(addDoc(collection(as(ALICE), 'builds'), newBuild(ALICE, { tools: Array(11).fill('Claude') })));
    await assertFails(addDoc(collection(as(ALICE), 'builds'), newBuild(ALICE, { contactEmail: 'not an email' })));
    await assertFails(addDoc(collection(as(ALICE), 'builds'), newBuild(ALICE, { extra: 'field' })));
    await assertSucceeds(addDoc(collection(as(ALICE), 'builds'), newBuild(ALICE, { linkedin: 'https://linkedin.com/in/a', contactEmail: 'a@b.co' })));
  });
});

describe('editing builds', () => {
  const edit = (db, patch) => updateDoc(doc(db, 'builds', 'pub'), { ...patch, updatedAt: serverTimestamp() });
  test('owner edits content', async () => {
    await assertSucceeds(edit(as(ALICE), { title: 'Study Buddy 2' }));
  });
  test('owner cannot touch moderation fields, hearts or ownership', async () => {
    await assertFails(edit(as(ALICE), { featured: true }));
    await assertFails(edit(as(ALICE), { status: 'hidden' }));
    await assertFails(edit(as(ALICE), { hearts: ['x'] }));
    await assertFails(edit(as(ALICE), { ownerUid: 'bob' }));
  });
  test('worst case: maxed-out lists and lengths still pass (expression budget)', async () => {
    const big = {
      title: 't'.repeat(80),
      desc: 'd'.repeat(600),
      howBuilt: 'h'.repeat(6000),
      tools: Array.from({ length: 10 }, (_, i) => `Tool ${i}`.padEnd(40, 'x')),
      otherTools: Array.from({ length: 10 }, (_, i) => `Other ${i}`.padEnd(80, 'y')),
      categories: Array.from({ length: 6 }, (_, i) => `Cat ${i}`.padEnd(40, 'z')),
      linkedin: `https://linkedin.com/in/${'a'.repeat(400)}`,
      contactEmail: 'someone@stanford.edu',
    };
    await assertSucceeds(edit(as(ALICE), big));
    await assertSucceeds(addDoc(collection(as(BOB), 'builds'), newBuild(BOB, big)));
    await seed((db) => updateDoc(doc(db, 'builds', 'pub'), { hearts: Array.from({ length: 300 }, (_, i) => `u${i}`) }));
    await assertSucceeds(updateDoc(doc(as(BOB), 'builds', 'pub'), { hearts: arrayUnion(BOB.uid) }));
    await assertSucceeds(updateDoc(doc(as(LEAD), 'builds', 'pub'), { featured: true, moderatedBy: LEAD.email, moderatedAt: serverTimestamp() }));
  });
  test('others cannot edit', async () => {
    await assertFails(edit(as(BOB), { title: 'pwned' }));
    await assertFails(edit(as(LEAD), { title: 'lead edit' }));
  });
});

describe('hearts', () => {
  const ref = (db) => doc(db, 'builds', 'pub');
  test('another student adds and removes their own heart', async () => {
    await assertSucceeds(updateDoc(ref(as(BOB)), { hearts: arrayUnion(BOB.uid) }));
    await assertSucceeds(updateDoc(ref(as(BOB)), { hearts: arrayRemove(BOB.uid) }));
  });
  test('cannot heart for someone else, twice at once, or own build', async () => {
    await assertFails(updateDoc(ref(as(BOB)), { hearts: arrayUnion('carol') }));
    await assertFails(updateDoc(ref(as(BOB)), { hearts: [BOB.uid, 'carol'] }));
    await assertFails(updateDoc(ref(as(ALICE)), { hearts: arrayUnion(ALICE.uid) }));
    await assertFails(updateDoc(ref(as(GMAIL)), { hearts: arrayUnion(GMAIL.uid) }));
  });
  test('cannot remove another person\'s heart', async () => {
    await seed((db) => updateDoc(doc(db, 'builds', 'pub'), { hearts: ['carol'] }));
    await assertFails(updateDoc(ref(as(BOB)), { hearts: arrayRemove('carol') }));
  });
  test('heart update cannot smuggle other fields', async () => {
    await assertFails(updateDoc(ref(as(BOB)), { hearts: arrayUnion(BOB.uid), title: 'x' }));
  });
});

describe('moderation', () => {
  const mod = (db, user, patch) => updateDoc(doc(db, 'builds', 'pub'), { ...patch, moderatedBy: user.email, moderatedAt: serverTimestamp() });
  test('lead hides and features', async () => {
    await assertSucceeds(mod(as(LEAD), LEAD, { status: 'hidden' }));
    await assertSucceeds(mod(as(LEAD), LEAD, { featured: true }));
  });
  test('non-leads cannot moderate; leads must sign as themselves', async () => {
    await assertFails(mod(as(BOB), BOB, { featured: true }));
    await assertFails(mod(as(LEAD), BOB, { featured: true }));
    await assertFails(mod(as(LEAD), LEAD, { status: 'deleted' }));
  });
  test('delete: owner and lead yes, others no', async () => {
    await assertFails(deleteDoc(doc(as(BOB), 'builds', 'pub')));
    await assertSucceeds(deleteDoc(doc(as(ALICE), 'builds', 'pub')));
    await assertSucceeds(deleteDoc(doc(as(LEAD), 'builds', 'hid')));
  });
});

describe('resources', () => {
  test('create, edit, moderate', async () => {
    await assertSucceeds(addDoc(collection(as(BOB), 'resources'), newResource(BOB)));
    await assertFails(addDoc(collection(as(BOB), 'resources'), newResource(BOB, { url: 'ftp://x' })));
    await assertFails(addDoc(collection(as(BOB), 'resources'), newResource(BOB, { hearts: [] })));
    await assertSucceeds(updateDoc(doc(as(ALICE), 'resources', 'res'), { why: 'Updated', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(BOB), 'resources', 'res'), { why: 'x', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(LEAD), 'resources', 'res'), { featured: true, moderatedBy: LEAD.email, moderatedAt: serverTimestamp() }));
  });
});

describe('user profiles', () => {
  test('write own profile with own email only', async () => {
    await assertSucceeds(setDoc(doc(as(BOB), 'users', BOB.uid), { email: BOB.email, name: 'Bob', updatedAt: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(doc(as(BOB), 'users', BOB.uid), { email: 'other@stanford.edu', name: 'Bob', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as(BOB), 'users', ALICE.uid), { email: BOB.email, name: 'Bob', updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(as(ALICE), 'users', ALICE.uid), { email: ALICE.email, name: 'Alice', updatedAt: serverTimestamp() }, { merge: true }));
  });
  test('leads allowlist is read-only from clients', async () => {
    await assertFails(setDoc(doc(as(LEAD), 'leads', BOB.email), { role: 'Lead' }));
  });
});

// The transitional rules must keep the 2025-26 site (still in production during cutover) working.
describe('legacy collections (transitional)', () => {
  const oldProject = (owner, extra = {}) => ({
    name: 'Old build', link: 'https://example.com', desc: 'd', tools: ['Claude Code'], otherTools: [], categories: ['Fun'],
    howBuilt: '', author: 'Alice', email: owner.email, linkedin: '', submittedBy: owner.email, submittedByUid: owner.uid,
    hearts: [], createdAt: serverTimestamp(), ...extra,
  });
  test('old site: read, create, owner edit/delete', async () => {
    await assertSucceeds(getDocs(collection(anon(), 'projects')));
    await assertSucceeds(getDocs(collection(anon(), 'library')));
    const ref = await assertSucceeds(addDoc(collection(as(ALICE), 'projects'), oldProject(ALICE)));
    await assertSucceeds(updateDoc(doc(as(ALICE), 'projects', ref.id), { name: 'Renamed' }));
    await assertFails(updateDoc(doc(as(BOB), 'projects', ref.id), { name: 'pwned' }));
    await assertFails(addDoc(collection(as(GMAIL), 'projects'), oldProject(GMAIL)));
    await assertFails(addDoc(collection(as(ALICE), 'projects'), oldProject(BOB)));
    await assertSucceeds(deleteDoc(doc(as(ALICE), 'projects', ref.id)));
  });
  test('old site: others can heart (whole-array write, hearts only)', async () => {
    const ref = await addDoc(collection(as(ALICE), 'projects'), oldProject(ALICE));
    await assertSucceeds(updateDoc(doc(as(BOB), 'projects', ref.id), { hearts: [BOB.uid] }));
    await assertFails(updateDoc(doc(as(BOB), 'projects', ref.id), { hearts: [BOB.uid], name: 'x' }));
  });
  test('old library: create and owner edit', async () => {
    const ref = await assertSucceeds(addDoc(collection(as(ALICE), 'library'), {
      title: 'T', url: 'https://x.co', why: 'w', author: 'Alice', submittedBy: ALICE.email, submittedByUid: ALICE.uid, createdAt: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(as(ALICE), 'library', ref.id), { why: 'better' }));
    await assertFails(updateDoc(doc(as(BOB), 'library', ref.id), { why: 'x' }));
  });
});
