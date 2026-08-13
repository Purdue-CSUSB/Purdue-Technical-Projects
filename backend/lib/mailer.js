import nodemailer from 'nodemailer';
import { requireEnv, requireEnvInt } from './env.js';

// Cached on globalThis for the same reason as the Mongo client: warm invocations reuse the
// pooled SMTP transport instead of building a new one per request.
function getTransporter() {
  if (!globalThis.__ptpMailTransport) {
    const port = requireEnvInt('SMTP_PORT');
    globalThis.__ptpMailTransport = nodemailer.createTransport({
      host: requireEnv('SMTP_HOST'),
      port,
      // 465 is implicit TLS; 587 negotiates STARTTLS, which nodemailer does on its own.
      secure: port === 465,
      auth: { user: requireEnv('SMTP_USER'), pass: requireEnv('SMTP_PASS') },
    });
  }

  return globalThis.__ptpMailTransport;
}

/**
 * Sends transactional mail.
 *
 * Missing SMTP config throws rather than warning and carrying on. A silent skip would produce
 * accounts nobody can ever verify and password resets that never arrive, while the API still
 * answers 200 - the worst possible failure mode, because it looks like it worked.
 */
export async function sendMail({ to, subject, text }) {
  const transport = getTransporter();
  await transport.sendMail({ from: requireEnv('SMTP_FROM'), to, subject, text });
}
