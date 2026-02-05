# Claude@Stanford — Build Report

## The Short Version

I described a project showcase site for Claude@Stanford members, and Claude Code wrote the entire thing in a single HTML file — no frameworks, no dependencies, just vanilla HTML, CSS, and JavaScript. From there, I reacted to what I saw and made taste calls: swap this logo, soften that badge, change this button text. Claude Code executed every revision instantly while I steered the design through quick back-and-forth prompts.

Midway through, the vision grew. What started as a simple showcase turned into a full community hub — so Claude Code added a Campus Leads directory, a Claude Library for resource uploads, and a JotForm signup button as I expanded the scope in real time.

Then I hit a real infrastructure problem: submissions were stored in LocalStorage, which meant they were trapped in one person's browser. I decided on Firebase, grabbed a config from the console, and Claude Code rewired the entire storage layer to Firestore so data would persist across all users and devices. I locked it down by having Claude Code write security rules — anyone can read and submit, but no one can edit or delete what's already there.

Later, we replaced the passcode gate with Stanford Google Sign-In — only `@stanford.edu` accounts can submit content now, enforced both client-side and through Firestore security rules. Users can edit and delete only their own submissions.

Finally, I created the GitHub repo and connected the domain. Claude Code committed and pushed every change live to claudeatstanford.org.

I never wrote a line of code. I made every product decision — what to build, how it should look, when to pivot, what infrastructure to use. Claude Code did all the typing. One HTML file, Firebase for the backend, GitHub for version control. Idea to live site in under an hour.

---

## The Full Build — Phase by Phase

### Phase 1: Initial Build — Project Showcase Platform
**What I asked for:** A site where Claude@Stanford members could upload projects they built with AI tools. Passcode-gated, with a tool map that unlocks after 5 submissions, Anthropic visual aesthetics.

**What Claude Code built:**
- Single-page application with passcode authentication (`D@NL3L`)
- Project submission form (name, demo link, description, tools used)
- Tool usage visualization (bar chart + interactive canvas node graph)
- Conditional tool map display (locked until 5 projects exist)
- Anthropic-inspired design (Inter font, warm neutrals, clean cards, subtle shadows)
- LocalStorage for data persistence
- Progress counter bar toward the 5-project threshold

**Time:** ~8 min

---

### Phase 2: Logo & Footer Branding
**What I asked for:** Replace the placeholder SVG logo with the Claude@Stanford icon from my Downloads. Update the footer with my name and LinkedIn.

**What happened:** Claude Code searched through several image files in Downloads before finding the right one (`Claude @ Stanford Logo - FULL (1).png`). Integrated it into the nav, updated footer with attribution.

**Time:** ~3 min

**Where it could have been faster:** If I'd given the exact filename upfront, this would've been a 30-second edit.

---

### Phase 3: Passcode Change
**What I asked for:** Change passcode from `D@NL3L` to `DN@L3L`.

**What Claude Code did:** One-line edit.

**Time:** ~30 sec

---

### Phase 4: Form Enhancements
**What I asked for:** Add name (required), email (optional with explainer), and "How I Built This" (optional) fields.

**What Claude Code built:**
- Three new form fields with validation
- Project cards updated to show author name, optional email, and expandable build story

**Time:** ~3 min

**Where it could have been faster:** If I'd specified all the fields I wanted in Phase 1, this separate round wouldn't have been needed.

---

### Phase 5: Scrollable Form Fix
**What I asked for:** The form modal was freezing — submit button hidden off-screen.

**What Claude Code fixed:** Changed the overlay CSS to enable scrolling (`overflow-y: auto`, `flex-shrink: 0`, `align-items: flex-start`).

**Time:** ~2 min

**Where it could have been faster:** This was a CSS bug introduced by the form getting taller after Phase 4. If the modal had been built with scroll-awareness from the start, this phase wouldn't have existed.

---

### Phase 6: Major Feature Addition — Three New Sections
**What I asked for:** Add a "Request to Join" button (JotForm link), a Campus Leads directory (3 people with LinkedIn/email), and a Claude Library section (passcode-gated content uploads with file upload).

**What Claude Code built:**
- Updated nav with 5 section links + styled join button
- Campus Leads section: three cards with gradient avatar initials, LinkedIn buttons, email buttons
- Claude Library: separate upload form with title, URL, file upload (base64), and rationale
- Shared auth state between project and library passcode gates

**Time:** ~10 min

---

### Phase 7: LinkedIn Additions
**What I asked for:** Add LinkedIn profiles for William Liu and Diego Sanchez.

**What Claude Code did:** Added LinkedIn buttons to their Campus Leads cards.

**Time:** ~1 min

**Where it could have been faster:** If I'd had all three LinkedIn URLs ready in Phase 6, this would've been included in the original build.

