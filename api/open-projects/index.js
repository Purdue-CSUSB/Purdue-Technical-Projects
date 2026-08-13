import { getDb, OPEN_PROJECTS_COLLECTION } from '../../backend/lib/db.js';
import { requireAuth } from '../../backend/lib/auth.js';
import { enforceRateLimit } from '../../backend/lib/rateLimit.js';
import { bodyTooLarge, clientIp, methodGuard, withErrorHandling } from '../../backend/lib/http.js';
import { OPEN_PROJECT_LIMIT } from '../../backend/lib/constants.js';
import { moderateOpenProject, parseOpenProjectInput } from '../../backend/lib/openProjectInput.js';

// The open board: projects still being built, looking for people to join.
//   GET  - public listing
//   POST - create one (requires a verified account)

async function list(req, res) {
  const db = await getDb();

  const projects = await db.collection(OPEN_PROJECTS_COLLECTION)
    .find({})
    // SECURE PROJECTION: 0 means hide this field from the public response. `email` is the
    // poster's ACCOUNT address and is internal only - the address applicants should write to is
    // `contactEmail`, which the poster typed into the form knowing it would be published.
    // `userId` is hidden too, so ownership can't be read off the public board.
    .project({ email: 0, userId: 0 })
    .sort({ createdAt: -1 })
    .toArray();

  return res.status(200).json(projects);
}

async function create(req, res) {
  if (bodyTooLarge(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  // The poster's identity comes from the authenticated account, never from the request body.
  const parsed = parseOpenProjectInput(req.body);
  if (parsed.error) {
    return res.status(400).json(parsed.error);
  }
  const fields = parsed.fields;

  // Rate limited after validation so a typo doesn't burn a slot, and before moderation so the
  // Groq call can't be spammed. Admins are exempt - trusted accounts, not the abuse this guards.
  if (!user.isAdmin) {
    if (!(await enforceRateLimit(res, 'submit', [clientIp(req), user._id.toString()]))) return;
  }

  const db = await getDb();
  const collection = db.collection(OPEN_PROJECTS_COLLECTION);

  // Checked before moderation, not after: somebody already at the cap cannot succeed no matter
  // what the model says, so spending a Groq call to tell them that is pure waste - and they get
  // the useful answer immediately instead of after a round trip.
  if (!user.isAdmin) {
    const existing = await collection.countDocuments({ userId: user._id });
    if (existing >= OPEN_PROJECT_LIMIT) {
      return res.status(400).json({
        message: `You can only have ${OPEN_PROJECT_LIMIT} open listings at a time. Close one from your account to post another.`,
        stage: 'limit'
      });
    }
  }

  const moderation = await moderateOpenProject(fields);
  if (moderation.error) {
    // A rejection is the poster's to fix (400); the model being unreachable is ours (500).
    const isRejection = moderation.error.stage === 'moderation';
    return res.status(isRejection ? 400 : 500).json(moderation.error);
  }

  const newProject = {
    ...fields,
    userId: user._id,
    email: user.email, // account address: stored, never returned to the public board
    createdAt: new Date()
  };

  await collection.insertOne(newProject);

  // Echo the saved document back minus the private account email, so the client can render the
  // new card immediately with its real _id rather than inventing a placeholder.
  const { email: _accountEmail, userId: _userId, ...saved } = newProject;

  return res.status(200).json({
    message: 'Listing approved and posted.',
    stage: 'ok',
    project: saved
  });
}

export default withErrorHandling('openProjects:index', async (req, res) => {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  return req.method === 'GET' ? list(req, res) : create(req, res);
});
