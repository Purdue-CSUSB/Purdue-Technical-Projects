// Idempotent index setup. Run once after deploy (and any time this file changes):
//   npm run ensure-indexes
//
// createIndex is a no-op when an identical index already exists, so re-running is safe.
//
// These used to be declared on the mongoose schema, which created them lazily from whichever
// process happened to connect first. There is no long-lived process any more, so they are
// created deliberately here instead.
import { getMongoClient, getDb, PROJECTS_COLLECTION, OPEN_PROJECTS_COLLECTION } from '../lib/db.js';
import { USERS_COLLECTION } from '../lib/auth.js';

async function main() {
  const db = await getDb();

  // Unique email is the actual guard against duplicate accounts. Signup depends on this index
  // raising E11000, which api/auth/signup.js turns back into its 409 - a read-then-write check
  // instead would leave a race window where two concurrent signups both pass.
  await db.collection(USERS_COLLECTION).createIndex(
    { email: 1 },
    { unique: true, name: 'users_email_unique' }
  );
  console.log('users.email                unique index ready');

  // --- Showcase board ---------------------------------------------------------------------
  // Read in created_at order on every visit.
  await db.collection(PROJECTS_COLLECTION).createIndex(
    { created_at: -1 },
    { name: 'projects_created_at_desc' }
  );
  console.log('projects.created_at        index ready');

  // Both filters the showcase offers.
  await db.collection(PROJECTS_COLLECTION).createIndex(
    { featured: 1, created_at: -1 },
    { name: 'projects_featured_created_at' }
  );
  console.log('projects.featured          index ready');

  await db.collection(PROJECTS_COLLECTION).createIndex(
    { category_id: 1 },
    { name: 'projects_category' }
  );
  console.log('projects.category_id       index ready');

  // /api/projects/mine and the per-account posting cap both filter by owner.
  await db.collection(PROJECTS_COLLECTION).createIndex(
    { userId: 1, created_at: -1 },
    { name: 'projects_userId_created_at' }
  );
  console.log('projects.userId            index ready');

  // --- Open board -------------------------------------------------------------------------
  await db.collection(OPEN_PROJECTS_COLLECTION).createIndex(
    { createdAt: -1 },
    { name: 'open_projects_createdAt_desc' }
  );
  console.log('open_projects.createdAt    index ready');

  await db.collection(OPEN_PROJECTS_COLLECTION).createIndex(
    { userId: 1, createdAt: -1 },
    { name: 'open_projects_userId_createdAt' }
  );
  console.log('open_projects.userId       index ready');

  // --- Rate limiting ----------------------------------------------------------------------
  // Lets Mongo expire rate-limit windows on its own. expireAfterSeconds: 0 means "delete once
  // the date in expiresAt has passed", so lib/rateLimit.js never has to sweep old buckets.
  await db.collection('rate_limits').createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'rate_limits_ttl' }
  );
  console.log('rate_limits.expiresAt      TTL index ready');
}

main()
  .then(async () => {
    console.log('\nAll indexes are in place.');
    await (await getMongoClient()).close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Failed to create indexes:', error.message);
    // A pre-existing duplicate email will fail the unique index build - report it usefully.
    if (error?.code === 11000) {
      console.error('\nThere are already duplicate emails in the users collection. Remove the');
      console.error('duplicates, then re-run this script.');
    }
    try {
      await (await getMongoClient()).close();
    } catch {
      // Nothing useful to do if teardown also fails.
    }
    process.exit(1);
  });
