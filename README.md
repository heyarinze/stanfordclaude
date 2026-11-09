# Claude@Stanford

The site for Claude@Stanford, the Stanford student community building with Claude: **[claudeatstanford.org](https://claudeatstanford.org)**.

Plain HTML, CSS and JavaScript modules with no build step and no npm for the site itself. Vercel serves the repo as-is, and every push to `main` deploys to production. Firebase handles Stanford sign-in and the community data (Builds and Library).

## Updating content (no coding needed)

Most yearly updates are JSON edits you can make in the GitHub web editor. Open a PR, check the Vercel preview link, then merge.

| What | File | Notes |
|---|---|---|
| Slack invite, Luma calendar, hero badge, academic year | `data/site.json` | See [site.json fields](#sitejson-fields) |
| Team roster | `data/team.json` | Photos go in `assets/img/team/<year>/` (square, ~320px, `.webp` or `.jpg`) |
| Workshops (slides, recordings, code) | `data/workshops.json` | Also holds the "Official resources" links |
| Past years (hackathon winners, old teams) | `data/archive/<year>.json` + add the year to `data/archive/index.json` | |
| Perks page copy | `perks.html` | Search for `PLACEHOLDER` |
| Product and category tags | `assets/js/taxonomy.js` | Older posts keep their tags either way |

### `site.json` fields

- `academicYear`: `"2026-27"`. New posts are tagged with it, and the Builds/Library year filters use it.
- `heroBadge`: small text next to the year on the home page. Leave `""` to hide it.
- `slackUrl`: the workspace invite link. In Slack, set it to **never expire**. While it's empty, "Join" buttons point to the join section on the home page.
- `lumaCalendarUrl`: the public calendar page (for "Subscribe on Luma").
- `lumaEmbedUrl`: in Luma, go to Calendar → Embed and copy the `src` of the iframe (e.g. `https://luma.com/embed/calendar/cal-XXXX/events`).
- `contactEmail`: optional club email shown in the footer.

### `workshops.json` entry

```json
{
  "title": "Your first Claude Code project",
  "date": "2026-10-15",
  "level": "Beginner",
  "summary": "Install Claude Code, write a CLAUDE.md, and ship a small app in an hour.",
  "tags": ["Claude Code"],
  "slidesUrl": "https://…",
  "recordingUrl": "",
  "repoUrl": ""
}
```

### End of year

1. Copy the year's team from `team.json` and any event winners into `data/archive/<year>.json`, and add the year to `data/archive/index.json`.
2. Bump `academicYear` in `site.json`.
3. Replace `team.json` with the new roster.

## Running locally

```bash
npx serve .
```

Then open http://localhost:3000. `serve` handles the clean URLs (`/builds` → `builds.html`) the same way Vercel does. Sign-in works on `localhost` out of the box.

### Against local emulators (fake accounts, local data)

To try changes without touching the real database, run the Firebase emulators (needs Java, e.g. `brew install openjdk`):

```bash
firebase emulators:start --only auth,firestore
```

Then open http://localhost:3000/?emulator. The flag sticks for that browser tab, and it never activates on a real domain. Sign-in shows the emulator's fake account picker. The emulator starts empty, so add a doc to `leads` (e.g. with the emulator REST API or a quick script) to test moderation.

## How it's put together

```
*.html                 one file per page; shared header/footer come from <site-header>/<site-footer>
assets/css/            tokens.css (colors, type, spacing; light + dark), base.css, components.css
assets/js/
  layout.js            header, nav and footer for every page (edit NAV to add a page)
  firebase.js          Firebase init, Stanford-only Google sign-in, session + lead check
  collection.js        shared gallery engine behind Builds and Library
  builds.js, library.js  field lists, cards and detail views for each gallery
  home.js, events.js, learn.js, team.js, archive.js, admin.js   page scripts
  ui.js                safe HTML templating (html``), icons, toasts, dialogs
data/                  editable content (see above)
firebase/              Firestore security rules + tests
scripts/               one-off maintenance scripts (not deployed)
docs/                  history, including the 2025-26 build report
```

All user-submitted text is rendered through the `html` tagged template in `ui.js`, which escapes it, and links go through `safeUrl()`, which only allows `http(s)`. Keep it that way.

## Firebase

Project: **`claudeatstanford`** (owned by William Peracchio's account since 2026-27; the 2025-26 site used Arinze's `claude-at-stanford`). Sign-in is Google, restricted to `@stanford.edu`, and enforced in both the client and the rules. The web config lives in `assets/js/firebase.js`, and the CLI default is set in `.firebaserc`.

| Collection | Who can read | Notes |
|---|---|---|
| `builds` | everyone (published), owner and leads (hidden) | community builds |
| `resources` | same | shown as "Library" |
| `users` | the user and leads | private submitter emails |
| `leads` | each lead's own doc; leads can list | lead allowlist |
| `claims` | that person and leads | which migrated 2025-26 posts belong to an email (see below) |

### Adding a lead

In the Firebase console go to Firestore → `leads` → **Add document**. Set the document ID to the person's lowercase `@stanford.edu` email and add a field `role` (string). Or, with a service-account key, run `cd scripts && node leads.mjs add someone@stanford.edu` (also `list` and `remove`). They'll see **Moderation** in their account menu after their next sign-in. The `/admin` page lets leads feature, hide or delete posts, email a poster, and export everything as JSON.

### Rules

The rules live in `firebase/firestore.rules` and are deployed with the Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

To test them against the local emulator (needs Java 11+):

```bash
cd firebase && npm install && npm test
```

### Sign-in on new domains

Firebase only allows sign-in from domains listed under Authentication → Settings → **Authorized domains**. `localhost`, `claudeatstanford.org` and `stanfordclaude.vercel.app` need to be there. Add a Vercel preview domain too if you want to test sign-in on a PR preview.

### Posts from 2025-26 ("claims")

Sign-in IDs are different in every Firebase project, so the 21 builds and 7 library posts copied from last year's project arrive with no owner (`ownerUid: ''`). The migration also writes a private `claims/{email}` doc listing each person's posts. The first time that person signs in, the site links those posts to their account and deletes the claim (`claimLegacyPosts` in `assets/js/firebase.js`). Until then the posts show normally and leads can moderate them, but nobody can edit them.

## Security

- **The Firebase web config is public on purpose.** The `apiKey` in `assets/js/firebase.js` identifies the project to Google; every visitor's browser downloads it, so it can't be hidden on a static site, and it grants nothing by itself. GitHub's secret scanning still flags it as a "Google API Key". That alert is expected: close it as a false positive after confirming the key is restricted (below).
- **What actually protects the data:** the Firestore rules (`firebase/firestore.rules`, with tests) and Firebase Auth's authorized domains.
- **Key restriction** (Google Cloud console → APIs & Services → Credentials → *Browser key (auto created by Firebase)* → Application restrictions → **Websites**). Keep this list in sync with the domains the site runs on:
  - `https://claudeatstanford.org/*`
  - `https://www.claudeatstanford.org/*`
  - `https://stanfordclaude.vercel.app/*`
  - `https://claudeatstanford.firebaseapp.com/*` (Firebase's sign-in pop-up runs here; sign-in breaks without it)
  - `http://localhost:3000/*` (local development)
  - any Vercel preview domain you want to test sign-in on

  Leave the key's API restrictions as Firebase created them. A referrer check only stops other *websites* from reusing the key; scripts can fake it. The project is on the free Spark plan, so abuse can at worst exhaust the daily free quota, never cost money. If that ever happens, turn on [App Check](https://firebase.google.com/docs/app-check).
- **Real secrets never go in the repo.** That means service-account keys (`.gitignore` blocks the usual file names; keep them in `~/keys/`), Slack or Luma tokens, and anything else that grants access. If one is ever committed, revoke it in its console first, then clean up the repo.

## 2026-27 launch checklist

Moving to the new project also gets the site off the old one, whose rules let anyone download every submitter's email. Arinze has to lock or delete that project to close the leak (step 7).

1. **Enable Google sign-in** (console → Authentication → Sign-in method → Google), and add the domains above under Authorized domains.
2. **Deploy the rules** with `firebase deploy --only firestore:rules`. (Done 2026-11-08.)
3. **Migrate.** This reads last year's posts from the old project's public API and writes them here. Download a service-account key for **this** project (Project settings → Service accounts → Generate new private key) to a folder **outside this repo**, then:
   ```bash
   cd scripts && npm install
   export GOOGLE_APPLICATION_CREDENTIALS=~/keys/claudeatstanford-admin.json
   node migrate-2026.mjs --dry-run
   node migrate-2026.mjs
   ```
4. **Add yourself to `leads`**, then test on `localhost` in your own browser: sign in, submit, edit, heart, delete, and moderate.
5. **Re-run the migration** right before merging. It skips posts it already copied and picks up anything posted on the old site in the meantime.
6. **Merge** the PR. Vercel deploys to production.
7. **Ask Arinze to lock or delete the old `claude-at-stanford` project**, or at least deny reads on `projects` and `library`. This is the step that closes the email leak.
8. Delete the service-account key (Google Cloud console → IAM → Service accounts → Keys) once you no longer need it.

## History

The original single-page site was built in February 2026 by Arinze Obiezue with Claude Code. See [docs/2025-26-build-report.md](docs/2025-26-build-report.md). The 2026-27 rebuild split it into pages and data files, moved private data out of public documents, and added Events, Learn, Perks, the Archive and lead moderation.
