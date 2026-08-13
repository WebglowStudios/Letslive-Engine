import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// ─── Transporter ─────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,   // true for port 465 (SSL), false for 587 (TLS/STARTTLS)
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  tls: {
    // GoDaddy uses a self-signed cert on smtpout.secureserver.net — allow it
    rejectUnauthorized: false,
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
            <p style="margin:6px 0 0;font-size:11px;color:#aaa;">info@letslivetours.com · +91 98765 43210</p>
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

// ─── CRM: DNP 3 Alert ────────────────────────────────────────────────────────
export async function sendDNP3Alert(
  managerEmail: string,
  customerName: string,
  staffName: string
): Promise<void> {
  const html = wrapTemplate(`
    <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a1a;">⚠️ Lead Needs Attention — DNP 3</p>
    <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
      The lead <strong>${customerName}</strong> has had <strong>3 unanswered call attempts</strong> by ${staffName}.
      Please consider reassigning or escalating this enquiry.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0;border-radius:10px;padding:20px;margin:20px 0;border:1px solid #f5a623;">
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Lead</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${customerName}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Assigned To</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${staffName}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">DNP Count</td><td style="padding:8px 16px;font-size:14px;color:#f5a623;font-weight:700;text-align:right;">3 attempts</td></tr>
    </table>
    <p style="margin:0;font-size:14px;color:#444;">Log in to the admin panel to reassign or review this lead.</p>
  `);

  await sendEmail({ to: managerEmail, subject: `⚠️ DNP Alert: ${customerName} — 3 Unanswered Calls`, html });
}

// ─── CRM: DNP 6 Alert ────────────────────────────────────────────────────────
export async function sendDNP6Alert(
  recipientEmail: string,
  customerName: string
): Promise<void> {
  const html = wrapTemplate(`
    <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ef4444;">🚨 Lead Going Cold — DNP 6+</p>
    <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
      <strong>${customerName}</strong> has had <strong>6 or more unanswered call attempts</strong>.
      This lead may need to be closed or handed off.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border-radius:10px;padding:20px;margin:20px 0;border:1px solid #ef4444;">
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Lead</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${customerName}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">DNP Count</td><td style="padding:8px 16px;font-size:14px;color:#ef4444;font-weight:700;text-align:right;">6+ attempts</td></tr>
    </table>
    <p style="margin:0;font-size:14px;color:#444;">Consider marking this lead as closed with a lost reason in the admin panel.</p>
  `);

  await sendEmail({ to: recipientEmail, subject: `🚨 Lead Cold: ${customerName} — 6+ Unanswered Calls`, html });
}

// ─── CRM: Conversion Congrats ─────────────────────────────────────────────────
export async function sendConversionCongrats(
  staffEmail: string,
  staffName: string,
  customerName: string,
  bookingValue: number
): Promise<void> {
  const formattedValue = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(bookingValue);
  const html = wrapTemplate(`
    <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#10b981;">🎉 Conversion! Great Work!</p>
    <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
      Congratulations ${staffName}! Your lead <strong>${customerName}</strong> has converted into a confirmed booking.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;padding:20px;margin:20px 0;border:1px solid #10b981;">
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Customer</td><td style="padding:8px 16px;font-size:14px;color:#1a1a1a;font-weight:600;text-align:right;">${customerName}</td></tr>
      <tr><td style="padding:8px 16px;font-size:13px;color:#888;">Booking Value</td><td style="padding:8px 16px;font-size:18px;color:#10b981;font-weight:700;text-align:right;">${formattedValue}</td></tr>
    </table>
    <p style="margin:0;font-size:14px;color:#444;">The operations team has been notified and will handle the trip planning.</p>
  `);

  await sendEmail({ to: staffEmail, subject: `🎉 Converted! ${customerName} — ${formattedValue} booking`, html });
}

// ─── CRM: Follow-Up Reminder (for cron job) ────────────────────────────────────
export async function sendFollowUpReminder(
  staffEmail: string,
  staffName: string,
  followUps: { customerName: string; phone: string; notes?: string }[]
): Promise<void> {
  const rows = followUps.map((f) => `
    <tr>
      <td style="padding:10px 16px;font-size:14px;color:#1a1a1a;font-weight:600;border-bottom:1px solid #f0f0f0;">${f.customerName}</td>
      <td style="padding:10px 16px;font-size:14px;color:#444;border-bottom:1px solid #f0f0f0;">${f.phone}</td>
      <td style="padding:10px 16px;font-size:13px;color:#888;border-bottom:1px solid #f0f0f0;">${f.notes || '—'}</td>
    </tr>`).join('');

  const html = wrapTemplate(`
    <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a1a;">📅 Your Follow-Ups for Today</p>
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">
      Hi ${staffName}, you have <strong>${followUps.length} follow-up${followUps.length > 1 ? 's' : ''}</strong> scheduled for today.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e5e5;">
      <thead>
        <tr style="background:#004d5e;">
          <th style="padding:12px 16px;font-size:12px;color:rgba(255,255,255,.8);text-align:left;">Customer</th>
          <th style="padding:12px 16px;font-size:12px;color:rgba(255,255,255,.8);text-align:left;">Phone</th>
          <th style="padding:12px 16px;font-size:12px;color:rgba(255,255,255,.8);text-align:left;">Notes</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:20px 0 0;font-size:14px;color:#444;">Log in to the admin panel to view full details and log your call outcomes.</p>
  `);

  await sendEmail({ to: staffEmail, subject: `📅 ${followUps.length} Follow-Up${followUps.length > 1 ? 's' : ''} Due Today — LetsLive CRM`, html });
}

// ─── Send Booking Link to Customer ────────────────────────────────────────────
export async function sendBookingLink(opts: {
  customerEmail: string;
  customerName: string;
  packageName: string;
  packageSlug: string;
  staffName: string;
  price?: number;
  departureId?: string;
  travelDate?: Date;
  enquiryId?: string;
}): Promise<void> {
  const { customerEmail, customerName, packageName, packageSlug, staffName, price, departureId, travelDate, enquiryId } = opts;
  
  const params = new URLSearchParams();
  if (departureId) params.append("departureId", departureId.toString());
  if (travelDate) params.append("travelDate", new Date(travelDate).toISOString().split('T')[0]);
  if (enquiryId) params.append("enquiryId", enquiryId.toString());
  
  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const bookingUrl = `${process.env.FRONTEND_URL || 'https://www.letslivetours.com'}/book/${packageSlug}${queryStr}`;
  const priceText = price
    ? `<p style="margin:0 0 4px;font-size:13px;color:#888;">Starting from <strong style="color:#004d5e;">₹${price.toLocaleString('en-IN')}</strong></p>`
    : '';

  const html = wrapTemplate(`
    <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a1a;">Your Package is Ready! 🎉</p>
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">
      Hi <strong>${customerName}</strong>,<br/><br/>
      ${staffName} from LetsLive Tours has put together a travel package especially for you.
      Click the button below to review the details and complete your booking.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#1a1a1a;">${packageName}</p>
          ${priceText}
          <p style="margin:8px 0 0;font-size:13px;color:#888;">Prepared by ${staffName} · LetsLive Tours</p>
        </td>
      </tr>
    </table>

    <div style="text-align:center;margin:28px 0;">
      <a href="${bookingUrl}"
         style="display:inline-block;padding:14px 36px;background:#004d5e;color:#ffffff;text-decoration:none;border-radius:50px;font-size:15px;font-weight:700;letter-spacing:0.3px;">
        View Package &amp; Book Now →
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:13px;color:#888;line-height:1.6;">
      Or copy this link: <a href="${bookingUrl}" style="color:#004d5e;">${bookingUrl}</a><br/>
      This link doesn't expire. If you have any questions, just reply to this email or call us.
    </p>
  `);

  await sendEmail({
    to: customerEmail,
    subject: `Your LetsLive Tours Package is Ready — ${packageName}`,
    html,
  });
}

// ─── Send Payment Reminder ────────────────────────────────────────────────────
export async function sendPaymentReminder(
  customerEmail: string,
  customerName: string,
  milestone: string,
  amount: number,
  dueDate: Date | undefined
): Promise<void> {
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

  const formattedDate = dueDate 
    ? new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'immediately';

  const html = wrapTemplate(`
    <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a1a;">Payment Reminder</p>
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">
      Hi <strong>${customerName}</strong>,<br/><br/>
      This is a friendly reminder regarding your upcoming trip with LetsLive Tours. An installment is currently due.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 6px;font-size:14px;color:#888;">Milestone: <strong style="color:#1a1a1a;">${milestone}</strong></p>
          <p style="margin:0 0 6px;font-size:14px;color:#888;">Due Date: <strong style="color:#1a1a1a;">${formattedDate}</strong></p>
          <p style="margin:12px 0 0;font-size:15px;color:#888;">Amount Due: <strong style="font-size:20px;color:#004d5e;">${formattedAmount}</strong></p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.6;">Please contact your trip coordinator to complete this payment.</p>
  `);

  await sendEmail({
    to: customerEmail,
    subject: `Payment Reminder: ${milestone} — LetsLive Tours`,
    html,
  });
}
