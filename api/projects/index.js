import { getDb, PROJECTS_COLLECTION } from '../../backend/lib/db.js';
import { methodGuard, withErrorHandling } from '../../backend/lib/http.js';

// The public board. Replaces GET /api/projects on the old Express server.
export default withErrorHandling('projects:list', async (req, res) => {
  if (!methodGuard(req, res, 'GET')) return;

  const db = await getDb();

  const projects = await db.collection(PROJECTS_COLLECTION)
    .find({})
    // SECURE PROJECTION: 0 means hide this field from the public response.
    //
    // `email` is the POSTER'S ACCOUNT ADDRESS and must never reach the unauthenticated board -
    // unlike the open board's contactEmail, nobody typed it in expecting it to be published.
    // `userId` is hidden with it so ownership can't be read off the public list either.
    //
    // The image bytes go too, but for a different reason: every project carries a few hundred KB
    // of image, so a board of thirty would be a multi-megabyte JSON response that has to arrive
    // in full before a single card can render. Cards request /api/projects/:id/image instead,
    // which the browser fetches in parallel, caches for a year, and only for what is on screen.
    .project({ email: 0, userId: 0, 'image.data': 0 })
    .sort({ created_at: -1 })
    .toArray();

  return res.status(200).json(projects);
});
