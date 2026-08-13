import { getDb, PROJECTS_COLLECTION } from '../../backend/lib/db.js';
import { methodGuard, withErrorHandling } from '../../backend/lib/http.js';
import { requireAuth } from '../../backend/lib/auth.js';

// Authenticated: the caller's own showcase projects. Drives the account page and tells the
// board which cards to offer Edit/Delete on - the public list omits userId, so ownership can't
// be read from it.
//
// Note: `mine` is a static route, so Vercel matches /api/projects/mine here rather than falling
// through to the [id] dynamic segment beside it.
export default withErrorHandling('projects:mine', async (req, res) => {
  if (!methodGuard(req, res, 'GET')) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const db = await getDb();

  const projects = await db.collection(PROJECTS_COLLECTION)
    .find({ userId: user._id })
    // Image bytes excluded for the same reason as the public board: the card fetches them
    // separately from /api/projects/:id/image. The account email is dropped too.
    .project({ 'image.data': 0, email: 0 })
    .sort({ created_at: -1 })
    .toArray();

  return res.status(200).json(projects);
});
