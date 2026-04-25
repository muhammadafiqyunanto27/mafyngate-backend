const { Resend } = require('resend');

const resendKey = process.env.RESEND_API_KEY;

if (!resendKey) {
  console.warn('⚠️ [Mailer] RESEND_API_KEY is missing in .env. Email features will not work.');
}

const resend = resendKey ? new Resend(resendKey) : null;

// ─── Send Password Reset Email ────────────────────────────────────────────────
const sendPasswordResetEmail = async (toEmail, resetUrl) => {
  // Use the verified domain email from .env, or fallback to onboarding@resend.dev if not set
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const fromName = 'MafynGate Security';

  if (!resend) {
    console.error('❌ [Resend] Cannot send email: Resend instance not initialized (missing API Key).');
    return;
  }

  try {
    const data = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      subject: 'Reset Password MafynGate',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Password</title>
        </head>
        <body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" max-width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#111111;border:1px solid #222222;border-radius:24px;overflow:hidden;">
                  <tr>
                    <td style="padding:40px 40px 24px;text-align:center;background:linear-gradient(135deg,#1a1a2e 0%,#111111 100%);">
                      <div style="display:inline-block;width:64px;height:64px;background:#7c3aed;border-radius:16px;margin-bottom:20px;line-height:64px;font-size:28px;">🔐</div>
                      <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Reset Password</h1>
                      <p style="margin:8px 0 0;font-size:14px;color:#888888;font-weight:500;">MafynGate Security</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px 40px;">
                      <p style="margin:0 0 16px;font-size:15px;color:#cccccc;line-height:1.6;">Hei, kami menerima permintaan reset password untuk akun MafynGate kamu.</p>
                      <p style="margin:0 0 28px;font-size:15px;color:#cccccc;line-height:1.6;">Klik tombol di bawah untuk membuat password baru. Link ini hanya berlaku selama <strong style="color:#ffffff;">1 jam</strong>.</p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:12px;letter-spacing:0.3px;">
                              Reset Password Sekarang
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:28px 0 0;font-size:12px;color:#555555;line-height:1.6;">Kalau kamu tidak meminta reset password, abaikan email ini.</p>
                      <div style="margin-top:24px;padding:16px;background:#1a1a1a;border-radius:12px;border:1px solid #2a2a2a;">
                        <p style="margin:0 0 6px;font-size:11px;color:#555555;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Atau copy link ini:</p>
                        <p style="margin:0;font-size:12px;color:#7c3aed;word-break:break-all;">${resetUrl}</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 40px 32px;text-align:center;border-top:1px solid #1f1f1f;">
                      <p style="margin:0;font-size:11px;color:#444444;">© 2026 MafynGate · Secure Social Messaging</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (data.error) {
      console.error('❌ [Resend] API Error:', data.error);
      throw new Error(data.error.message);
    }

    console.log('✅ [Resend] Email sent successfully:', data.id);
  } catch (error) {
    console.error('❌ [Resend] Failed to send email:', error);
    throw error;
  }
};

module.exports = { sendPasswordResetEmail };
