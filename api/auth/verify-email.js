import { getDb } from '../../backend/lib/db.js';
import { enforceRateLimit } from '../../backend/lib/rateLimit.js';
import { bodyTooLarge, clientIp, methodGuard, withErrorHandling } from '../../backend/lib/http.js';
import {
  MAX_CODE_ATTEMPTS,
  USERS_COLLECTION,
  codeMatches,
  normalizeEmail,
  publicUser,
  signToken,
} from '../../backend/lib/auth.js';

export default withErrorHandling('auth:verifyEmail', async (req, res) => {
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
});
