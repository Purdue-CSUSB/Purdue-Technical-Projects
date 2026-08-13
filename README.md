# Purdue Technical Projects

Built by Ryan and Hanako.

The Purdue Undergraduate Student Board's technical projects site. It carries **two boards** plus
directories of technical clubs and campus competitions.

Built as a single Vercel deployment — a static React frontend and a set of serverless functions
that share one origin. It is a sibling of the [USB Research Resources][rr] site and deliberately
shares its design system, its auth flow, and its backend shape.

[rr]: https://github.com/purdue-csusb

## The two boards

They answer different questions, so they are separate collections with deliberately different
schemas. Nothing is shared between them but the category vocabulary.

|  | **Showcase** (`/projects`) | **Open projects** (`/open-projects`) |
|---|---|---|
| For | work you have finished | work you are still building |
| Purpose | show it off | find people to join you |
| Collection | `projects` | `open_projects` |
| Validated by | `backend/lib/projectInput.js` | `backend/lib/openProjectInput.js` |
| Moderated by | `prompts/moderation.md` | `prompts/openProjectModeration.md` |
| Has an image | yes, required | no — there's often nothing to screenshot yet |
| Who worked on it | `members[]` (who built it) | `rolesNeeded` (who is still missing) |
| Technologies | `tags[]` | `techStack[]` |
| Link | `links`, required | `repoUrl`, optional |
| Also carries | `status` | `requirements`, `timeCommitment`, `teamSize`, `deadline`, `manager`, `contactEmail` |
| Per-account cap | 10 | 3 |

The moderation prompts differ because the bar differs: the showcase asks "is this a real project
somebody built", the open board asks "is this a real project genuinely looking for people" — and
must *not* penalise a listing for the project not existing yet, which is the entire point of it.

## Layout

```
api/                          Vercel serverless functions (one file = one endpoint)
  auth/                       signup, verify-email, resend-code, login, me, password reset
  submit.js                   POST   - post to the showcase
  projects/index.js           GET    - the public showcase
  projects/mine.js            GET    - your own showcase posts
  projects/[id].js            PUT    - edit, DELETE - remove (owner or admin)
  projects/[id]/image.js      GET    - one project's image bytes
  open-projects/index.js      GET    - the public open board, POST - create a listing
  open-projects/mine.js       GET    - your own listings
  open-projects/[id].js       PUT/DELETE (owner or admin)
backend/                      Workspace holding the modules those functions share
  lib/                        env, db, auth, mailer, http, rate limiting, validation, moderation
  prompts/                    The LLM moderators' system prompts, editable without touching code
  scripts/                    One-off and scheduled maintenance jobs
frontend/                     Vite + React 19 + Tailwind v4 single-page app
  src/components/ui/          The shared design system (Button, Card, Field, ModalShell, ...)
  src/context/                Auth provider and the useAuth hook
```

## Accounts

Posting to either board requires a verified account; browsing both is public. The flow matches
Research Resources: a `@purdue.edu` address, a 6-digit code emailed via SMTP, and a self-serve
password reset on the same mechanism.

A few things that are load-bearing rather than incidental:

- **Codes are stored hashed**, never in plaintext, and compared in constant time. Anyone with
  read access to the `users` collection could otherwise read a live code and take over an
  account mid-flow.
- **The JWT payload does not carry `isAdmin`.** Privileges are re-read from Mongo on every
  request that needs them, so demoting or deleting an account takes effect immediately rather
  than whenever the old token happened to expire.
- **Login answers identically** for an unknown email and a wrong password, and compares against
  a dummy hash when no account exists so the timing matches too. Password reset likewise never
  reveals whether an address is registered.
- **Ownership is checked server-side on every mutation.** The public board omits `userId`
  entirely, so which cards offer Edit/Delete is a UI convenience, not the control.

## Running it locally

```bash
npm install
cp .env.example .env        # then fill it in - see below
```

Same two commands as the Research Resources site — the backend from the repo root, the frontend
from its own workspace:

```bash
npm run api                 # terminal 1, repo root: vercel dev, API on :3000
cd frontend && npm run dev  # terminal 2:            vite, site on :5173, proxies /api to :3000
```

Then open <http://localhost:5173>.

The frontend alone is enough for anything that doesn't touch the API — clubs, events, styling,
the submission form's layout. The board just shows its empty state.

The USB Research Resources site's `vercel dev` also defaults to port 3000, so don't run both at
once: whichever starts first takes the port, and this board would quietly fill up with the other
site's documents. Run one at a time, or start this one with `npx vercel dev --listen 3001` and
change the proxy target in `frontend/vite.config.js` to match.

Check the database connection, then create the indexes:

```bash
npm run check-db          # is MONGODB_URI actually usable?
npm run ensure-indexes    # once per database
```

