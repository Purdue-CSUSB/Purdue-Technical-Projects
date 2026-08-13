import { getDb, ObjectId, PROJECTS_COLLECTION } from '../../../backend/lib/db.js';
import { methodGuard, withErrorHandling } from '../../../backend/lib/http.js';

// Serves one project's image. The board's JSON deliberately omits the bytes (see
// api/projects/index.js), so this is what every card's <img> actually points at.

// The driver hands binary back as a BSON Binary, mongoose used to hand back a Node Buffer, and
// documents written by either are still in the collection - so normalise both.
function toBuffer(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  // A typed array: copy the exact window it describes, not its whole backing ArrayBuffer.
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  // BSON Binary, whose .buffer is itself a Uint8Array.
  if (value.buffer) return Buffer.from(value.buffer);
  return null;
}

export default withErrorHandling('projects:image', async (req, res) => {
  if (!methodGuard(req, res, 'GET')) return;

  const { id } = req.query;
  if (typeof id !== 'string' || !ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid project id.' });
  }

  const db = await getDb();
  const project = await db.collection(PROJECTS_COLLECTION).findOne(
    { _id: new ObjectId(id) },
    { projection: { image: 1 } }
  );

  const data = toBuffer(project?.image?.data);
  if (!data || data.length === 0) {
    // Deliberately uncached, unlike the success path below. A project posted before images
    // were required has none, and caching that answer for a year would keep an empty tile on
    // the card long after somebody backfilled it.
    return res.status(404).json({ message: 'Image not found.' });
  }

  // A project's image is never edited, and the URL is keyed by the document id, so the bytes at
  // this address genuinely cannot change - which is exactly what `immutable` promises. Set here
  // rather than in vercel.json so the 404 above doesn't inherit a year-long cache.
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Type', project.image.contentType || 'application/octet-stream');
  res.setHeader('Content-Length', String(data.length));
  return res.status(200).send(data);
});
