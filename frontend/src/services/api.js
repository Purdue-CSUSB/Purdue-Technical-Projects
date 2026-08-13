// Every call the site makes. Relative paths only - the API is served from this same origin by
// the same Vercel deployment, which is what removed the need for the axios instance, the
// VITE_API_BASE_URL that pointed at a Render host, and the CORS allowlist on the other end.

// The API answers with JSON for every outcome, but a cold function that times out at the edge
// can still return HTML - so parse defensively and turn anything unreadable into a message
// that can be shown to a person.
async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: 'The server returned an unexpected response. Please try again.' };
  }
}

export async function getProjects() {
  const response = await fetch('/api/projects');
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(data.message || 'Failed to load projects.');
  }
  return data;
}

/**
 * Posts a new showcase project. Resolves with the saved document on success.
 *
 * Takes `authFetch` from the auth context rather than reading the token itself: that keeps the
 * token in exactly one place, and means an expired session clears itself here the same way it
 * does everywhere else.
 *
 * On a rejection the thrown Error carries the API's `stage`, which is what lets the submit page
 * tell "the moderator said no" from "you're at your limit" from "the moderator was unreachable"
 * - the first two are the submitter's to fix, the last is ours.
 */
export async function submitProject(authFetch, project) {
  const response = await authFetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project)
  });

  const data = await readJson(response);

  if (!response.ok) {
    const error = new Error(data.message || 'Failed to submit project. Please try again.');
    error.stage = data.stage;
    throw error;
  }

  return data;
}
