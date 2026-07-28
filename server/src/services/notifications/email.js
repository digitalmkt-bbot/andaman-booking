import { config } from '../../config.js';

// nodemailer is optional. Install with: npm i nodemailer
let transporter = null;
let loaded = false;

async function getTransporter() {
  if (loaded) return transporter;
  loaded = true;
  if (!config.integrations.email.enabled) return null;
  try {
    const nodemailer = (await import('nodemailer')).default;
    transporter = nodemailer.createTransport({
      host: config.integrations.email.host,
      port: config.integrations.email.port,
      secure: config.integrations.email.port === 465,
      auth: config.integrations.email.user
        ? { user: config.integrations.email.user, pass: config.integrations.email.pass }
        : undefined,
    });
  } catch (e) {
    console.warn('nodemailer not installed — email disabled. Run: npm i nodemailer');
    transporter = null;
  }
  return transporter;
}

export async function sendEmail({ to, subject, text }) {
  const t = await getTransporter();
  if (!t) return;
  await t.sendMail({ from: config.integrations.email.from, to, subject, text });
}
