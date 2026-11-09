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
firebase emulators:start --only auth,firestore --project claude-at-stanford
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

Project: `claude-at-stanford`. Sign-in is Google, restricted to `@stanford.edu`, and enforced in both the client and the rules.

| Collection | Who can read | Notes |
|---|---|---|
| `builds` | everyone (published), owner and leads (hidden) | community builds |
| `resources` | same | shown as "Library" |
| `users` | the user and leads | private submitter emails |
| `leads` | each lead's own doc; leads can list | lead allowlist |

### Adding a lead

In the Firebase console go to Firestore → `leads` → **Add document**. Set the document ID to the person's lowercase `@stanford.edu` email and add a field `role` (string). They'll see **Moderation** in their account menu after their next sign-in. The `/admin` page lets leads feature, hide or delete posts, email a poster, and export everything as JSON.

### Rules

The rules live in `firebase/firestore.rules` and are deployed with the Firebase CLI:

```bash
firebase login
firebase deploy --only firestore:rules
```

To test them against the local emulator (needs Java 11+):

```bash
cd firebase && npm install && npm test
```

### Sign-in on new domains

Firebase only allows sign-in from domains listed under Authentication → Settings → **Authorized domains**. `localhost`, `claudeatstanford.org` and `stanfordclaude.vercel.app` need to be there. Add a Vercel preview domain too if you want to test sign-in on a PR preview.

## 2026-27 launch checklist

The 2026-27 rebuild moved data from the old collections (`projects`, `library`) to new ones (`builds`, `resources`, `users`). The old rules made every submitter's email publicly readable, and finishing this checklist closes that.

1. **Back up the current rules.** Copy them from Firestore → Rules in the console. The console also keeps a history.
2. **Deploy the transitional rules** (`firebase deploy --only firestore:rules`). These are the new rules plus a `LEGACY` block that keeps the old site working.
3. **Migrate.** Download a service-account key (Project settings → Service accounts) to a folder **outside this repo**, then:
   ```bash
   cd scripts && npm install
   export GOOGLE_APPLICATION_CREDENTIALS=~/keys/claude-at-stanford.json
   node migrate-2026.mjs --dry-run
   node migrate-2026.mjs
   ```
4. **Test the PR preview**: browse, sign in, submit, edit, heart, delete. Add yourself to `leads` and try moderation.
5. **Re-run the migration** right before merging (it skips docs it already copied) to pick up anything posted on the old site in the meantime.
6. **Merge** the PR. Vercel deploys to production.
7. **Delete the `LEGACY` block** in `firebase/firestore.rules`, redeploy the rules, and commit. This is the step that closes the email leak.
8. After a few weeks with no issues, delete the old `projects` and `library` collections and the service-account key.

## History

The original single-page site was built in February 2026 by Arinze Obiezue with Claude Code. See [docs/2025-26-build-report.md](docs/2025-26-build-report.md). The 2026-27 rebuild split it into pages and data files, moved private data out of public documents, and added Events, Learn, Perks, the Archive and lead moderation.