---

### Phase 8: Footer Text Change
**What I asked for:** Change "Made with" to "Built with" and add "Claude Code and" before my name.

**Time:** ~30 sec

---

### Phase 9: Hero Text Change
**What I asked for:** Change headline to "What the Stanford community is building with Claude."

**Time:** ~30 sec

---

### Phase 10: Button Text Change
**What I asked for:** Change "Request to Join" to "Join the Club."

**Time:** ~30 sec

**Phases 8-10 efficiency note:** These three changes were separate prompts. If batched into one message ("change the footer to X, the hero to Y, and the button to Z"), all three would've been done in a single round.

---

### Phase 11: GitHub Push
**What I asked for:** Push everything to a new repo called `stanfordclaude`.

**What happened:** `gh` CLI wasn't installed, and neither was Homebrew. I created the repo manually on GitHub, then Claude Code added the remote and pushed via HTTPS.

**Time:** ~5 min

**Where it could have been faster:** Having `gh` CLI installed would've made this a one-command operation.

---

### Phase 12: Favicon & Page Title
**What I asked for:** Favicon matching the Claude logo, page title "Claude @ Stanford."

**What Claude Code did:** Generated a 32x32 orange sunburst favicon programmatically via Python, updated `<title>` and `<link rel="icon">`.

**Time:** ~2 min

---

### Phase 13: Gold Badge
**What I asked for:** A gold badge on the hero section that says "THE WORLD'S LARGEST CLAUDE BUILDER CLUB."

**What happened:** First version was too flashy (metallic gradient, inset shadows, engraved text). I asked to soften it — Claude Code toned it down to off-cream background, warm brown text, subtle drop shadow. Later added sparkle emojis on each side.

**Time:** ~3 min

**Where it could have been faster:** If I'd described the exact aesthetic I wanted upfront ("soft, muted, matches the rest of the site"), the first iteration would've landed and avoided the redesign round.

---

### Phase 14: Firebase Integration
**What I asked for:** Persistent storage so submissions aren't trapped in one browser. I decided on Firebase.

**What Claude Code did:**
- Added Firebase compat SDK scripts (app + firestore)
- Replaced all LocalStorage reads/writes with Firestore collection queries
- Two collections: `projects` and `library`
- `serverTimestamp()` for chronological ordering
- Provided Firestore security rules (read + create allowed, update/delete blocked)

**What I did:** Created the Firebase project, grabbed the config, pasted it into the conversation. Set Firestore to production mode and applied the security rules.

**Time:** ~5 min

**This was the biggest architectural shift.** LocalStorage → Firestore changed the site from a single-browser toy to a real multi-user platform. If I'd known from the start that I wanted cross-device persistence, I would've started with Firebase and skipped the LocalStorage phase entirely.

---

### Phase 15: Stanford Google Sign-In
**What I asked for:** Remove the passcode system. Replace it with Google Sign-In restricted to `@stanford.edu` emails.

**What Claude Code did:**
- Added `firebase-auth-compat.js` SDK
- Replaced both passcode modals with a single Google Sign-In modal
- Google provider with `hd: 'stanford.edu'` hint
- Client-side domain check (rejects non-Stanford emails, signs them out)
- `onAuthStateChanged` listener for persistent sessions
- Signed-in user's email displayed in nav bar with sign-out button
- Pre-fills name/email in forms from Google account
- Stores `submittedBy` (email) and `submittedByUid` (Firebase UID) in every document
- Updated Firestore security rules to enforce `@stanford.edu` on the server side

**What I did:** Enabled Google as a sign-in provider in Firebase Console, added `claudeatstanford.org` as an authorized domain.

**Time:** ~8 min

**Where it could have been faster:** The initial sign-in failed because the custom domain wasn't authorized in Firebase — a step that could've been anticipated in the plan.

---

### Phase 16: Owner Edit & Delete
**What I asked for:** Let people edit and delete only what they uploaded.

**What Claude Code did:**
- Edit/Delete buttons appear only on cards where `submittedByUid` matches the signed-in user
- Edit reuses existing upload modals, pre-populates all fields
- Delete requires a confirmation dialog
- `submitProject()` and `submitLibrary()` now handle both create and update modes
- Firestore security rules updated: `allow update, delete: if request.auth.uid == resource.data.submittedByUid`

**Time:** ~5 min

---

## Time Analysis

