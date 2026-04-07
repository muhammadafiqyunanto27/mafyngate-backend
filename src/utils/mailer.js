const nodemailer = require('nodemailer');

let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  let config;
  if (process.env.SMTP_USER && process.env.SMTP_USER !== 'testuser@ethereal.email') {
    config = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };
  } else {
    // Generate temporary Ethereal account for testing
    console.log('Generating temporary Ethereal email account...');
    const testAccount = await nodemailer.createTestAccount();
    config = {
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    };
    console.log('Ethereal Account Created:', testAccount.user);
  }

  transporter = nodemailer.createTransport(config);
  return transporter;
}

exports.sendVerificationEmail = async (email, token) => {
  const currentTransporter = await getTransporter();
  
  const mailOptions = {
    from: '"MafynGate Security" <security@mafyngate.com>',
    to: email,
    subject: 'Verification Code - MafynGate',
    text: `Your verification code is: ${token}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; rounded: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">MafynGate Verification</h2>
        <p>Hello,</p>
        <p>You requested a verification code for your account. Please use the code below:</p>
        <div style="font-size: 32px; font-weight: bold; text-align: center; letter-spacing: 5px; padding: 20px; background: #f3f4f6; border-radius: 8px; margin: 20px 0; color: #111827;">
          ${token}
        </div>
        <p style="font-size: 14px; color: #666;">This code will expire in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `
  };

  try {
    const info = await currentTransporter.sendMail(mailOptions);
    console.log('--- EMAIL VERIFICATION ---');
    console.log('TO:', email);
    console.log('OTP CODE:', token);
    
    // Log preview URL if using Ethereal
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('PREVIEW URL:', previewUrl);
    }
    console.log('--------------------------');
    return info;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};