`check-db` exists because Atlas answers nearly every misconfiguration with the same opaque
`bad auth : authentication failed` — a typo, an unencoded `@` in the password, a user on the
wrong cluster, and the `<db_password>` placeholder never being replaced all look identical. It
reports which, and never prints the password.

`ensure-indexes` is not optional: signup depends on the unique index on `users.email` raising a
duplicate-key error, since a read-then-write check would leave a race window instead.

## Configuration

Every setting is read from the `.env` at the repo root, through `backend/lib/env.js`. There are
no fallback defaults anywhere: a missing variable throws a named error rather than letting a
half-configured deploy run on a guess. See `.env.example` for the full list — MongoDB, Groq, the
JWT signing secret, SMTP, and `SITE_URL` (which only the keepalive script reads).

**SMTP is not optional.** Verification codes and password resets go through it, so without it
nobody can finish signing up — and the mailer throws rather than quietly skipping, because a
silent skip produces accounts nobody can ever verify while the API still answers 200.

The frontend reads **no** environment variables at all. Its handful of public settings are plain
constants in `frontend/src/config.js`, so nothing secret can be inlined into the browser bundle
by accident. Anything that has to agree across the two halves is duplicated between that file
and `backend/lib/constants.js`, with a comment on each saying so.

## How a submission is handled

Both boards run the same pipeline, and each step is deliberately placed:

1. **Method and body-size guards.** The showcase image travels inline, so `/api/submit` allows a
   much larger body than the others — but still under Vercel's 4.5 MB hard limit, so an
   oversized request gets a readable error rather than being dropped at the edge.
2. **Authentication.** Both boards require a verified account, and the poster's identity comes
   from the token, never from the request body.
3. **Validation** (`projectInput.js` / `openProjectInput.js`). Types, length caps, the enums,
   and any link's *scheme* — an unvalidated link is rendered as an `href` on a public page, so
   `javascript:` URLs are rejected here.
4. **Image decoding** (`backend/lib/projectImage.js`, showcase only). The declared MIME type is
   never trusted; the content type stored is the one sniffed from the file's own magic bytes, so
   this origin can't be made to serve an HTML document announced as a PNG.
5. **Rate limiting** (`backend/lib/rateLimit.js`), 5/hour keyed on IP *and* account. Placed
   after validation so a typo doesn't burn a slot, and before moderation so the Groq call can't
   be spammed. The counters live in MongoDB with a TTL index, because per-process memory doesn't
   work when every lambda instance has its own.
6. **Per-account cap**, checked before moderation: somebody already at their limit cannot
   succeed no matter what the model says, so spending a Groq call to tell them that is waste.
7. **LLM moderation.** The model answers with a single `1` or `0`. It **fails closed**: only an
   explicit `1` approves, so a blank, garbled, or refused reply rejects. The submission is
   wrapped in `<submission>` tags and the prompt tells the model to treat everything inside as
   data, never instructions.
8. **Save.** An approved post is live immediately — moderation *is* the approval step.

Edits run the same validation and moderation as creates. Otherwise posting something clean and
rewriting it afterwards would be a way to publish anything at all.

A rejection is a 400 with `stage: "moderation"`; the model being unreachable is a 500 with
`stage: "moderation-unavailable"`. The two are distinct because the first is the submitter's to
fix and the second is ours.

### Images

Submitted images are downscaled *in the browser* (`frontend/src/lib/imageUpload.js`) to at most
1600px on the long edge and re-encoded as WebP, falling back to JPEG. A 9 MB phone photo becomes
a couple of hundred KB before it ever leaves the page, which is what makes an inline upload
viable inside a serverless request at all.

They are stored in MongoDB alongside the project and served by `GET /api/projects/:id/image`.
The board's JSON omits the bytes, so cards fetch them in parallel and the browser caches them
for a year — a project's image never changes, and the URL is keyed by document id.

## Keeping the database awake

MongoDB Atlas pauses a free cluster after 30 days without a connection, and a paused cluster
refuses all connections until somebody clicks Resume. The serverless API only touches Mongo when
somebody visits, so a quiet summer could genuinely reach that. `.github/workflows/keep-database-awake.yml`
sends one request a day through the public endpoint. Set `SITE_URL` as a repository *variable*
(Settings → Secrets and variables → Actions → Variables).

Note that GitHub disables scheduled workflows on public repos after 60 days with no new commits.

## Design

The palette, typography and motion vocabulary come from [purdueusb.com][usb] and are shared with
the Research Resources site: `#FFCA44` gold, `#333333` charcoal, Montserrat for headings and
Raleway for body text, on a warm off-white page. Tokens are declared in an `@theme` block in
`frontend/src/index.css` — Tailwind v4 no longer auto-loads a `tailwind.config.js`, so tokens
defined there would emit no CSS at all.

Fonts are self-hosted via `@fontsource` rather than loaded from Google Fonts, because
`vercel.json` sets a Content-Security-Policy with `font-src 'self' data:` that would block a CDN
request outright.

[usb]: https://purdueusb.com/
