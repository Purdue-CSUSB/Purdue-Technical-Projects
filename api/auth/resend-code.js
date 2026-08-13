import { getDb } from '../../backend/lib/db.js';
import { sendVerificationCode } from '../../backend/lib/authEmails.js';
import { enforceRateLimit } from '../../backend/lib/rateLimit.js';
import { bodyTooLarge, clientIp, methodGuard, withErrorHandling } from '../../backend/lib/http.js';
import {
  CODE_TTL_MS,
  USERS_COLLECTION,
  generateCode,
  hashCode,
  normalizeEmail,
} from '../../backend/lib/auth.js';

export default withErrorHandling('auth:resendCode', async (req, res) => {
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
});
