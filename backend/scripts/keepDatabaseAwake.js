// Standalone entry point for the database keepalive: `npm run keepalive`.
//
// Why this exists: MongoDB Atlas pauses a free cluster after 30 days without a connection, and
// a paused cluster refuses ALL connections until a human clicks Resume in the dashboard - it
// does not wake itself when traffic arrives. This mattered less when the API was one always-on
// Express process; a serverless deployment only touches Mongo when somebody visits, so over a
// quiet summer the site can genuinely go 30 days without a single connection. Then every API
// route starts returning 500 while the static pages keep loading normally.
//
// It deliberately goes through the public HTTP endpoint rather than connecting with the driver:
//   - GET /api/projects already reads MongoDB, so serving it resets Atlas's idle timer.
//   - No database credential has to be stored wherever this runs.
//   - It exercises the whole path (Vercel function -> Atlas), so it doubles as an uptime check.
//     A direct driver connection would prove only that Atlas itself is reachable.
import { requireEnv } from '../lib/env.js';

const ENDPOINT = '/api/projects';
const ATTEMPTS = 5;
const RETRY_DELAY_MS = 10_000;
const TIMEOUT_MS = 30_000;

// GitHub renders ::error:: annotations on the run summary; locally it would just be noise.
const inGitHubActions = process.env.GITHUB_ACTIONS === 'true';

function reportFailure(message) {
  if (inGitHubActions) {
    console.error(`::error title=Keepalive failed::${message}`);
  } else {
    console.error(`Keepalive failed: ${message}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One attempt. A 200 alone isn't proof the database answered, so this also requires the JSON
 * array the handler returns: if Mongo were unreachable the endpoint would 500, and a misrouted
 * request (e.g. falling through to the SPA's index.html) would return HTML with a 200.
 */
async function pingOnce(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'user-agent': 'purdue-technical-projects-keepalive' },
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} - ${body.slice(0, 300)}`);
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(
      `responded 200 but the body was not JSON, so MongoDB was probably not reached. ` +
      `Check SITE_URL points at the deployed site. Body starts: ${body.slice(0, 200)}`
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(`responded with JSON but not the expected array: ${body.slice(0, 200)}`);
  }

  return data.length;
}

export async function runKeepAlive() {
  const baseUrl = requireEnv('SITE_URL').replace(/\/+$/, '');
  const url = `${baseUrl}${ENDPOINT}`;
  console.log(`GET ${url}`);

  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const count = await pingOnce(url);
      return { message: `OK - board returned ${count} project(s); MongoDB was reached.` };
    } catch (error) {
      lastError = error;
      console.warn(`  attempt ${attempt}/${ATTEMPTS} failed: ${error.message}`);
      // Retries absorb a cold start or a brief blip rather than failing the whole run.
      if (attempt < ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

runKeepAlive()
  .then((result) => {
    console.log(result.message);
    process.exit(0);
  })
  .catch((error) => {
    reportFailure(
      `${error.message} - MongoDB was NOT touched. If this keeps failing, Atlas will pause ` +
      `after 30 idle days and every API route will start returning 500.`
    );
    process.exit(1);
  });
