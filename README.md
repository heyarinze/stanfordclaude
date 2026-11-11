# Claude@Stanford

The site for Claude@Stanford, the Stanford student community building with Claude: **[claudeatstanford.org](https://claudeatstanford.org)**.

Plain HTML, CSS and JavaScript modules with no build step and no npm for the site itself. Vercel serves the repo as-is, and every push to `main` deploys to production. Firebase handles Stanford sign-in and the community data (Builds and Library).

## Updating content (no coding needed)

Most yearly updates are JSON edits you can make in the GitHub web editor. Open a PR, check the Vercel preview link, then merge.

| What | File | Notes |
|---|---|---|
| Slack invite, Luma calendar, academic year | `data/site.json` | See [site.json fields](#sitejson-fields) |
| Team roster | `data/team.json` | Photos go in `assets/img/team/<year>/` (square, ~320px, `.webp` or `.jpg`) |
| Workshops (slides, recordings, code) | `data/workshops.json` | Also holds the "From Anthropic" links on Learn |
| Past years (hackathon winners, old teams) | `data/archive/<year>.json` + add the year to `data/archive/index.json` | |
| Perks page copy | `perks.html` | Search for `PLACEHOLDER`; a ready-made layout is commented out in the file |
| Which builds lead the home page | Moderation page (`/admin`), **Feature** | Featured builds come first, then the most hearted. Until any are featured, the most hearted lead |
| Product and category tags | `assets/js/taxonomy.js` | Older posts keep their tags either way |

### `site.json` fields

- `academicYear`: `"2026-27"`. New posts are tagged with it, and the Builds/Library year filters use it.
- `slackUrl`: the workspace invite link. In Slack, set it to **never expire**. Once it's set, "Join the Slack" becomes the main button on the home page. While it's empty, "Join" buttons point to the join section and the main button leads to the builds instead, so nobody hits a dead end.
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

### `team.json` entry

`members` is a list of these. While it's empty, the Team page says the roster isn't posted yet and shows last year's team from the archive.

```json
{
  "name": "Your Name",
  "role": "Campus Lead",
  "photo": "/assets/img/team/2026-27/your-name.webp",
  "linkedin": "https://www.linkedin.com/in/…",
  "email": "you@stanford.edu",
  "bio": "Optional, one sentence."
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

Then open http://localhost:3000. `serve` handles the clean URLs (`/builds` → `builds.html`) the same way Vercel does. Real sign-in on localhost only works if `localhost` is listed under Firebase Auth → Settings → Authorized domains. New projects don't include it, and Google discourages leaving it on a production project, so prefer the emulators below for day-to-day work.

### Against local emulators (fake accounts, local data)

To try changes without touching the real database, run the Firebase emulators (needs Java, e.g. `brew install openjdk`):

```bash
firebase emulators:start --only auth,firestore
```

Then open http://localhost:3000/?emulator. The flag sticks for that browser tab, and it never activates on a real domain. Sign-in shows the emulator's fake account picker. The emulator starts empty, so add a doc to `leads` (e.g. with the emulator REST API or a quick script) to test moderation.

## How it's put together

The look is a printed programme at night: an ink page and two inks (bone and clay) from the top of every page to the bottom, with Stanford cardinal kept for the phone menu and some posters. The page runs edge to edge with one gutter each side on screens up to 1920px wide. Everything is flat, with no glows, gradients or blur. Headings are set in Gloock and text in Libre Franklin, both from Google Fonts. "Paper" (posters, pop-ups, fields) has square corners and controls are pills. Each build gets a poster: a paper colour and artwork picked by `covers.js` from the post's ID, with the title set on it.

```
*.html                 one file per page; shared header/footer come from <site-header>/<site-footer>
assets/css/            tokens.css (colors, type, spacing; dark only), base.css, components.css
assets/js/
  layout.js            header, nav and footer for every page (edit NAV to add a page)
  firebase.js          Firebase init, Stanford-only Google sign-in, session + lead check
  collection.js        shared gallery engine behind Builds and Library
  builds.js, library.js  field lists, cards and detail views for each gallery
  home.js, events.js, learn.js, team.js, archive.js, admin.js   page scripts
  hackathon.js         past years' data (data/archive/), shared by Home, Events, Team and Archive
  ui.js                safe HTML templating (html``), icons, toasts, dialogs
  covers.js            poster paper and artwork for builds (same result for the same post every time)
data/                  editable content (see above)
firebase/              Firestore security rules + tests
scripts/               one-off maintenance scripts (not deployed), including hero-art.mjs (see below)
docs/                  history (the 2025-26 build report) and the club logo PNG in docs/brand/
```

All user-submitted text is rendered through the `html` tagged template in `ui.js`, which escapes it, and links go through `safeUrl()`, which only allows `http(s)`. Keep it that way.

The drawing on the home page (and on the share image, `assets/img/og-image.jpg`) is the Hoover Tower and Main Quad sketch from the club's original logo, re-inked for the dark page with the windows lit. `node scripts/hero-art.mjs` regenerates it from `docs/brand/logo.png`; it needs Google Chrome and `cwebp`, and you only need it if you want to change the artwork.

## Firebase

Project: **`claudeatstanford`** (owned by William Peracchio's account since 2026-27; the 2025-26 site used Arinze's `claude-at-stanford`). Sign-in is Google. Only `@stanford.edu` accounts can post, and the Firestore rules enforce that. The client-side check just gives a friendly error: any Google account can still create a Firebase Auth user, but the rules won't let it write anything. The web config lives in `assets/js/firebase.js`, and the CLI default is set in `.firebaserc`.

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

**The Firebase web config is public on purpose.** The `apiKey` in `assets/js/firebase.js` names the project to Google; it grants no access to data by itself. Every visitor's browser downloads it (Auth and Firestore Lite both send it on each request), so a static site can't hide it, and rotating it would only publish a new public key. Firebase's guidance: [API keys for Firebase](https://firebase.google.com/docs/projects/api-keys).

**What protects the data:** the Firestore rules (`firebase/firestore.rules`, with tests in `firebase/rules.test.mjs`). Authorized domains only control where the sign-in pop-up may run.

**GitHub's "Google API Key" secret-scanning alert is expected.** After checking the key (below), close it as **Won't fix** with a comment such as: "Firebase web API key, public by design (firebase.google.com/docs/projects/api-keys). API-restricted to Firebase services; data protected by Firestore rules." Don't pick *Revoked*, because it isn't revoked. Don't pick *False positive* either, because the detection is valid.

### Checking the key

In Google Cloud console → APIs & Services → [Credentials](https://console.cloud.google.com/apis/credentials?project=claudeatstanford), open **Browser key (auto created by Firebase)**. Confirm its key string matches the one in `firebase.js`.

1. **API restrictions (the important one).** It should say *Restrict key*, listing only Firebase APIs. That list must include **Identity Toolkit API**, **Token Service API** and **Cloud Firestore API**, and must **not** include the **Generative Language API** (Gemini). Firebase sets this up for keys it creates; don't remove anything. Use a separate key for any non-Firebase API.
2. **Website restrictions (optional, stops other sites from using the key).** Under Application restrictions → Websites, list every origin the site runs on, using exact hostnames:
   - `https://claudeatstanford.org/*`
   - `https://stanfordclaude.vercel.app/*`
   - `https://claudeatstanford.firebaseapp.com/*` (the sign-in pop-up runs here)
   - `http://localhost:3000/*`, only while testing real sign-in locally
   - the exact branch URL of any Vercel preview you test on, e.g. `https://stanfordclaude-git-<branch>-arinzebuilds.vercel.app/*`. Remove it after merging.

   Rules for this list:
   - No wildcards in the middle of a name, and never `*.vercel.app` (that matches every Vercel site).
   - Firestore uses the key too, so a missing origin breaks the whole site there, not just sign-in. Add the same hostnames under Firebase Auth → Authorized domains.
   - Changes take a few minutes to apply.
   - A blocked origin shows up as `auth/requests-from-referer-…-are-blocked` or as a Firestore `permission-denied` "Requests from referer … are blocked". The second looks like a rules problem but isn't.
   - Keep the Firebase SDK at 12.15.0 or newer (this site uses 13.2.0). Older Auth versions don't send a referrer.
   - Scripts can fake a referrer, so this only stops other *websites*.

### Abuse and cost

- The project is on the free **Spark** plan as long as no billing account is linked. Abuse can then only use up free quota: 50k Firestore reads/day, 10 GiB/month transfer, and so on. That would be an outage for real users, not a bill.
- Linking any billing account (even trial credit) moves the project to **Blaze**, where usage is billed and budget alerts don't cap spending. Set budget alerts before doing that.
- To watch usage, check the Firebase console's Usage tabs.
- Stronger protection is [App Check](https://firebase.google.com/docs/app-check). It needs a reCAPTCHA Enterprise key and some setup, so plan it as its own task.

### Real secrets

- Service-account keys, Slack/Luma tokens and anything else that grants access never go in the repo folder. Keep keys in `~/keys/`; `.gitignore` also blocks common key filenames.
- If a real secret is ever committed, revoke it in its own console first, then clean up the repo.
- Deploys go through Git (Vercel's GitHub integration). Don't run `vercel deploy` from a folder that holds keys: the Vercel CLI uploads files `.gitignore` would skip.

## 2026-27 launch checklist

Moving to the new project also gets the site off the old one, whose rules let anyone download every submitter's email. Arinze has to lock or delete that project to close the leak (step 7).

1. **Enable Google sign-in** (console → Authentication → Sign-in method → Google), and add the site's domains under Authorized domains. (Done 2026-11-08.)
2. **Deploy the rules** with `firebase deploy --only firestore:rules`. (Done 2026-11-08.)
3. **Migrate.** This reads last year's posts from the old project's public API and writes them here. Download a service-account key for **this** project (Project settings → Service accounts → Generate new private key) to a folder **outside this repo**, then:
   ```bash
   cd scripts && npm install
   export GOOGLE_APPLICATION_CREDENTIALS=~/keys/claudeatstanford-admin.json
   node migrate-2026.mjs --dry-run
   node migrate-2026.mjs
   ```
   (Done 2026-11-08.)
4. **Add yourself to `leads`**, then test on `localhost` in your own browser: sign in, submit, edit, heart, delete, and moderate. (Done 2026-11-08.)
5. **Re-run the migration** right before merging. It skips posts it already copied and picks up anything posted on the old site in the meantime.
6. **Merge** the PR. Vercel deploys to production.
7. **Ask Arinze to lock or delete the old `claude-at-stanford` project**, or at least deny reads on `projects` and `library`. This is the step that closes the email leak.
8. Check the browser key and close GitHub's secret-scanning alert as **Won't fix** (see Security). Remove `localhost` from Authorized domains once launch testing is done.
9. Delete the service-account key (Google Cloud console → IAM → Service accounts → Keys) once you no longer need it.

## History

The original single-page site was built in February 2026 by Arinze Obiezue with Claude Code. See [docs/2025-26-build-report.md](docs/2025-26-build-report.md). The 2026-27 rebuild split it into pages and data files, moved private data out of public documents, and added Events, Learn, Perks, the Archive and lead moderation.
