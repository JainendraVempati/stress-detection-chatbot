const nodemailer = require('nodemailer');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const EMAIL_FROM = process.env.EMAIL_FROM || 'StressBot <no-reply@stressbot.app>';
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = Number(process.env.EMAIL_PORT) || 587;
const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

let transporter = null;
if (EMAIL_HOST && EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_SECURE,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
  console.log('SMTP transporter initialized successfully');
} else {
  console.error('SMTP not configured. Please check your .env file.');
}

async function sendOTP(email, otp) {
  console.log(`Attempting to send OTP to ${email}`);
  console.log(`SMTP transporter available: ${!!transporter}`);
  
  if (!transporter) {
    console.error('No email transport configured.');
    return { sent: false, error: 'Email service not configured. Please contact support.' };
  }

  const emailBody = {
    from: EMAIL_FROM,
    to: email,
    subject: 'Your StressBot verification code',
    text: `Your StressBot OTP is ${otp}. It expires in 5 minutes.`,
    html: `<p>Your StressBot OTP is <strong>${otp}</strong>. It expires in 5 minutes.</p>`,
  };

  try {
    console.log('Sending email via SMTP...');
    const info = await transporter.sendMail(emailBody);
    console.log('SMTP email sent successfully:', info.messageId);
    return { sent: true };
  } catch (error) {
    const message = error?.message || JSON.stringify(error) || 'Unknown SMTP error';
    console.error('SMTP email send error:', message);
    console.error('Full error object:', error);
    return { sent: false, error: `Failed to send OTP email: ${message}` };
  }
}

module.exports = {
  sendOTP,
};
