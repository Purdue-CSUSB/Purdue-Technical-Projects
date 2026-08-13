import { getDb } from '../../backend/lib/db.js';
import { sendPasswordResetCode } from '../../backend/lib/authEmails.js';
import { enforceRateLimit } from '../../backend/lib/rateLimit.js';
import { bodyTooLarge, clientIp, methodGuard, withErrorHandling } from '../../backend/lib/http.js';
import {
  CODE_TTL_MS,
  USERS_COLLECTION,
  generateCode,
  hashCode,
  normalizeEmail,
} from '../../backend/lib/auth.js';

// Deliberately identical whether or not the account exists. A 404 for an unknown address would
// make this endpoint a free account-enumeration oracle needing no password at all.
const ALWAYS = 'If an account exists for that email, a password reset code has been sent.';

export default withErrorHandling('auth:requestPasswordReset', async (req, res) => {
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

  return res.status(200).json({ message: ALWAYS });
});