| Phase | Description | Time |
|-------|-------------|------|
| 1 | Initial build (showcase + tool map) | 8 min |
| 2 | Logo & footer branding | 3 min |
| 3 | Passcode change | 0.5 min |
| 4 | Form enhancements (name, email, how-built) | 3 min |
| 5 | Scrollable form fix | 2 min |
| 6 | Three new sections (join, leads, library) | 10 min |
| 7 | LinkedIn additions | 1 min |
| 8 | Footer text change | 0.5 min |
| 9 | Hero text change | 0.5 min |
| 10 | Button text change | 0.5 min |
| 11 | GitHub push | 5 min |
| 12 | Favicon & title | 2 min |
| 13 | Gold badge (+ softening + emojis) | 3 min |
| 14 | Firebase integration (LocalStorage → Firestore) | 5 min |
| 15 | Stanford Google Sign-In (replace passcode) | 8 min |
| 16 | Owner edit & delete | 5 min |
| **TOTAL** | | **~57 min** |

---

## Technical Architecture (Final State)

| Aspect | Choice |
|--------|--------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Authentication | Firebase Auth (Google provider, `@stanford.edu` only) |
| Database | Cloud Firestore (collections: `projects`, `library`) |
| Hosting | GitHub Pages → custom domain `claudeatstanford.org` |
| Fonts | Inter + JetBrains Mono (Google Fonts) |
| Assets | Custom logo PNG, generated favicon PNG |
| Architecture | Single-file SPA (~1,584 lines) |
| Security | Firestore rules: read (all), create (Stanford auth), update/delete (owner only) |

---

## Efficiency Analysis

### What Worked Well
1. **Iterative development** — Small changes, instant feedback. I could see and react in real time instead of writing a 20-page spec upfront.
2. **Single-file architecture** — No build tools, no dependencies, no config files. Everything portable in one HTML file.
3. **Component reuse** — Modal system, auth flow, and card styles were reused across projects and library.
4. **Progressive feature layering** — Core showcase shipped first, then enriched with leads, library, branding, auth, and edit/delete.
5. **Firebase compat SDK** — Using the compat version meant a clean migration path without rewriting existing Firestore code when adding auth.

### What Would Have Made the Build Faster

| Inefficiency | Time Lost | How to Avoid |
|-------------|-----------|-------------|
| Logo filename not specified | ~1 min | Have exact asset names ready before starting |
| Form fields added after initial build | ~3 min | Define the full data model upfront |
| Scrollable modal fix needed | ~2 min | Build modals with scroll-awareness from the start |
| Three copy changes as separate prompts (Phases 8-10) | ~1 min | Batch small text changes into one request |
| LinkedIn URLs provided separately from leads section | ~1 min | Provide all data for a section at once |
| `gh` CLI not installed | ~3 min | Pre-install dev tools before starting |
| Gold badge redesign (too flashy first time) | ~1.5 min | Describe exact visual tone in the first request |
| Started with LocalStorage, migrated to Firebase | ~5 min | Decide on persistence strategy before Phase 1 |
| Authorized domain missing for Firebase Auth | ~2 min | Include custom domain setup in the auth migration plan |
| **Total recoverable time** | **~19.5 min** | — |

**Theoretical minimum build time:** ~37.5 min (vs. actual ~57 min)

The biggest single inefficiency was starting with LocalStorage and later migrating to Firebase. If persistence strategy had been decided upfront, ~5 minutes of rework and the entire LocalStorage implementation would have been avoided. The second biggest was not batching small text/copy changes.

### What Could Make the Product Better
1. **Search & Filtering** — Filter projects by tool, search library by keyword
2. **Media Support** — Screenshot/thumbnail uploads, video demo embeds
3. **Social Features** — Upvoting, comments, featured project rotation
4. **Admin Panel** — Let leads moderate submissions without code changes
5. **Analytics Dashboard** — Submission trends, most-used tools, contributor counts
6. **Open Graph Meta Tags** — Rich link previews when shared on Slack, LinkedIn
7. **Accessibility** — ARIA labels, keyboard navigation, WCAG color contrast
8. **Mobile Auth UX** — The nav sign-in status is hidden on mobile; add a mobile-friendly indicator
9. **Export/Backup** — JSON export of all projects and library items
10. **Rate Limiting** — Prevent spam submissions even from authenticated users

---

## Conclusion

The Claude@Stanford site went from idea to live production site at `claudeatstanford.org` in under an hour across 16 iterative phases. No line of code was written by hand — every product decision was made through conversation, and every implementation was handled by Claude Code. The final product is a fully authenticated community platform with Google Sign-In, Firestore persistence, owner-level edit/delete permissions, and server-side security rules.

The build demonstrates that the bottleneck in shipping a product isn't typing code — it's making decisions. Having all requirements, assets, and infrastructure choices ready upfront could have cut the build time by a third. The most valuable skill in this workflow isn't engineering. It's knowing what you want.

**Repository:** [github.com/heyarinze/stanfordclaude](https://github.com/heyarinze/stanfordclaude)
**Live Site:** [claudeatstanford.org](https://www.claudeatstanford.org)
