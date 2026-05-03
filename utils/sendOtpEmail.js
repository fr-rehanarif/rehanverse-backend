const axios = require('axios');

const sendOtpEmail = async (email, otp, purpose = 'verification') => {
  try {
    if (!process.env.BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY missing in backend environment');
    }

    if (!email || !otp) {
      throw new Error('Email and OTP are required');
    }

    const isSignup = purpose === 'signup';

    const subject = isSignup
      ? `🔐 Verify your REHANVERSE account - OTP ${otp}`
      : `🔐 REHANVERSE Login OTP - ${otp}`;

    const title = isSignup
      ? 'Verify your REHANVERSE account'
      : 'Login verification';

    const message = isSignup
      ? 'Use this OTP to verify your email and create your REHANVERSE account.'
      : 'Use this OTP to complete your REHANVERSE login.';

    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: 'REHANVERSE',
          email: process.env.EMAIL_USER || 'rehanverse.app@gmail.com',
        },
        to: [
          {
            email,
            name: 'REHANVERSE User',
          },
        ],
        subject,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background:#f8fafc; padding: 24px;">
            <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 30px; border-radius: 18px 18px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">🎓 REHANVERSE</h1>
              <p style="color: #ddd6fe; margin: 8px 0 0;">Secure verification</p>
            </div>

            <div style="background: white; padding: 32px; border-radius: 0 0 18px 18px; border: 1px solid #e5e7eb;">
              <h2 style="color: #1e293b; margin-top: 0;">${title}</h2>

              <p style="color: #64748b; font-size: 15px; line-height: 1.6;">
                ${message}
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <div style="
                  display: inline-block;
                  background: #f5f3ff;
                  border: 1px solid #ddd6fe;
                  color: #6d28d9;
                  font-size: 36px;
                  font-weight: 900;
                  letter-spacing: 8px;
                  padding: 18px 28px;
                  border-radius: 16px;
                ">
                  ${otp}
                </div>
              </div>

              <div style="background: #f1f5f9; padding: 16px; border-radius: 12px; margin: 22px 0;">
                <p style="color: #475569; margin: 0; font-size: 14px;">
                  ⏳ This OTP is valid for <strong>10 minutes</strong>.
                </p>
                <p style="color: #475569; margin: 8px 0 0; font-size: 14px;">
                  🔒 Do not share this OTP with anyone.
                </p>
              </div>

              <p style="color: #94a3b8; font-size: 12px; margin-top: 28px;">
                If you did not request this OTP, you can safely ignore this email.
              </p>

              <p style="color: #94a3b8; font-size: 12px;">
                REHANVERSE Team ❤️
              </p>
            </div>
          </div>
        `,
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    console.log('✅ OTP email sent via Brevo:', {
      to: email,
      messageId: response.data?.messageId,
    });

    return response.data;
  } catch (err) {
    console.log('❌ OTP email error:', err.response?.data || err.message);

    throw new Error(
      err.response?.data?.message ||
        err.message ||
        'OTP email send failed'
    );
  }
};

module.exports = sendOtpEmail;