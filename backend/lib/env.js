// Every configurable value comes from the .env at the repo root. There are deliberately no
// fallback defaults anywhere in the code: a missing variable throws here instead of silently
// running on a guessed value, so a half-configured deploy fails visibly rather than, say,
// writing to the wrong database or skipping moderation entirely.
//
// This is the only place env vars are read. If you need a new setting, add it to .env.example
// and read it through requireEnv - do not reach for process.env directly with a `||` default.

function missing(name) {
  return new Error(
    `${name} is not set. Every setting is read from the .env at the repo root - copy ` +
    `.env.example to .env and fill it in, or set ${name} in the Vercel dashboard.`
  );
}

export function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw missing(name);
  }
  return value.trim();
}

export function requireEnvInt(name) {
  const raw = requireEnv(name);
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be a whole number, got "${raw}".`);
  }
  return value;
}
