import bcrypt from 'bcryptjs';
import { getDb } from '../../backend/lib/db.js';
import { enforceRateLimit } from '../../backend/lib/rateLimit.js';
import { bodyTooLarge, clientIp, methodGuard, withErrorHandling } from '../../backend/lib/http.js';
import { USERS_COLLECTION, normalizeEmail, publicUser, signToken } from '../../backend/lib/auth.js';

// A real bcrypt hash of a random string, compared against when no account exists so that an
// unknown email costs the same ~100ms as a known one. Without it, the timing difference
// re-introduces the account enumeration that the shared error message below is closing.
const DUMMY_HASH = '$2a$10$zEkNJUV1OtD6gGL2gQiYvOWzArB.kATUO/o946lYVabumj4n/VVVq';

// One message for both "no such account" and "wrong password", so nobody can test whether a
// given @purdue.edu address has registered.
const GENERIC_FAILURE = 'Incorrect email or password.';

export default withErrorHandling('auth:login', async (req, res) => {
  if (!methodGuard(req, res, 'POST')) return;
  if (bodyTooLarge(req, res)) return;

  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!(await enforceRateLimit(res, 'login', [clientIp(req), normalizedEmail]))) return;

  const db = await getDb();
  const user = await db.collection(USERS_COLLECTION).findOne({ email: normalizedEmail });

  const passwordMatches = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !passwordMatches) {
    return res.status(401).json({ message: GENERIC_FAILURE });
  }

  // Only now, past a correct password, is it safe to report verification state: whoever got
  // this far already owns the account, so it leaks nothing to an outsider - and telling them is
  // the difference between "go check your email" and being silently stuck.
  if (!user.emailVerified) {
    return res.status(403).json({ message: 'Verify your email before logging in.' });
  }

  return res.status(200).json({ token: signToken(user), user: publicUser(user) });
});
