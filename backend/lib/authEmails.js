import { sendMail } from './mailer.js';

// The two transactional messages the account flow sends. Kept in one place so the wording and
// the stated expiry can't drift from CODE_TTL_MS in auth.js.

export async function sendVerificationCode(email, code) {
  await sendMail({
    to: email,
    subject: 'Verify your Purdue Technical Projects account',
    text: `Your verification code is ${code}. It expires in 15 minutes.`
  });
}

export async function sendPasswordResetCode(email, code) {
  await sendMail({
    to: email,
    subject: 'Reset your Purdue Technical Projects password',
    text: `Your password reset code is ${code}. It expires in 15 minutes. If you didn't request this, you can ignore this email.`
  });
}
