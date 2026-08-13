import bcrypt from 'bcryptjs';
import { getDb } from '../../backend/lib/db.js';
import { sendVerificationCode } from '../../backend/lib/authEmails.js';
import { enforceRateLimit } from '../../backend/lib/rateLimit.js';
import { bodyTooLarge, clientIp, methodGuard, withErrorHandling } from '../../backend/lib/http.js';
import { ALLOWED_EMAIL_DOMAIN } from '../../backend/lib/constants.js';
import {
  CODE_TTL_MS,
  USERS_COLLECTION,
  generateCode,
  hashCode,
  isAllowedEmail,
  normalizeEmail,
} from '../../backend/lib/auth.js';

// bcrypt only considers the first 72 bytes of a password, so anything past that is a silent
// no-op. Capping here is honest about the real limit rather than pretending longer is stronger.
const MAX_PASSWORD_LENGTH = 72;
const MAX_USERNAME_LENGTH = 80;

export default withErrorHandling('auth:signup', async (req, res) => {
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
});
