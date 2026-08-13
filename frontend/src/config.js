// Public, non-secret values that don't change between environments, so they live in code rather
// than .env. The frontend reads no environment variables at all: nothing secret can leak into
// the browser bundle because nothing secret is ever handed to it.
//
// KEEP IN SYNC WITH backend/lib/constants.js, which declares the same limits for the server
// half. They are duplicated rather than shared because frontend/ and backend/ are separate
// workspaces; if you change one, change the other. The server's copy is the one that actually
// rejects an over-limit submission - everything here is a convenience that saves a round trip.

// Checked before submitting the signup form purely to save a round trip. The server enforces
// the same domain independently - this is a convenience, not a security control.
export const ALLOWED_EMAIL_DOMAIN = '@purdue.edu';

// Matches the server's floor in api/auth/signup.js. bcrypt ignores anything past 72 bytes, so
// the server caps there too; the form doesn't bother repeating a ceiling nobody reaches.
export const MIN_PASSWORD_LENGTH = 8;

// Per-account posting caps. These drive button states and the counts on the account page; the
// server's copies in backend/lib/constants.js are what actually reject an over-limit post.
export const SHOWCASE_LIMIT = 10;
export const OPEN_PROJECT_LIMIT = 3;

export const MAX_TECH_STACK = 12;

// How long an open listing may accept applications for, offered in the form's dropdown.
export const TIME_COMMITMENTS = ['1-5 hrs/wk', '5-10 hrs/wk', '10-15 hrs/wk', '15+ hrs/wk', 'Flexible'];

// The categories a project can be filed under, in the order they appear in the filter row and
// the submission form. `other` is deliberately absent: nothing offers it, but projects created
// before the form had a category picker carry it, so getCategoryLabel below still names it.
export const PROJECT_CATEGORIES = [
  { value: 'personal-project', label: 'Personal Projects', singular: 'Personal Project' },
  { value: 'class-project', label: 'Class Projects', singular: 'Class Project' },
  { value: 'hackathon', label: 'Hackathon Projects', singular: 'Hackathon Project' }
];

export const PROJECT_STATUSES = [
  { value: 'active', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' }
];

export const MAX_TAGS = 10;
export const MAX_MEMBERS = 20;

// What the file picker accepts. Anything this size is downscaled before it is uploaded (see
// lib/imageUpload.js), so this is about what someone may reasonably drag in, not what travels.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Longest edge of the image actually sent to the server. Cards render it at roughly 640px wide
// on the largest screens, so 1600 leaves room for a retina display and nothing beyond it.
export const IMAGE_MAX_DIMENSION = 1600;
