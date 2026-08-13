import { MongoClient, ObjectId } from 'mongodb';
import { requireEnv } from './env.js';

// Re-exported so the handlers in /api never import the driver themselves. That is partly a
// module boundary - everything that knows about MongoDB lives in this workspace - and partly
// resolution: /api is at the repo root, outside both workspaces, so a bare `mongodb` specifier
// there only resolves if npm happens to hoist the package. Going through this file works
// whether it hoists or not.
export { ObjectId };

// Serverless connection reuse. A warm invocation keeps module scope, but `vercel dev` (and
// Vercel's own module reloading) can re-evaluate this file, so the promise is parked on
// globalThis to survive that and avoid rebuilding a pool per request.
//
// This replaces the mongoose connection the old Express server opened once at boot. A lambda
// has no boot: every cold start would otherwise pay for a fresh handshake, and connecting per
// request would exhaust Atlas long before the traffic did.
//
// maxPoolSize is deliberately small: the driver defaults to 100, and enough concurrent lambda
// instances each opening a 100-connection pool will blow past Atlas M0's 500-connection cap
// and start failing requests.
const MONGO_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 10000,
};

function connect() {
  return new MongoClient(requireEnv('MONGODB_URI'), MONGO_OPTIONS).connect();
}

export async function getMongoClient() {
  if (!globalThis.__ptpMongoClientPromise) {
    // Clear a rejected promise so the next request retries, instead of the instance being
    // stuck with a permanently failed connection for the rest of its life.
    globalThis.__ptpMongoClientPromise = connect().catch((error) => {
      globalThis.__ptpMongoClientPromise = undefined;
      throw error;
    });
  }

  return globalThis.__ptpMongoClientPromise;
}

export async function getDb() {
  const client = await getMongoClient();
  return client.db(requireEnv('MONGODB_DB'));
}

// One name, one place. The old code spelled the projects collection out in three separate files.
//
// The two boards are separate collections, not one collection with a `kind` flag. Their
// documents share almost no fields (see the table in backend/lib/openProjectInput.js), they are
// queried independently, and keeping them apart means the existing showcase data was never
// touched when the open board was added.
export const PROJECTS_COLLECTION = 'projects';
export const OPEN_PROJECTS_COLLECTION = 'open_projects';
