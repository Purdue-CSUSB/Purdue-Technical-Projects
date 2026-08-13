import { getDb, PROJECTS_COLLECTION } from '../backend/lib/db.js';
import { requireAuth } from '../backend/lib/auth.js';
import { enforceRateLimit } from '../backend/lib/rateLimit.js';
import { bodyTooLarge, clientIp, methodGuard, withErrorHandling } from '../backend/lib/http.js';
import { SHOWCASE_LIMIT } from '../backend/lib/constants.js';
import { moderateProject, parseProjectInput } from '../backend/lib/projectInput.js';

// Posting a finished project to the showcase. This was POST /api/projects on the old Express
// server, behind multer; it now lives at its own path because the shape of the request changed
// (JSON with an inline image rather than multipart/form-data) and the work it does - authorise,
// validate, rate limit, moderate, save - has nothing in common with listing.
//
// Submissions used to be anonymous. They are tied to an account now, which is what makes a
// showcase post editable and deletable by the person who made it (see api/projects/[id].js).

// Large enough for a downscaled project image encoded as base64 (which costs 4 bytes for every
// 3), with room for the rest of the form on top. Vercel rejects anything over 4.5 MB before the
// function runs at all, so this stays under that in order to answer with a readable message.
const MAX_SUBMISSION_BYTES = 3.5 * 1024 * 1024;

export default withErrorHandling('submit:unknown', async (req, res) => {
  if (!methodGuard(req, res, 'POST')) return;
  if (bodyTooLarge(req, res, MAX_SUBMISSION_BYTES)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  // Everything a submission may contain is decided here: field types, length caps, the category
  // and status enums, the link's scheme, and the image's real format. See
  // backend/lib/projectInput.js.
  const parsed = parseProjectInput(req.body);
  if (parsed.error) {
    return res.status(400).json(parsed.error);
  }
  const fields = parsed.fields;

  // Rate limited after validation so a typo doesn't burn a slot, and before moderation so the
  // Groq call can't be spammed. Keyed on the account as well as the IP, so a shared campus NAT
  // doesn't pool everyone into one bucket.
  if (!user.isAdmin) {
    if (!(await enforceRateLimit(res, 'submit', [clientIp(req), user._id.toString()]))) return;
  }

  const db = await getDb();
  const collection = db.collection(PROJECTS_COLLECTION);

  // Checked before moderation: somebody already at the cap cannot succeed no matter what the
  // model says, so spending a Groq call to tell them that is pure waste.
  if (!user.isAdmin) {
    const existing = await collection.countDocuments({ userId: user._id });
    if (existing >= SHOWCASE_LIMIT) {
      return res.status(400).json({
        message: `You can only have ${SHOWCASE_LIMIT} projects on the showcase. Delete one from your account to post another.`,
        stage: 'limit'
      });
    }
  }

  const moderation = await moderateProject(fields);
  if (moderation.error) {
    // A rejection is the submitter's to fix (400); the model being unreachable is ours (500).
    const isRejection = moderation.error.stage === 'moderation';
    return res.status(isRejection ? 400 : 500).json(moderation.error);
  }

  const now = new Date();
  const newProject = {
    ...fields,
    userId: user._id,
    email: user.email, // account address: stored, never returned to the public board
    // `featured` is what the board filters on, and moderation is the approval step: a project
    // that passed is live immediately. It used to default to false and wait for somebody to
    // flip it by hand in Atlas, which is why the old form said "check back in a couple of days".
    featured: true,
    created_at: now,
    updated_at: now
  };

  await collection.insertOne(newProject);

  // Echo the saved project back without the image bytes or the private account email, matching
  // the shape GET /api/projects returns. The real _id is what lets the client render the new
  // card straight away - including its <img src="/api/projects/:id/image">.
  const { image, email: _accountEmail, userId: _userId, ...saved } = newProject;

  return res.status(200).json({
    message: 'Project approved and posted to the board.',
    stage: 'ok',
    project: { ...saved, image: { contentType: image.contentType } }
  });
});
