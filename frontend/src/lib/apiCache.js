// A tiny in-memory cache for GET responses, so leaving a page and coming back doesn't re-hit
// the database for data we already have. The home page and the projects page read the same
// board, so without this a visitor moving between them queried Mongo twice for one list.
//
// Module scope on purpose: a route change unmounts the page component, so anything held in its
// state is gone by the time the user navigates back. This lives outside React and survives.
// It is memory only - a refresh starts clean, which is the behaviour we want, since a hard
// reload is how someone asks for genuinely current data.
//
// The read pattern is stale-while-revalidate: render whatever is cached immediately (no
// spinner), and refetch in the background only once the entry is past FRESH_MS.

const store = new Map();

// In-flight requests, keyed the same way, so two callers asking for the same thing at the same
// moment share one round trip instead of racing. This is not just a dev-mode concern: React's
// StrictMode double-invokes effects, but so does a cold serverless function taking a second to
// answer while the visitor clicks through to another page.
const inflight = new Map();

// Incremented whenever the cache is cleared. A response that was already in the air when the
// account changed belongs to the previous session, so it must not be written afterwards.
let generation = 0;

// How long an entry is trusted without a background refetch.
export const FRESH_MS = 60_000;

export const CACHE_KEYS = {
  projects: 'projects',
  openProjects: 'open-projects',
  // Per-account, so one user's own posts can never be shown to the next person signed in.
  myProjects: (email) => `projects:mine:${email ?? 'anonymous'}`,
  myOpenProjects: (email) => `open-projects:mine:${email ?? 'anonymous'}`
};

export function readCache(key) {
  return store.get(key) ?? null;
}

export function writeCache(key, data) {
  store.set(key, { data, fetchedAt: Date.now() });
}

// Apply a local change (a project that was just posted) to a cached list without a round trip.
// A no-op when nothing is cached, since the next read will fetch the list fresh anyway. The
// timestamp is left alone: a local insert doesn't make the rest of the list any newer.
export function mutateCache(key, update) {
  const entry = store.get(key);
  if (!entry) return;
  store.set(key, { data: update(entry.data), fetchedAt: entry.fetchedAt });
}

export function isStale(entry, ttl = FRESH_MS) {
  return !entry || Date.now() - entry.fetchedAt > ttl;
}

// Run `fetcher` and store the result under `key`, collapsing concurrent calls into one request
// and resolving them all with the same data. Returns the fetched data.
export function revalidate(key, fetcher) {
  const existing = inflight.get(key);
  if (existing) return existing;

  const startedAt = generation;
  const request = (async () => {
    const data = await fetcher();
    // Dropped if the account changed while this was in flight - see `generation` above.
    if (startedAt === generation) writeCache(key, data);
    return data;
  })().finally(() => {
    if (inflight.get(key) === request) inflight.delete(key);
  });

  inflight.set(key, request);
  return request;
}

// Called whenever the signed-in account changes. Anything cached belonged to the previous
// session, including the public boards: an admin sees the same rows but acts on them
// differently, and a stale count would misreport the per-account posting caps.
export function clearCache() {
  store.clear();
  inflight.clear();
  generation += 1;
}
