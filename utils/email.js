const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

const sendWelcomeEmail = async (name, email) => {
  try {
    await transporter.sendMail({
      from: `"REHANVERSE 🎓" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎉 Welcome to REHANVERSE!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 40px 20px;">
          <div style="background: #4f46e5; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎓 REHANVERSE</h1>
            <p style="color: #c7d2fe; margin: 8px 0 0;">Learn anything, anytime</p>
          </div>
          <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <h2 style="color: #1e293b;">Welcome, ${name}! 👋</h2>
            <p style="color: #64748b; line-height: 1.6;">Aapka REHANVERSE mein swagat hai! Ab aap hamare saare courses access kar sakte hain.</p>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; margin: 24px 0;">
              <p style="color: #475569; margin: 0; font-size: 14px;">🚀 Courses browse karo</p>
              <p style="color: #475569; margin: 8px 0 0; font-size: 14px;">📹 Videos dekho</p>
              <p style="color: #475569; margin: 8px 0 0; font-size: 14px;">📄 PDF Notes download karo</p>
            </div>
            <a href="https://rehanverse-frontend.vercel.app/courses" 
              style="display: inline-block; background: #4f46e5; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Courses Dekho 🎓
            </a>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">REHANVERSE Team ❤️</p>
          </div>
        </div>
      `
    });
    console.log('✅ Welcome email sent to:', email);
  } catch (err) {
    console.log('❌ Email error:', err);
  }
};

const sendAdminNotification = async (name, email) => {
  try {
    await transporter.sendMail({
      from: `"REHANVERSE 🎓" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: '🔔 Naya User Register Hua!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: #4f46e5; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
            <h2 style="color: white; margin: 0;">🔔 Naya User!</h2>
          </div>
          <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
            <p style="color: #1e293b; font-size: 16px;">Ek naya user register hua hai:</p>
            <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0; color: #475569;"><strong>Name:</strong> ${name}</p>
              <p style="margin: 8px 0 0; color: #475569;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 8px 0 0; color: #475569;"><strong>Time:</strong> ${new Date().toLocaleString('en-IN')}</p>
            </div>
            <a href="https://rehanverse-frontend.vercel.app/admin" 
              style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Admin Panel Dekho
            </a>
          </div>
        </div>
      `
    });
    console.log('✅ Admin notification sent!');
  } catch (err) {
    console.log('❌ Admin email error:', err);
  }
};

module.exports = { sendWelcomeEmail, sendAdminNotification };