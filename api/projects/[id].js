import { getDb, ObjectId, PROJECTS_COLLECTION } from '../../backend/lib/db.js';
import { bodyTooLarge, clientIp, methodGuard, withErrorHandling } from '../../backend/lib/http.js';
import { requireAuth } from '../../backend/lib/auth.js';
import { enforceRateLimit } from '../../backend/lib/rateLimit.js';
import { moderateProject, parseProjectInput } from '../../backend/lib/projectInput.js';

// PUT edits a showcase project; DELETE removes it. Both are owner-or-admin.
//
// Matches the cap on api/submit.js, since an edit can carry a replacement image.
const MAX_SUBMISSION_BYTES = 3.5 * 1024 * 1024;

// Reads the project named by the URL and checks the caller is allowed to change it.
// Returns { project, collection, objectId } or null once it has already answered the request.
async function loadEditable(req, res, user) {
  const { id } = req.query;
  if (typeof id !== 'string' || !ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid project id.' });
    return null;
  }

  const db = await getDb();
  const collection = db.collection(PROJECTS_COLLECTION);
  const objectId = new ObjectId(id);

  // The image bytes are excluded: this only needs the document's ownership and its other
  // fields, and pulling a megabyte of image into memory to check who owns it is waste.
  const project = await collection.findOne({ _id: objectId }, { projection: { 'image.data': 0 } });
  if (!project) {
    res.status(404).json({ message: 'Project not found.' });
    return null;
  }

  // Projects posted before accounts existed have no userId at all. Nobody can claim one by
  // editing it - only an admin can touch them.
  const isOwner = project.userId && project.userId.toString() === user._id.toString();
  if (!isOwner && !user.isAdmin) {
    res.status(403).json({ message: 'You can only change your own projects.' });
    return null;
  }

  return { project, collection, objectId };
}

export default withErrorHandling('projects:mutate', async (req, res) => {
  if (!methodGuard(req, res, ['PUT', 'DELETE'])) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === 'DELETE') {
    const found = await loadEditable(req, res, user);
    if (!found) return;

    await found.collection.deleteOne({ _id: found.objectId });
    return res.status(200).json({ message: 'Project deleted.' });
  }

  // PUT: edit an existing project.
  if (bodyTooLarge(req, res, MAX_SUBMISSION_BYTES)) return;

  const found = await loadEditable(req, res, user);
  if (!found) return;

  // Same validation as the create path, except the image may be omitted to keep the stored one.
  const parsed = parseProjectInput(req.body, { imageRequired: false });
  if (parsed.error) {
    return res.status(400).json(parsed.error);
  }
  const fields = parsed.fields;

  if (!user.isAdmin) {
    if (!(await enforceRateLimit(res, 'submit', [clientIp(req), user._id.toString()]))) return;
  }

  // Edits are moderated too - otherwise a clean submission could be rewritten into anything.
  const moderation = await moderateProject(fields);
  if (moderation.error) {
    const isRejection = moderation.error.stage === 'moderation';
    return res.status(isRejection ? 400 : 500).json(moderation.error);
  }

  // Only the fields the form owns are written. userId, email, featured and created_at are
  // deliberately absent, so an edit can never reassign a project, forge its age, or un-hide a
  // project an admin had taken off the board.
  const updates = { ...fields, updated_at: new Date() };
  await found.collection.updateOne({ _id: found.objectId }, { $set: updates });

  const { image, email: _accountEmail, userId: _userId, ...saved } = { ...found.project, ...updates };

  return res.status(200).json({
    message: 'Project updated.',
    stage: 'ok',
    // Mirrors what api/submit.js returns: metadata only, since the bytes are served separately.
    project: { ...saved, image: image ? { contentType: image.contentType } : undefined }
  });
});
