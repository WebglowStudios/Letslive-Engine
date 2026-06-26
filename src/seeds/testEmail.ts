import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtpout.secureserver.net',
  port: 465,
  secure: true,
  auth: {
    user: 'info@letslivetours.com',
    pass: 'Mar@2026/27',
  },
});

async function test() {
  console.log('Sending test email via GoDaddy SMTP...');

  try {
    const info = await transporter.sendMail({
      from: '"LetsLive Tours" <info@letslivetours.com>',
      to: 'skorpion334450@gmail.com',
      subject: '✅ LetsLive Tours — Email Test Successful',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:30px;border-radius:12px;border:1px solid #eee;">
          <h2 style="color:#004d5e;margin:0 0 16px;">LetsLive Tours — Email Working!</h2>
          <p style="color:#444;line-height:1.6;">This is a test email sent from <strong>info@letslivetours.com</strong> via GoDaddy SMTP.</p>
          <p style="color:#444;line-height:1.6;">If you're reading this, the SMTP credentials are correct and emails are being delivered successfully.</p>
          <div style="margin-top:20px;padding:14px;background:#f0fafa;border-radius:8px;font-size:13px;color:#004d5e;">
            <strong>Config used:</strong><br/>
            Host: smtpout.secureserver.net<br/>
            Port: 465 (SSL)<br/>
            From: info@letslivetours.com
          </div>
          <p style="margin-top:20px;font-size:12px;color:#999;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
    });

    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   To: skorpion334450@gmail.com`);
    console.log(`   From: info@letslivetours.com`);
  } catch (err: any) {
    console.error('❌ Failed to send email:');
    console.error(`   Error: ${err.message}`);
    if (err.code) console.error(`   Code: ${err.code}`);
    if (err.response) console.error(`   Response: ${err.response}`);
  }
}

test();
