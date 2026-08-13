import { getDb, ObjectId, OPEN_PROJECTS_COLLECTION } from '../../backend/lib/db.js';
import { bodyTooLarge, clientIp, methodGuard, withErrorHandling } from '../../backend/lib/http.js';
import { requireAuth } from '../../backend/lib/auth.js';
import { enforceRateLimit } from '../../backend/lib/rateLimit.js';
import { moderateOpenProject, parseOpenProjectInput } from '../../backend/lib/openProjectInput.js';

// PUT edits an open listing; DELETE takes it down (which is how a listing is "closed" once the
// team is full). Both are owner-or-admin.

// Reads the listing named by the URL and checks the caller is allowed to change it.
// Returns { project, collection, objectId } or null once it has already answered the request.
async function loadEditable(req, res, user) {
  const { id } = req.query;
  if (typeof id !== 'string' || !ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid listing id.' });
    return null;
  }

  const db = await getDb();
  const collection = db.collection(OPEN_PROJECTS_COLLECTION);
  const objectId = new ObjectId(id);

  const project = await collection.findOne({ _id: objectId });
  if (!project) {
    res.status(404).json({ message: 'Listing not found.' });
    return null;
  }

  // isAdmin comes from the freshly-read user document, not from the JWT, so revoking admin in
  // Mongo takes effect on the next request instead of whenever the old token expired.
  const isOwner = project.userId && project.userId.toString() === user._id.toString();
  if (!isOwner && !user.isAdmin) {
    res.status(403).json({ message: 'You can only change your own listings.' });
    return null;
  }

  return { project, collection, objectId };
}

export default withErrorHandling('openProjects:mutate', async (req, res) => {
  if (!methodGuard(req, res, ['PUT', 'DELETE'])) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === 'DELETE') {
    const found = await loadEditable(req, res, user);
    if (!found) return;

    await found.collection.deleteOne({ _id: found.objectId });
    return res.status(200).json({ message: 'Listing removed.' });
  }

  // PUT: edit an existing listing.
  if (bodyTooLarge(req, res)) return;

  const found = await loadEditable(req, res, user);
  if (!found) return;

  // Same validation as the create path - an edit that skipped it would be a way to write
  // anything you liked by posting something clean and rewriting it afterwards.
  const parsed = parseOpenProjectInput(req.body);
  if (parsed.error) {
    return res.status(400).json(parsed.error);
  }
  const fields = parsed.fields;

  // Rate limited on the same grounds as creating: this path also spends a Groq call, so an edit
  // loop would otherwise be a free way to burn the quota.
  if (!user.isAdmin) {
    if (!(await enforceRateLimit(res, 'submit', [clientIp(req), user._id.toString()]))) return;
  }

  const moderation = await moderateOpenProject(fields);
  if (moderation.error) {
    const isRejection = moderation.error.stage === 'moderation';
    return res.status(isRejection ? 400 : 500).json(moderation.error);
  }

  // Only the fields the form owns are written. userId, email and createdAt are deliberately
  // absent, so an edit can never reassign a listing to somebody else or forge its age.
  const updates = { ...fields, updatedAt: new Date() };
  await found.collection.updateOne({ _id: found.objectId }, { $set: updates });

  const { email: _accountEmail, userId: _userId, ...saved } = { ...found.project, ...updates };

  return res.status(200).json({ message: 'Listing updated.', stage: 'ok', project: saved });
});
