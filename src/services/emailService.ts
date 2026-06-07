import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// ─── Transporter ─────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface BookingDetails {
  packageName: string;
  travelDate: string;
  amount: number;
  travellers: string;
  bookingId: string;
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
            <p style="margin:6px 0 0;font-size:11px;color:#aaa;">info@letslivetours.in · +91 80 1234 5678</p>
            <p style="margin:8px 0 0;font-size:11px;color:#bbb;">© 2026 LetsLive Tours. All rights reserved.</p>
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

// ─── Base Send Function ──────────────────────────────────────────────────────

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

// ─── Customer Emails ─────────────────────────────────────────────────────────

export async function sendVerificationEmail(
  email: string,
  token: string,
  name: string
): Promise<void> {
  const link = `${env.FRONTEND_URL}/verify-email/${token}`;
  const html = wrapTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Hi ${name},</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.7;">Welcome to LetsLive Tours! Please verify your email address to get started.</p>
    <p style="margin:0;font-size:14px;color:#666;line-height:1.6;">Click the button below to confirm your email:</p>
    ${ctaButton('Verify Email', link)}
    <p style="margin:0;font-size:12px;color:#999;">If you didn't create an account, you can safely ignore this email.</p>
    <p style="margin:12px 0 0;font-size:11px;color:#bbb;word-break:break-all;">Or copy this link: ${link}</p>
  `);

  await sendEmail({ to: email, subject: 'Verify your email — LetsLive Tours', html });
}

export async function sendResetPasswordEmail(
  email: string,
  token: string,
  name: string
): Promise<void> {
  const link = `${env.FRONTEND_URL}/reset-password/${token}`;
  const html = wrapTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Hi ${name},</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.7;">We received a request to reset your password. Click the button below to choose a new one:</p>
    ${ctaButton('Reset Password', link)}
    <p style="margin:0;font-size:12px;color:#999;">This link expires in 1 hour. If you didn't request a password reset, please ignore this email.</p>
    <p style="margin:12px 0 0;font-size:11px;color:#bbb;word-break:break-all;">Or copy this link: ${link}</p>
  `);

  await sendEmail({ to: email, subject: 'Reset your password — LetsLive Tours', html });
}

export async function sendEnquiryReceived(
  email: string,
  name: string
): Promise<void> {
  const html = wrapTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Hi ${name},</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.7;">Thank you for reaching out! We've received your enquiry and our travel experts will get back to you within 24 hours.</p>
    <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.6;">In the meantime, feel free to explore our curated travel packages:</p>
    ${ctaButton('Browse Packages', `${env.FRONTEND_URL}/packages`)}
    <p style="margin:0;font-size:12px;color:#999;">If you have any urgent queries, call us at +91 80 1234 5678.</p>
  `);

  await sendEmail({ to: email, subject: 'We received your enquiry — LetsLive Tours', html });
}

export async function sendCallbackRequested(
  email: string,
  name: string,
  phone: string
): Promise<void> {
  const html = wrapTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Hi ${name},</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.7;">We've received your callback request. One of our travel experts will call you shortly at <strong>${phone}</strong>.</p>
    <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.6;">Our team typically responds within 2 hours during business hours (9 AM – 7 PM IST).</p>
    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">While you wait, explore what we have to offer:</p>
    ${ctaButton('Explore Destinations', `${env.FRONTEND_URL}/destinations`)}
    <p style="margin:0;font-size:12px;color:#999;">Can't wait? Call us directly at +91 80 1234 5678.</p>
  `);

  await sendEmail({ to: email, subject: "We'll call you back soon — LetsLive Tours", html });
}

