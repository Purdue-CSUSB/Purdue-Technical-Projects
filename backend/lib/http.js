// Replacements for the pieces of middleware app.js used to provide. Express handled verb
// routing, body-size limits, compression and a CORS allowlist centrally; on Vercel each
// function is its own entry point, so these are composed per-handler instead.
//
// Note what is NOT here: CORS. The old server ran on Render under its own hostname, so every
// browser request was cross-origin and app.js needed an origin allowlist (which was also the
// source of the recurring "blocked by CORS" bugs). The API is now served from the same origin
// as the site by the same Vercel deployment, so there is no cross-origin request to permit.
// Compression is likewise gone - Vercel's edge does it.

// Was express.json({ limit: '10mb' }), which the old server applied to every route including
// the ones that only ever receive a few hundred bytes.
const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

// Express 404'd unknown verbs on a path for free. A Vercel function is invoked for every
// method, so each handler has to reject the ones it doesn't implement.
export function methodGuard(req, res, allowed) {
  const methods = Array.isArray(allowed) ? allowed : [allowed];
  if (methods.includes(req.method)) {
    return true;
  }

  res.setHeader('Allow', methods.join(', '));
  res.status(405).json({ message: `Method ${req.method} is not allowed on this endpoint.` });
  return false;
}

// `maxBytes` is per-endpoint rather than global: /api/submit carries an inline project image
// and needs megabytes, while everything else should reject anything bigger than a form's worth
// of text. Vercel refuses a request body over 4.5 MB before it ever reaches this code, so any
// limit passed here must stay comfortably under that to produce a readable error instead.
export function bodyTooLarge(req, res, maxBytes = DEFAULT_MAX_BODY_BYTES) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > maxBytes) {
    res.status(413).json({
      message: 'That submission is too large. Please use a smaller image and try again.'
    });
    return true;
  }
  return false;
}

// Vercel's edge sets x-vercel-forwarded-for and x-real-ip after stripping whatever the client
// sent, so they can be trusted. Plain x-forwarded-for is client-appendable and is only used as
// a fallback for local `vercel dev`, where nothing is spoofable that matters anyway.
export function clientIp(req) {
  const vercelForwarded = String(req.headers['x-vercel-forwarded-for'] || '').split(',')[0].trim();
  if (vercelForwarded) return vercelForwarded;

  const realIp = String(req.headers['x-real-ip'] || '').trim();
  if (realIp) return realIp;

  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (forwarded) return forwarded;

  return req.socket?.remoteAddress || 'unknown';
}

// app.js had an error handler that echoed err.message straight back to the client in
// development and, in production, still leaked the Mongo/driver error for any route whose own
// try/catch returned `{ message: err.message }`. Wrapping every handler guarantees a JSON 500
// and keeps internals in the logs rather than the response.
export function withErrorHandling(name, fn) {
  return async function handler(req, res) {
    try {
      await fn(req, res);
    } catch (error) {
      console.error(`[${name}]`, error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
      }
    }
  };
}
