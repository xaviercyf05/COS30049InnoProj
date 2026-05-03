const nodemailer = require('nodemailer');

// Email configuration from environment variables
// Note: EMAIL_HOST in .env is the email ADDRESS (sfcadmin.noreply@gmail.com), not the SMTP host
const emailConfig = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_HOST || 'sfcadmin.noreply@gmail.com',
    pass: process.env.EMAIL_APP_PASSWORD || '',
  },
};

// Create reusable transporter
const transporter = nodemailer.createTransport(emailConfig);

/**
 * Send account activation email to newly approved registration
 * @param {string} email - Recipient email address
 * @param {string} fullName - Full name of the user
 * @param {string} verificationLink - Complete verification link URL
 * @returns {Promise<object>} - Email send result
 */
async function sendAccountActivationEmail(email, fullName, verificationLink) {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Activate Your Account</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f5f5;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #2E6B4D 0%, #445A4D 100%);
          color: #ffffff;
          padding: 30px 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .content {
          padding: 30px 20px;
        }
        .content h2 {
          color: #2E6B4D;
          font-size: 20px;
          margin-top: 0;
          margin-bottom: 16px;
        }
        .content p {
          margin: 12px 0;
          font-size: 14px;
          color: #555;
        }
        .requirements {
          background-color: #ECF2E5;
          border-left: 4px solid #2E6B4D;
          padding: 16px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .requirements h3 {
          margin-top: 0;
          margin-bottom: 12px;
          color: #2E6B4D;
          font-size: 16px;
        }
        .requirements ul {
          margin: 0;
          padding-left: 20px;
          font-size: 13px;
          color: #555;
        }
        .requirements li {
          margin: 6px 0;
        }
        .cta-button {
          display: inline-block;
          background-color: #2E6B4D;
          color: #ffffff;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 15px;
          margin: 24px 0;
          transition: background-color 0.2s ease;
        }
        .cta-button:hover {
          background-color: #1f4a37;
        }
        .button-container {
          text-align: center;
        }
        .link-info {
          background-color: #f9f9f9;
          border: 1px solid #e0e0e0;
          padding: 16px;
          border-radius: 4px;
          margin: 16px 0;
          font-size: 13px;
          color: #666;
          word-break: break-all;
        }
        .footer {
          background-color: #f5f5f5;
          border-top: 1px solid #e0e0e0;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #999;
        }
        .footer p {
          margin: 6px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to Sarawak National Parks!</h1>
        </div>
        <div class="content">
          <h2>Hello ${escapeHtml(fullName)},</h2>
          <p>Congratulations! Your registration has been approved by the Sarawak Forestry Corporation admin team.</p>
          <p>To complete your account setup and begin your training as a park guide, please activate your account by clicking the button below:</p>
          
          <div class="button-container">
            <a href="${escapeHtml(verificationLink)}" class="cta-button">Activate Account</a>
          </div>

          <p style="font-size: 13px; color: #999;">Or copy and paste this link in your browser:</p>
          <div class="link-info">
            ${escapeHtml(verificationLink)}
          </div>

          <div class="requirements">
            <h3>Next Steps:</h3>
            <ul>
              <li>Click the "Activate Account" button above</li>
              <li>You'll be able to log in with your username and password</li>
              <li>Access your training modules and materials</li>
              <li>Complete assessments and earn badges</li>
            </ul>
          </div>

          <p><strong>Important Security Note:</strong></p>
          <p>This activation link will expire in 7 days. If the link expires, you can request a new one by contacting the admin team.</p>
          <p style="font-size: 13px; color: #999;">If you did not submit a registration request or believe this email was sent in error, please contact the administrator immediately.</p>
        </div>
        <div class="footer">
          <p><strong>Sarawak Forestry Corporation</strong></p>
          <p>Park Guide Training & Qualification Program</p>
          <p style="margin-top: 12px; border-top: 1px solid #e0e0e0; padding-top: 12px;">
            This is an automated email. Please do not reply directly. Contact support at your admin portal.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: emailConfig.auth.user,
    to: email,
    subject: 'Activate Your Park Guide Account - Sarawak National Parks',
    html: htmlContent,
    text: generatePlainTextVersion(fullName, verificationLink),
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('Account activation email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Failed to send account activation email:', error);
    throw error;
  }
}

/**
 * Generate plain text version of the email for email clients that don't support HTML
 */
function generatePlainTextVersion(fullName, verificationLink) {
  return `
Welcome to Sarawak National Parks!

Hello ${fullName},

Congratulations! Your registration has been approved by the Sarawak Forestry Corporation admin team.

To complete your account setup and begin your training as a park guide, please visit the following link to activate your account:

${verificationLink}

This activation link will expire in 7 days.

Next Steps:
- Click the link above to activate your account
- You'll be able to log in with your username and password
- Access your training modules and materials
- Complete assessments and earn badges

If you did not submit a registration request or believe this email was sent in error, please contact the administrator immediately.

---
Sarawak Forestry Corporation
Park Guide Training & Qualification Program

This is an automated email. Please do not reply directly.
  `;
}

/**
 * Escape HTML special characters to prevent injection attacks
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Test the email configuration
 */
async function testEmailConnection() {
  try {
    await transporter.verify();
    console.log('✓ Email transporter is ready');
    return true;
  } catch (error) {
    console.error('✗ Email transporter error:', error.message);
    return false;
  }
}

module.exports = {
  sendAccountActivationEmail,
  testEmailConnection,
};
