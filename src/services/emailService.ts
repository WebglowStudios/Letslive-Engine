import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  if (env.NODE_ENV === 'development' && !env.SMTP_USER) {
    console.log('──────────────────────────────────────');
    console.log('📧 EMAIL (dev mode — not sent)');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log('──────────────────────────────────────');
    return;
  }

  await transporter.sendMail({
    from: `"LetsLive Tours" <${env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

// ─── HTML Template Helpers ───────────────────────────────────────────────────

function wrapTemplate(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06);">
        <!-- Header -->
        <tr>
          <td style="background:#004d5e;padding:28px 32px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:1px;">LetsLive Tours</h1>
            <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,.6);letter-spacing:2px;text-transform:uppercase;">Explore · Experience · Live</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 32px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f6f0;padding:24px 32px;text-align:center;border-top:1px solid #e5e5e5;">
            <p style="margin:0;font-size:12px;color:#888;">LetsLive Tours Pvt. Ltd. · Bengaluru, India</p>
            <p style="margin:6px 0 0;font-size:11px;color:#aaa;">You received this email because you have an account with LetsLive Tours.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td>
    <a href="${url}" style="display:inline-block;padding:14px 32px;background:#f5a623;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:50px;letter-spacing:0.5px;">${text}</a>
  </td></tr></table>`;
}

// ─── Email Functions ─────────────────────────────────────────────────────────

export async function sendVerificationEmail(
  email: string,
  token: string,
  firstName: string
): Promise<void> {
  const link = `${env.FRONTEND_URL}/verify-email/${token}`;
  const html = wrapTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Hi ${firstName},</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.7;">Welcome to LetsLive Tours! Please verify your email address to get started.</p>
    <p style="margin:0;font-size:14px;color:#666;line-height:1.6;">Click the button below to confirm your email:</p>
    ${ctaButton('Verify Email', link)}
    <p style="margin:0;font-size:12px;color:#999;">If you didn't create an account, you can safely ignore this email.</p>
    <p style="margin:12px 0 0;font-size:11px;color:#bbb;word-break:break-all;">Or copy this link: ${link}</p>
  `);

  await sendEmail({
    to: email,
    subject: 'Verify your email — LetsLive Tours',
    html,
  });
}

export async function sendResetPasswordEmail(
  email: string,
  token: string,
  firstName: string
): Promise<void> {
  const link = `${env.FRONTEND_URL}/reset-password/${token}`;
  const html = wrapTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Hi ${firstName},</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.7;">We received a request to reset your password. Click the button below to choose a new one:</p>
    ${ctaButton('Reset Password', link)}
    <p style="margin:0;font-size:12px;color:#999;">This link expires in 1 hour. If you didn't request a password reset, please ignore this email.</p>
    <p style="margin:12px 0 0;font-size:11px;color:#bbb;word-break:break-all;">Or copy this link: ${link}</p>
  `);

  await sendEmail({
    to: email,
    subject: 'Reset your password — LetsLive Tours',
    html,
  });
}

interface BookingDetails {
  bookingId: string;
  packageName: string;
  travelDate: string;
  totalAmount: number;
}

export async function sendBookingConfirmation(
  email: string,
  firstName: string,
  bookingDetails: BookingDetails
): Promise<void> {
  const { bookingId, packageName, travelDate, totalAmount } = bookingDetails;
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(totalAmount);

  const html = wrapTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Booking Confirmed! 🎉</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">Hi ${firstName}, your booking has been confirmed. Here are the details:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-radius:10px;padding:20px;margin-bottom:20px;">
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Booking ID</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${bookingId}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Package</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${packageName}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Travel Date</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${travelDate}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;border-top:1px solid #e5e5e5;">Total Amount</td><td style="padding:8px 16px;font-size:18px;color:#004d5e;font-weight:700;text-align:right;border-top:1px solid #e5e5e5;">${formattedAmount}</td></tr>
    </table>
    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">Our team will reach out to you shortly with further details. You can view your booking anytime from your dashboard.</p>
    ${ctaButton('View Booking', `${env.FRONTEND_URL}/dashboard/bookings`)}
  `);

  await sendEmail({
    to: email,
    subject: 'Booking Confirmed — LetsLive Tours',
    html,
  });
}

export async function sendEnquiryReceived(
  email: string,
  firstName: string
): Promise<void> {
  const html = wrapTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Hi ${firstName},</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.7;">Thank you for reaching out! We've received your enquiry and our travel experts will get back to you within 24 hours.</p>
    <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.6;">In the meantime, feel free to explore our curated travel packages:</p>
    ${ctaButton('Browse Packages', `${env.FRONTEND_URL}/packages`)}
    <p style="margin:0;font-size:12px;color:#999;">If you have any urgent queries, call us at +91 80 1234 5678.</p>
  `);

  await sendEmail({
    to: email,
    subject: 'We received your enquiry — LetsLive Tours',
    html,
  });
}
