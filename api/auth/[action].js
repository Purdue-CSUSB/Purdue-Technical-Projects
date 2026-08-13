import bcrypt from 'bcryptjs';
import { getDb } from '../../backend/lib/db.js';
import { sendPasswordResetCode, sendVerificationCode } from '../../backend/lib/authEmails.js';
import { enforceRateLimit } from '../../backend/lib/rateLimit.js';
import { bodyTooLarge, clientIp, methodGuard, withErrorHandling } from '../../backend/lib/http.js';
import { ALLOWED_EMAIL_DOMAIN } from '../../backend/lib/constants.js';
import {
  CODE_TTL_MS,
  MAX_CODE_ATTEMPTS,
  USERS_COLLECTION,
  codeMatches,
  generateCode,
  hashCode,
  isAllowedEmail,
  normalizeEmail,
  publicUser,
  requireAuth,
  signToken,
} from '../../backend/lib/auth.js';

// Every auth endpoint in one function, dispatched on the last path segment.
//
// This is a DEPLOYMENT constraint, not a design preference: Vercel turns each file under api/
// into its own serverless function and the Hobby plan caps a deployment at 12. Seven separate
// auth files put the project at 15 and the build failed outright. Do not split these back into
// a file each without checking the count first - the other boards need their routes too.
//
// The URLs are unchanged. /api/auth/signup, /api/auth/login and the rest all still resolve
// exactly as they did, because Vercel maps the [action] segment onto this one handler.

// bcrypt only considers the first 72 bytes of a password, so anything past that is a silent
// no-op. Capping here is honest about the real limit rather than pretending longer is stronger.
const MAX_PASSWORD_LENGTH = 72;
const MAX_USERNAME_LENGTH = 80;

// A real bcrypt hash of a random string, compared against when no account exists so that an
// unknown email costs the same ~100ms as a known one. Without it, the timing difference
// re-introduces the account enumeration that the shared error message below is closing.
const DUMMY_HASH = '$2a$10$zEkNJUV1OtD6gGL2gQiYvOWzArB.kATUO/o946lYVabumj4n/VVVq';

// One message for both "no such account" and "wrong password", so nobody can test whether a
// given @purdue.edu address has registered.
const LOGIN_FAILURE = 'Incorrect email or password.';

// Deliberately identical whether or not the account exists. A 404 for an unknown address would
// make the reset request endpoint a free account-enumeration oracle needing no password at all.
const RESET_REQUESTED = 'If an account exists for that email, a password reset code has been sent.';

// Wrong email, wrong code and expired code are all indistinguishable, so the reset endpoint
// can't be used to enumerate accounts either.
const RESET_FAILURE = 'That reset code is invalid or has expired. Request a new one.';

async function signup(req, res) {
  if (!methodGuard(req, res, 'POST')) return;
  if (bodyTooLarge(req, res)) return;

  const { username, email, password } = req.body || {};

  if (typeof username !== 'string' || !username.trim() || username.length > MAX_USERNAME_LENGTH) {
    return res.status(400).json({ message: `Username is required (max ${MAX_USERNAME_LENGTH} characters).` });
  }
  if (!isAllowedEmail(email)) {
    return res.status(400).json({ message: `You must sign up with a valid ${ALLOWED_EMAIL_DOMAIN} email.` });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > MAX_PASSWORD_LENGTH) {
    return res.status(400).json({ message: `Password must be between 8 and ${MAX_PASSWORD_LENGTH} characters.` });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!(await enforceRateLimit(res, 'signup', [clientIp(req), normalizedEmail]))) return;

  const db = await getDb();
  const users = db.collection(USERS_COLLECTION);

  const passwordHash = await bcrypt.hash(password, 10);
  const code = generateCode();

  const newUser = {
    username: username.trim(),
    email: normalizedEmail,
    passwordHash,
    isAdmin: false,
    emailVerified: false,
    verificationCodeHash: hashCode(code),
    verificationCodeExpires: new Date(Date.now() + CODE_TTL_MS),
    verificationAttempts: 0,
    createdAt: new Date(),
  };

  try {
    await users.insertOne(newUser);
  } catch (error) {
    // The unique index on email (see backend/scripts/ensureIndexes.js) is what actually
    // prevents duplicate accounts. A read-then-write check instead would leave a race window
    // where two concurrent signups both pass it.
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }
    throw error;
  }

  await sendVerificationCode(normalizedEmail, code);

  return res.status(201).json({ message: 'Account created. Check your email for a verification code.' });
}

