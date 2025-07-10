import dotenv from 'dotenv';
import * as emailModel from '../models/emailModel.js';
import { handleServerError } from '../helpers/handleWithErrors.js';
import { sendOtpMail } from '../config/mailer.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';


dotenv.config();

export const sendOtpToEmail = async (req, res) => {
  const { email } = req.body;
  try {
      if (!email) {
        return res.status(400).json({ 
            error: 'Email is required.' ,
            message: 'Email is required.'
        });
      };

    const user = await emailModel.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found.' ,
        message: 'User not found.' 
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();

    await emailModel.updateUserOtp(user.id, otp, now);
    await sendOtpMail(email, otp);

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully.'
    });

  } catch (error) {
    return handleServerError(res, error);
  }
};
  
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ 
      error: 'Email and OTP are required.',
      message : "Email and OTP are required"
    });
  }

  try {
    const user = await emailModel.getUserOtpDetails(email);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found.' ,
        message: 'User not found'
    });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ 
        error: 'Invalid OTP.',
        message: "Invalid OTP"
    });
    }

    const now = new Date();
    const created = new Date(user.otp_created_at);
    const diffMinutes = (now - created) / (1000 * 60);

    if (diffMinutes > 10) {
      return res.status(410).json({ 
        error: 'OTP expired.',
        message: 'OTP expired.' 
    });
    }

    await emailModel.clearUserOtp(user.id);

    // Generate reset token and store it
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetCreatedAt = new Date();
    await emailModel.storeResetToken(user.id, resetToken, resetCreatedAt);

    return res.status(200).json({
      success: true,
      message: 'OTP verified.',
      reset_token: resetToken
    });
  } catch (error) {
    return handleServerError(res, error);
  }
};
// reset password
export const resetPassword = async (req, res) => {
  try {
    const { email, reset_token, new_password } = req.body;

    if (!email || !reset_token || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.'
      });
    }

    const user = await emailModel.getResetTokenDetails(email);

    if (!user || user.reset_token !== reset_token) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }

    const diffMinutes = (new Date() - new Date(user.reset_token_created_at)) / (1000 * 60);

    if (diffMinutes > 15) {
      return res.status(410).json({
        success: false,
        message: 'Reset token expired.'
      });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await emailModel.updateUserPassword(user.id, hashed);

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.'
    });

  } catch (err) {
    return handleServerError(res, err); 
  }
};

