import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  tz: process.env.TZ || 'Asia/Bangkok',
  reminderLeadMinutes: parseInt(process.env.REMINDER_LEAD_MINUTES || '30', 10),
  integrations: {
    email: {
      enabled: process.env.EMAIL_ENABLED === 'true',
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM,
    },
    line: {
      enabled: process.env.LINE_ENABLED === 'true',
      token: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    },
    google: {
      enabled: process.env.GOOGLE_CALENDAR_ENABLED === 'true',
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      credentials: process.env.GOOGLE_CREDENTIALS_JSON,
    },
    outlook: {
      enabled: process.env.OUTLOOK_ENABLED === 'true',
      tenantId: process.env.OUTLOOK_TENANT_ID,
      clientId: process.env.OUTLOOK_CLIENT_ID,
      clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
      userId: process.env.OUTLOOK_USER_ID,
    },
  },
};