async function verifyEmail(req, res) {
  if (!methodGuard(req, res, 'POST')) return;
  if (bodyTooLarge(req, res)) return;

  const { email, code } = req.body || {};
  if (typeof email !== 'string' || typeof code !== 'string') {
    return res.status(400).json({ message: 'Email and code are required.' });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!(await enforceRateLimit(res, 'signup', [clientIp(req), normalizedEmail]))) return;

  const db = await getDb();
  const users = db.collection(USERS_COLLECTION);
  const user = await users.findOne({ email: normalizedEmail });

  if (!user) {
    return res.status(404).json({ message: 'No account found for that email.' });
  }
  if (user.emailVerified) {
    return res.status(400).json({ message: 'This account is already verified.' });
  }

  // Expiry is checked before the code itself so an expired code reports as expired rather than
  // burning an attempt against a value that can no longer work.
  if (!user.verificationCodeExpires || user.verificationCodeExpires < new Date()) {
    return res.status(400).json({ message: 'That code has expired. Request a new one.' });
  }

  if (!codeMatches(user.verificationCodeHash, code)) {
    // Count wrong tries and burn the code after too many, so a 6-digit code can't be guessed.
    const attempts = (user.verificationAttempts || 0) + 1;
    if (attempts >= MAX_CODE_ATTEMPTS) {
      await users.updateOne(
        { _id: user._id },
        { $unset: { verificationCodeHash: '', verificationCodeExpires: '', verificationAttempts: '' } }
      );
      return res.status(400).json({ message: 'Too many incorrect attempts. Request a new code.' });
    }
    await users.updateOne({ _id: user._id }, { $set: { verificationAttempts: attempts } });
    return res.status(400).json({ message: 'Incorrect verification code.' });
  }

  await users.updateOne(
    { _id: user._id },
    {
      $set: { emailVerified: true },
      $unset: { verificationCodeHash: '', verificationCodeExpires: '', verificationAttempts: '' },
    }
  );

  // Verifying already proves control of the inbox, so this hands back a session rather than
  // bouncing someone to the login form to type their password again.
  const verifiedUser = { ...user, emailVerified: true };
  return res.status(200).json({ token: signToken(verifiedUser), user: publicUser(verifiedUser) });
}

async function resendCode(req, res) {
  if (!methodGuard(req, res, 'POST')) return;
  if (bodyTooLarge(req, res)) return;

  const { email } = req.body || {};
  if (typeof email !== 'string') {
    return res.status(400).json({ message: 'Email is required.' });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!(await enforceRateLimit(res, 'signup', [clientIp(req), normalizedEmail]))) return;

  const db = await getDb();
  const users = db.collection(USERS_COLLECTION);
  const user = await users.findOne({ email: normalizedEmail });

  if (!user) {
    return res.status(404).json({ message: 'No account found for that email.' });
  }
  if (user.emailVerified) {
    return res.status(400).json({ message: 'This account is already verified.' });
  }

  // A fresh code replaces the old one and resets the attempt counter, so a burnt code (too many
  // wrong guesses) is recoverable without support.
  const code = generateCode();
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        verificationCodeHash: hashCode(code),
        verificationCodeExpires: new Date(Date.now() + CODE_TTL_MS),
        verificationAttempts: 0,
      },
    }
  );
  await sendVerificationCode(normalizedEmail, code);

  return res.status(200).json({ message: 'A new code has been sent.' });
}

async function login(req, res) {
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
    return res.status(401).json({ message: LOGIN_FAILURE });
  }

  // Only now, past a correct password, is it safe to report verification state: whoever got
  // this far already owns the account, so it leaks nothing to an outsider - and telling them is
  // the difference between "go check your email" and being silently stuck.
  if (!user.emailVerified) {
    return res.status(403).json({ message: 'Verify your email before logging in.' });
  }

  return res.status(200).json({ token: signToken(user), user: publicUser(user) });
}

// Lets the browser re-check a stored session against the live account, rather than trusting
// what it cached in localStorage at login time.
async function me(req, res) {
  if (!methodGuard(req, res, 'GET')) return;

  // requireAuth already re-reads the account from Mongo, so this is the live user, not a
  // snapshot from the token.
  const user = await requireAuth(req, res);
  if (!user) return;

  return res.status(200).json({ user: publicUser(user) });
}

async function requestPasswordReset(req, res) {
  if (!methodGuard(req, res, 'POST')) return;
  if (bodyTooLarge(req, res)) return;

  const { email } = req.body || {};
  if (typeof email !== 'string') {
    return res.status(400).json({ message: 'Email is required.' });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!(await enforceRateLimit(res, 'passwordReset', [clientIp(req), normalizedEmail]))) return;

  const db = await getDb();
  const users = db.collection(USERS_COLLECTION);
  const user = await users.findOne({ email: normalizedEmail });

  // Unverified accounts are excluded: letting an unverified address reset its password would
  // hand control of it to whoever typed the address in, bypassing the email check entirely.
  if (user && user.emailVerified) {
    const code = generateCode();
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          resetCodeHash: hashCode(code),
          resetCodeExpires: new Date(Date.now() + CODE_TTL_MS),
          resetAttempts: 0,
        },
      }
    );
    await sendPasswordResetCode(user.email, code);
  }

  return res.status(200).json({ message: RESET_REQUESTED });
}

