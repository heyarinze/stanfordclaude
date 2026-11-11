#!/usr/bin/env node
// Manage the lead allowlist (Firestore leads/{email}). Leads get the Moderation page.
//
// Usage (from this folder, after `npm install`):
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/OUTSIDE/the/repo/key.json
//   node leads.mjs list
//   node leads.mjs add someone@stanford.edu another@stanford.edu [--role="Co-Lead"]
//   node leads.mjs remove someone@stanford.edu
//
// You can do the same by hand in the Firebase console (see README → Adding a lead).

import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const [command, ...rest] = process.argv.slice(2);
const role = rest.find((a) => a.startsWith('--role='))?.split('=').slice(1).join('=') || 'Lead';
const emails = rest.filter((a) => !a.startsWith('--')).map((e) => e.trim().toLowerCase());
const projectId = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8')).projects.default;

if (!['list', 'add', 'remove'].includes(command)) {
  console.error('Usage: node leads.mjs list | add <emails…> [--role=…] | remove <emails…>');
  process.exit(1);
}
const bad = emails.filter((e) => !/^[^\s@]+@stanford\.edu$/.test(e));
if (bad.length) {
  console.error(`Not @stanford.edu addresses: ${bad.join(', ')}`);
  process.exit(1);
}
if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a service-account key stored OUTSIDE this repo.');
  process.exit(1);
}

initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId } : { credential: applicationDefault(), projectId });
const leads = getFirestore().collection('leads');

if (command === 'add') {
  for (const email of emails) {
    await leads.doc(email).set({ role, addedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.log(`added   ${email}  (${role})`);
  }
} else if (command === 'remove') {
  for (const email of emails) {
    await leads.doc(email).delete();
    console.log(`removed ${email}`);
  }
}

const all = await leads.get();
console.log(`\n${projectId}: ${all.size} lead${all.size === 1 ? '' : 's'}`);
all.docs.map((d) => `  ${d.id}  (${d.data().role || 'Lead'})`).sort().forEach((line) => console.log(line));
