import bcrypt from 'bcryptjs';
import { getDb } from '../../backend/lib/db.js';
import { enforceRateLimit } from '../../backend/lib/rateLimit.js';
import { bodyTooLarge, clientIp, methodGuard, withErrorHandling } from '../../backend/lib/http.js';
import {
  MAX_CODE_ATTEMPTS,
  USERS_COLLECTION,
  codeMatches,
  isAllowedEmail,
  normalizeEmail,
  publicUser,
  signToken,
} from '../../backend/lib/auth.js';

const MAX_PASSWORD_LENGTH = 72;
// Wrong email, wrong code and expired code are all indistinguishable, so this endpoint can't be
// used to enumerate accounts either.
const GENERIC_FAILURE = 'That reset code is invalid or has expired. Request a new one.';

export default withErrorHandling('auth:resetPassword', async (req, res) => {
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
    return res.status(400).json({ message: GENERIC_FAILURE });
  }

  const normalizedEmail = normalizeEmail(email);
  if (!(await enforceRateLimit(res, 'passwordReset', [clientIp(req), normalizedEmail]))) return;

  const db = await getDb();
  const users = db.collection(USERS_COLLECTION);
  const user = await users.findOne({ email: normalizedEmail });

  if (!user || !user.emailVerified || !user.resetCodeHash) {
    return res.status(400).json({ message: GENERIC_FAILURE });
  }
  if (!user.resetCodeExpires || user.resetCodeExpires < new Date()) {
    return res.status(400).json({ message: GENERIC_FAILURE });
  }

  if (!codeMatches(user.resetCodeHash, code)) {
    // Count wrong tries and burn the code after too many, so a 6-digit code can't be guessed.
    const attempts = (user.resetAttempts || 0) + 1;
    if (attempts >= MAX_CODE_ATTEMPTS) {
      await users.updateOne(
        { _id: user._id },
        { $unset: { resetCodeHash: '', resetCodeExpires: '', resetAttempts: '' } }
      );
      return res.status(400).json({ message: GENERIC_FAILURE });
    }
    await users.updateOne({ _id: user._id }, { $set: { resetAttempts: attempts } });
    return res.status(400).json({ message: GENERIC_FAILURE });
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
});