export async function sendBookingConfirmation(
  email: string,
  name: string,
  bookingDetails: BookingDetails
): Promise<void> {
  const { packageName, travelDate, amount, travellers, bookingId } = bookingDetails;
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

  const html = wrapTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Booking Confirmed! 🎉</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">Hi ${name}, your booking has been confirmed. Here are the details:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-radius:10px;padding:20px;margin-bottom:20px;">
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Booking ID</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${bookingId}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Package</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${packageName}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Travel Date</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${travelDate}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Travellers</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${travellers}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;border-top:1px solid #e5e5e5;">Total Amount</td><td style="padding:8px 16px;font-size:18px;color:#004d5e;font-weight:700;text-align:right;border-top:1px solid #e5e5e5;">${formattedAmount}</td></tr>
    </table>
    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">Our team will reach out to you shortly with further details. You can view your booking anytime from your dashboard.</p>
    ${ctaButton('View Booking', `${env.FRONTEND_URL}/dashboard/bookings/${bookingId}`)}
  `);

  await sendEmail({ to: email, subject: 'Booking Confirmed — LetsLive Tours', html });
}

export async function sendReviewThanks(
  email: string,
  name: string,
  packageName: string
): Promise<void> {
  const html = wrapTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Thank you, ${name}! ⭐</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.7;">We appreciate you taking the time to review <strong>${packageName}</strong>. Your feedback helps fellow travellers make informed choices and helps us improve.</p>
    <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.6;">Ready for your next adventure?</p>
    ${ctaButton('Explore More Packages', `${env.FRONTEND_URL}/packages`)}
    <p style="margin:0;font-size:12px;color:#999;">We'd love to host you again. Happy travels!</p>
  `);

  await sendEmail({ to: email, subject: 'Thanks for your review — LetsLive Tours', html });
}

// ─── Admin Emails ────────────────────────────────────────────────────────────

export async function sendAdminNewEnquiry(
  customerName: string,
  customerEmail: string,
  type: string,
  packageName?: string
): Promise<void> {
  const packageLine = packageName
    ? `<tr><td style="padding:8px 16px;font-size:13px;color:#888;">Package</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${packageName}</td></tr>`
    : '';

  const html = wrapTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">New Enquiry Received 📬</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">A new enquiry has come in. Details below:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-radius:10px;padding:20px;margin-bottom:20px;">
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Customer</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${customerName}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Email</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${customerEmail}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Type</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${type}</td></tr>
      ${packageLine}
    </table>
    <p style="margin:0;font-size:14px;color:#666;line-height:1.6;">Log in to the admin panel to assign and respond.</p>
  `);

  await sendEmail({ to: env.ADMIN_EMAIL, subject: `New Enquiry: ${type} — ${customerName}`, html });
}

export async function sendAdminNewBooking(
  customerName: string,
  packageName: string,
  amount: number,
  travelDate: string
): Promise<void> {
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

  const html = wrapTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">New Booking Alert 🎫</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">A new booking has been placed. Details below:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-radius:10px;padding:20px;margin-bottom:20px;">
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Customer</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${customerName}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Package</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${packageName}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Travel Date</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${travelDate}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;border-top:1px solid #e5e5e5;">Amount</td><td style="padding:8px 16px;font-size:18px;color:#004d5e;font-weight:700;text-align:right;border-top:1px solid #e5e5e5;">${formattedAmount}</td></tr>
    </table>
    <p style="margin:0;font-size:14px;color:#666;line-height:1.6;">Review the booking in the admin panel.</p>
  `);

  await sendEmail({ to: env.ADMIN_EMAIL, subject: `New Booking: ${packageName} — ${customerName}`, html });
}

// ─── Staff Emails ────────────────────────────────────────────────────────────

export async function sendStaffEnquiryAssigned(
  staffEmail: string,
  staffName: string,
  customerName: string,
  enquiryType: string,
  packageName?: string
): Promise<void> {
  const packageLine = packageName
    ? `<tr><td style="padding:8px 16px;font-size:13px;color:#888;">Package</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${packageName}</td></tr>`
    : '';

  const html = wrapTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Hi ${staffName},</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.7;">A new enquiry has been assigned to you. Please follow up at your earliest convenience.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-radius:10px;padding:20px;margin:20px 0;">
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Customer</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${customerName}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Enquiry Type</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${enquiryType}</td></tr>
      ${packageLine}
    </table>
    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">Log in to the admin panel to view full details and respond.</p>
  `);

  await sendEmail({ to: staffEmail, subject: `Enquiry Assigned: ${customerName} — ${enquiryType}`, html });
}
