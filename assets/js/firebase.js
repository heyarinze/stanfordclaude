// Firebase: Stanford-only Google sign-in plus Firestore Lite (REST, no realtime, smaller download).
// The web config below is public by design; access control lives in firebase/firestore.rules.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore-lite.js';
import { toast } from './ui.js';

export const app = initializeApp({
  apiKey: 'AIzaSyBp25Gon7aTdre7BfH3SE3scFxPTOygB10',
  authDomain: 'claude-at-stanford.firebaseapp.com',
  projectId: 'claude-at-stanford',
  storageBucket: 'claude-at-stanford.firebasestorage.app',
  messagingSenderId: '353494362955',
  appId: '1:353494362955:web:c6fc5a7b264d57180b16ce',
});

export const auth = getAuth(app);
export const db = getFirestore(app);

// Local development only: open http://localhost:3000/?emulator to use the Firebase emulators
// (fake accounts, local data). Sticks for the browser tab. Never active on a real domain.
function wantsEmulator() {
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) return false;
  try {
    if (new URLSearchParams(location.search).has('emulator')) sessionStorage.setItem('fb-emulator', '1');
    return sessionStorage.getItem('fb-emulator') === '1';
  } catch {
    return false;
  }
}
if (wantsEmulator()) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  console.info('Using Firebase emulators');
}

export {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, arrayUnion, arrayRemove,
};

// Firestore collection names (2026-27 schema). See firebase/firestore.rules.
export const COLLECTIONS = {
  builds: 'builds',
  resources: 'resources',
  users: 'users',
  leads: 'leads',
};

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ hd: 'stanford.edu', prompt: 'select_account' });

export const isStanfordEmail = (email) => /@stanford\.edu$/i.test(String(email || ''));

/* ---------- Session ----------
   session.user is undefined until Firebase reports the first auth state,
   then null (signed out) or a Firebase user. */

let session = { user: undefined, isLead: false };
const listeners = new Set();
let resolveReady;
const ready = new Promise((resolve) => { resolveReady = resolve; });

onAuthStateChanged(auth, async (user) => {
  if (user && !isStanfordEmail(user.email)) {
    await signOut(auth);
    toast('Please sign in with your @stanford.edu Google account.', { error: true });
    return; // onAuthStateChanged fires again with null
  }
  let isLead = false;
  if (user) {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.leads, user.email.toLowerCase()));
      isLead = snap.exists();
    } catch {
      isLead = false;
    }
  }
  session = { user: user || null, isLead };
  resolveReady(session);
  listeners.forEach((fn) => fn(session));
});

export function getSession() { return session; }
export function whenAuthReady() { return ready; }

export function onSession(fn) {
  listeners.add(fn);
  if (session.user !== undefined) fn(session);
  return () => listeners.delete(fn);
}

export async function signIn() {
  try {
    const result = await signInWithPopup(auth, provider);
    return isStanfordEmail(result.user?.email) ? result.user : null;
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return null;
    if (err.code === 'auth/popup-blocked') {
      toast('Your browser blocked the sign-in pop-up. Allow pop-ups for this site and try again.', { error: true });
    } else if (err.code === 'auth/unauthorized-domain') {
      toast('Sign-in isn\'t enabled on this domain yet. A lead needs to add it in Firebase Auth settings.', { error: true });
    } else {
      console.error(err);
      toast('Sign-in failed. Please try again.', { error: true });
    }
    return null;
  }
}

export async function signOutUser() {
  await signOut(auth);
}

/** Make sure someone is signed in with Stanford before an action. Returns the user or null. */
export async function requireStanford() {
  await ready;
  if (session.user) return session.user;
  return signIn();
}

/** Record the submitter's email privately (users/{uid}); public docs never store it. */
export async function saveUserProfile(user, name) {
  await setDoc(doc(db, COLLECTIONS.users, user.uid), {
    email: user.email.toLowerCase(),
    name: name || user.displayName || '',
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