async function resetPassword(req, res) {
  if (!methodGuard(req, res, 'POST')) return;
  if (bodyTooLarge(req, res)) return;

  const { email, code, newPassword } = req.body || {};
  if (typeof email !== 'string' || typeof code !== 'string') {
    return res.status(400).json({ message: 'Email and code are required.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > MAX_PASSWORD_LENGTH) {
    return res.status(400).json({ message: `Password must be between 8 and ${MAX_PASSWORD_LENGTH} characters.` });
  }
  // Enforced through the same helper as signup, so the reset flow can't operate on an address
  // signup would have refused.
  if (!isAllowedEmail(email)) {
    return res.status(400).json({ message: RESET_FAILURE });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!(await enforceRateLimit(res, 'passwordReset', [clientIp(req), normalizedEmail]))) return;

  const db = await getDb();
  const users = db.collection(USERS_COLLECTION);
  const user = await users.findOne({ email: normalizedEmail });

  if (!user || !user.emailVerified || !user.resetCodeHash) {
    return res.status(400).json({ message: RESET_FAILURE });
  }
  if (!user.resetCodeExpires || user.resetCodeExpires < new Date()) {
    return res.status(400).json({ message: RESET_FAILURE });
  }

  if (!codeMatches(user.resetCodeHash, code)) {
    // Count wrong tries and burn the code after too many, so a 6-digit code can't be guessed.
    const attempts = (user.resetAttempts || 0) + 1;
    if (attempts >= MAX_CODE_ATTEMPTS) {
      await users.updateOne(
        { _id: user._id },
        { $unset: { resetCodeHash: '', resetCodeExpires: '', resetAttempts: '' } }
      );
      return res.status(400).json({ message: RESET_FAILURE });
    }
    await users.updateOne({ _id: user._id }, { $set: { resetAttempts: attempts } });
    return res.status(400).json({ message: RESET_FAILURE });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await users.updateOne(
    { _id: user._id },
    {
      $set: { passwordHash },
      $unset: { resetCodeHash: '', resetCodeExpires: '', resetAttempts: '' },
    }
  );

  // Sign them straight in rather than sending them back to an empty login form. Getting here
  // required a code delivered to the account's own inbox plus a new password, which is the same
  // bar verify-email clears before it issues a token.
  return res.status(200).json({
    message: 'Password reset.',
    token: signToken(user),
    user: publicUser({ ...user, passwordHash })
  });
}

// The URL segment each handler answers to. The keys ARE the public routes - renaming one
// changes /api/auth/<key>, which the frontend hard-codes in AuthContext.jsx.
const ROUTES = {
  'signup': signup,
  'verify-email': verifyEmail,
  'resend-code': resendCode,
  'login': login,
  'me': me,
  'request-password-reset': requestPasswordReset,
  'reset-password': resetPassword,
};

/**
 * Works out which endpoint was asked for.
 *
 * The path segment is the authority, not `req.query.action`. Vercel merges the [action] route
 * parameter into req.query alongside anything the client sent, so reading req.query first would
 * let `/api/auth/me?action=login` pick the handler from the query string. Falling back to
 * req.query only when the path doesn't name a known route keeps this working if the platform
 * hands the function a rewritten URL, without trusting the query string when it hasn't.
 */
function requestedAction(req) {
  const { pathname } = new URL(req.url, 'http://localhost');
  const fromPath = pathname.split('/').filter(Boolean).pop() ?? '';
  if (Object.hasOwn(ROUTES, fromPath)) return fromPath;

  // A repeated ?action= arrives as an array; only a plain string is considered.
  const fromQuery = req.query?.action;
  return typeof fromQuery === 'string' ? fromQuery : '';
}

export default async function handler(req, res) {
  const action = requestedAction(req);
  const route = ROUTES[action];

  // Every path under /api/auth/ now reaches this one function, so an unknown one has to be
  // turned away here - there is no longer a missing file for the platform to 404 on.
  if (!Object.hasOwn(ROUTES, action) || typeof route !== 'function') {
    return res.status(404).json({ message: 'Not found.' });
  }

  // Wrapped per request so the log line still names the specific endpoint that failed
  // ("[auth:login] ...") rather than attributing every auth error to one shared handler.
  return withErrorHandling(`auth:${action}`, route)(req, res);
}
