const axios = require('axios');

const sendWelcomeEmail = async (name, email) => {
  try {
    await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: { name: 'REHANVERSE', email: 'rehanverse.app@gmail.com' },
      to: [{ email: email, name: name }],
      subject: '🎉 Welcome to REHANVERSE!',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #4f46e5; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">🎓 REHANVERSE</h1>
            <p style="color: #c7d2fe; margin: 8px 0 0;">Learn anything, anytime</p>
          </div>
          <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px;">
            <h2 style="color: #1e293b;">Welcome, ${name}! 👋</h2>
            <p style="color: #64748b;">Aapka REHANVERSE mein swagat hai! Ab aap hamare saare courses access kar sakte hain.</p>
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
    }, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Welcome email sent!');
  } catch (err) {
    console.log('❌ Email error:', err.response?.data || err.message);
  }
};

const sendAdminNotification = async (name, email) => {
  try {
    await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: { name: 'REHANVERSE', email: 'rehanverse.app@gmail.com' },
      to: [{ email: 'rehanverse.app@gmail.com', name: 'Admin' }],
      subject: '🔔 Naya User Register Hua!',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: #4f46e5; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
            <h2 style="color: white; margin: 0;">🔔 Naya User!</h2>
          </div>
          <div style="background: white; padding: 24px; border-radius: 12px;">
            <p style="color: #1e293b;"><strong>Name:</strong> ${name}</p>
            <p style="color: #1e293b;"><strong>Email:</strong> ${email}</p>
            <p style="color: #1e293b;"><strong>Time:</strong> ${new Date().toLocaleString('en-IN')}</p>
            <a href="https://rehanverse-frontend.vercel.app/admin" 
              style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Admin Panel Dekho
            </a>
          </div>
        </div>
      `
    }, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Admin notification sent!');
  } catch (err) {
    console.log('❌ Admin email error:', err.response?.data || err.message);
  }
};

module.exports = { sendWelcomeEmail, sendAdminNotification };