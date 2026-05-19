const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html }) {
  try {
    const info = await getTransporter().sendMail({
      from: `"${process.env.APP_NAME || 'SaaS Platform'}" <${process.env.SMTP_FROM || 'noreply@yourapp.com'}>`,
      to,
      subject,
      html,
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error('Email send failed:', err);
    // Don't throw — email failures shouldn't break the app
  }
}

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.APP_URL}/verify-email/${token}`;
  await sendEmail({
    to: email,
    subject: 'Verify your email',
    html: `
      <h2>Welcome! Please verify your email</h2>
      <p>Click the link below to verify your email address:</p>
      <a href="${verifyUrl}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
        Verify Email
      </a>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't create an account, please ignore this email.</p>
    `,
  });
}

async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.APP_URL}/reset-password/${token}`;
  await sendEmail({
    to: email,
    subject: 'Reset your password',
    html: `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
        Reset Password
      </a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  });
}

async function sendInviteEmail(email, token, orgName) {
  const inviteUrl = `${process.env.APP_URL}/invite/${token}`;
  await sendEmail({
    to: email,
    subject: `You're invited to join ${orgName}`,
    html: `
      <h2>You've been invited to ${orgName}</h2>
      <p>Click the link below to accept your invitation:</p>
      <a href="${inviteUrl}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
        Accept Invite
      </a>
      <p>This invite expires in 7 days.</p>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendInviteEmail };
