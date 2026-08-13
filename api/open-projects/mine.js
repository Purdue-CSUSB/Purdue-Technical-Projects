import { getDb, OPEN_PROJECTS_COLLECTION } from '../../backend/lib/db.js';
import { methodGuard, withErrorHandling } from '../../backend/lib/http.js';
import { requireAuth } from '../../backend/lib/auth.js';

// Authenticated: the caller's own open listings. This is what the account page renders and what
// the board uses to decide which cards get Edit/Delete - the public list deliberately omits
// userId, so ownership cannot be read from it.
//
// Note: `mine` is a static route, so Vercel matches /api/open-projects/mine here rather than
// falling through to the [id] dynamic segment beside it.
export default withErrorHandling('openProjects:mine', async (req, res) => {
  if (!methodGuard(req, res, 'GET')) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const db = await getDb();

  const projects = await db.collection(OPEN_PROJECTS_COLLECTION)
    .find({ userId: user._id })
    // Scoped to the requester's own userId, so it is safe to return everything except the
    // stored account email, which the client already knows and never needs back.
    .project({ email: 0 })
    .sort({ createdAt: -1 })
    .toArray();

  return res.status(200).json(projects);
});
