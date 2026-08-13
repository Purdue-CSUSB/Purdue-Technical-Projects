// Public, non-secret values that don't change between environments, so they live in code rather
// than .env. .env is reserved for secrets and per-deployment connection details.
//
// KEEP IN SYNC WITH frontend/src/config.js, which declares the same values for the browser
// half. They are duplicated rather than shared because frontend/ and backend/ are separate
// workspaces; if you change one, change the other.

// Email domain allowed to register. This is the real gate - the identical check in the frontend
// is only a UX shortcut that saves a round trip.
export const ALLOWED_EMAIL_DOMAIN = '@purdue.edu';

// The categories a project can be filed under, on both boards. This is the real gate - the
// identical list in the frontend only decides which radio buttons and filter chips are drawn.
export const PROJECT_CATEGORIES = ['personal-project', 'class-project', 'hackathon', 'other'];

// Whether a showcase project is still being worked on.
export const PROJECT_STATUSES = ['active', 'completed'];

export const MAX_TAGS = 10;
export const MAX_MEMBERS = 20;
export const MAX_TECH_STACK = 12;

// Largest decoded image accepted per project. The form downscales before uploading, so this is
// a backstop against a hand-crafted request rather than a limit real submissions approach.
// Kept well under both Vercel's 4.5 MB request cap and MongoDB's 16 MB document cap.
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// Per-account caps, so one person can't crowd out either board. Admins are exempt.
// The showcase is a permanent record of work someone actually finished, so it is the more
// generous of the two; an open listing is a live recruiting post and there is no good reason to
// be running many at once.
export const SHOWCASE_LIMIT = 10;
export const OPEN_PROJECT_LIMIT = 3;
