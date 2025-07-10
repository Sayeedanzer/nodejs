import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import logger from '../helpers/logger.js';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  secure: process.env.MAIL_ENCRYPTION === 'ssl',
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD
  }
});

export const sendOtpMail = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
      to: email,
      subject: '🔐 Reset Password - Your OTP Code',
      html: `
        <div style="max-width:600px;margin:20px auto;padding:30px;border-radius:12px;background:linear-gradient(135deg,#f0f0f0,#ffffff);box-shadow:0 4px 20px rgba(0,0,0,0.1);font-family:sans-serif;color:#333;">
          <h2 style="text-align:center;color:#0d6efd;margin-bottom:15px;">🚀 Password Reset Request</h2>
          <p style="font-size:16px;line-height:1.5;">Hello,</p>
          <p style="font-size:16px;line-height:1.5;">Someone (hopefully you) has requested to reset your password. Use the OTP below to proceed:</p>
          <div style="text-align:center;margin:30px 0;">
            <span style="display:inline-block;background:#0d6efd;color:#fff;font-size:32px;font-weight:bold;padding:15px 30px;border-radius:8px;letter-spacing:3px;">${otp}</span>
          </div>
          <p style="font-size:15px;line-height:1.5;">⚡️ <b>Validity:</b> This OTP is valid for <b>10 minutes</b>. Please do not share it with anyone for security reasons.</p>
          <p style="font-size:15px;line-height:1.5;">If you didn’t request this, you can safely ignore this email. Your password will remain unchanged.</p>
          <hr style="border:none;border-top:1px solid #ddd;margin:30px 0;">
          <p style="font-size:13px;color:#666;text-align:center;">🔒 Stay secure!<br>${process.env.MAIL_FROM_NAME}</p>
        </div>
      `
    });
    logger.info(`✅ OTP email sent to ${email}`);
  } catch (error) {
    logger.error(`❌ Error sending OTP email to ${email}: ${error.message}`);
  }
};


export const sendEmiReminder = async (email, name, amount, courseName, dueDate) => {
  const formattedDate = new Date(dueDate).toISOString().split('T')[0];

  try {
    await transporter.sendMail({
      from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
      to: email,
      subject: `⏰ EMI Payment Reminder - ${courseName}`,
      html: `
        <div style="max-width:600px;margin:20px auto;padding:30px;border-radius:12px;background:linear-gradient(135deg,#fff3e0,#ffffff);box-shadow:0 4px 20px rgba(0,0,0,0.1);font-family:sans-serif;color:#333;">
          <h2 style="text-align:center;color:#ff9800;margin-bottom:15px;">⚠️ EMI Payment Reminder</h2>
          <p style="font-size:16px;line-height:1.5;">Hi <strong>${name}</strong>,</p>
          <p style="font-size:16px;line-height:1.5;">This is a gentle reminder that your next EMI of 
            <span style="color:#f57c00;font-weight:bold;">₹${amount}</span> 
            for the course <strong>${courseName}</strong> is due on 
            <strong>${formattedDate}</strong>.
          </p>
          <div style="text-align:center;margin:30px 0;">
            <span style="display:inline-block;background:#f57c00;color:#fff;font-size:20px;font-weight:bold;padding:12px 25px;border-radius:8px;">Due Date: ${formattedDate}</span>
          </div>
          <p style="font-size:15px;line-height:1.5;">Please make sure to complete the payment before the due date to avoid any penalties or service interruptions.</p>
          <p style="font-size:15px;line-height:1.5;">If you’ve already paid, please ignore this email.</p>
          <hr style="border:none;border-top:1px solid #ddd;margin:30px 0;">
          <p style="font-size:13px;color:#666;text-align:center;">💡 Need help? Reach out anytime.<br>${process.env.MAIL_FROM_NAME} Team</p>
        </div>
      `
    });
    logger.info(`✅ EMI reminder email sent to ${email}`);
  } catch (error) {
    logger.error(`❌ Error sending EMI reminder to ${email}: ${error.message}`);
  }
};


export const sendPaymentConfirmation = async (email, name, courseName, amount) => {
  try {
    await transporter.sendMail({
      from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
      to: email,
      subject: `🎉 Payment Successful - ${courseName}`,
      html: `
        <div style="max-width:600px;margin:20px auto;padding:30px;border-radius:12px;background:linear-gradient(135deg,#e0f7fa,#ffffff);box-shadow:0 4px 20px rgba(0,0,0,0.1);font-family:sans-serif;color:#333;">
          <h2 style="text-align:center;color:#28a745;margin-bottom:15px;">✅ Payment Received!</h2>
          <p style="font-size:16px;line-height:1.5;">Hi <strong>${name}</strong>,</p>
          <p style="font-size:16px;line-height:1.5;">Thank you for your payment of <span style="color:#28a745;font-weight:bold;">₹${amount}</span> for the course <strong>${courseName}</strong>.</p>
          <div style="text-align:center;margin:30px 0;">
            <span style="display:inline-block;background:#28a745;color:#fff;font-size:22px;font-weight:bold;padding:12px 25px;border-radius:8px;">Enrollment Confirmed 🎓</span>
          </div>
          <p style="font-size:15px;line-height:1.5;">Your enrollment is now <strong>confirmed</strong>. You can access your course anytime from your student dashboard.</p>
          <p style="font-size:15px;line-height:1.5;">If you have any questions or need help, feel free to reach out. We’re here for you! 💚</p>
          <hr style="border:none;border-top:1px solid #ddd;margin:30px 0;">
          <p style="font-size:13px;color:#666;text-align:center;">Thank you for choosing us!<br>${process.env.MAIL_FROM_NAME} Team</p>
        </div>
      `
    });
    logger.info(`✅ Payment confirmation email sent to ${email}`);
  } catch (error) {
    logger.error(`❌ Error sending payment confirmation to ${email}: ${error.message}`);
  }
};
