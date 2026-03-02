import nodemailer from 'nodemailer';

// NOTE: For production, use real SMTP credentials in .env
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendOTPEmail(email: string, otp: string) {
  const mailOptions = {
    from: `"TradeLog" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Verification Code - TradeLog',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded: 10px;">
        <h2 style="color: #3b82f6; text-align: center;">Welcome to TradeLog</h2>
        <p>Hello,</p>
        <p>Your verification code is high-security. Please use the following OTP to complete your registration or password reset:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111827; border-radius: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center;">TradeLog Analytics - Advanced Trading Dashboard</p>
      </div>
    `,
  };

  try {
    // In dev, we might not have real credentials, so we log it
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('--- MOCK EMAIL SENT ---');
      console.log(`To: ${email}`);
      console.log(`OTP: ${otp}`);
      console.log('-----------------------');
      return { success: true, mock: true };
    }
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error };
  }
}
