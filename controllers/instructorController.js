import bcrypt from "bcrypt";
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import * as InstructorModel from "../models/instructorModel.js";
import db from "../config/db.js";
import { handleServerError } from "../helpers/handleWithErrors.js";
import { getISTDateTime } from '../helpers/dateTimeFormat.js';
import { getBaseUrl } from "../config/getBaseUrl.js";
import { sendOtpMail } from "../config/mailer.js";
import { deleteUploadedFile } from "../helpers/uploadingFolders.js";

export const newRegisterForInstructor = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      confirm_password,
      phone,
      gender,
      specialties,
      experience,
      institute_name,
    } = req.body;

    const [existingEmail] = await db.query(
      `SELECT id FROM instructors WHERE email = ? LIMIT 1`,
      [email]
    );

    if (existingEmail?.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered.",
      });
    }

    const [existingPhone] = await db.query(
      `SELECT id FROM instructors WHERE phone = ? LIMIT 1`,
      [phone]
    );

    if (existingPhone?.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Phone number is already registered.",
      });
    }

    if (password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: "Password and confirm password do not match.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const role = "instructor";
    const status = "pending";

    const data = await InstructorModel.createInstro({
      name,
      email,
      password: hashedPassword,
      phone,
      gender,
      role,
      status,
      specialties: JSON.stringify(specialties),
      experience,
      institute_name,
    });

    return res.status(201).json({
      success: true,
      message: "Registered successfully",
      instructorId: data.insertId,
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};


export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const instructor = await InstructorModel.findInstructorByEmail(email);
    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }

    let match = false;
    const isHashed = instructor.password.startsWith('$2b$') || instructor.password.startsWith('$2a$');
    if (isHashed) {
      match = await bcrypt.compare(password, instructor.password);
    } else {
      if (password === instructor.password) {
        match = true;
        const hashedPassword = await bcrypt.hash(password, 10);
        await InstructorModel.updateInstructorPassword(instructor.id, hashedPassword);
      } else {
        match = false;
      }
    }

    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Create JWT
    const token = jwt.sign(
      { id: instructor.id, email: instructor.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const instructorData = {
      id: instructor.id,
      name: instructor.name || '',
      email: instructor.email || '',
      phone: instructor.phone || '',
      role: 'instructor',
      qualification: instructor.qualification || null,
      created_at: instructor.created_at || null
    };

    return res.status(200).json({
      success: true,
      message: "Instructor login successfully",
      token,
      instructor: instructorData
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};


export const getInstructorDetailsOnProfile = async (req, res) => {
  const instructor_id = req.instructor.id;

  try {
    const instructorDetails = await InstructorModel.getInstructorFullDetails(instructor_id);

    if (!instructorDetails) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Instructor details fetched successfully",
      instructor: instructorDetails
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};


export const editInstructorDetails = async (req, res) => {
  const instructorId = req.instructor?.id; // ✅ Comes from verifyTokenInstructor
  const updateData = req.body;

  // ✅ Parse specialties if it’s JSON string
  if (updateData.specialties) {
    try {
      const parsed = JSON.parse(updateData.specialties);
      if (Array.isArray(parsed)) {
        updateData.specialties = parsed; // Keep as array — model will stringify
      } else {
        return res.status(400).json({
          success: false,
          message: "Specialties must be a JSON array"
        });
      }
    } catch (err) {
      return handleServerError(res, err);
    }
  }

  // ✅ Handle uploaded image
  const uploadedImage = req.file;
  if (uploadedImage) {
    const folder = 'instructors';
    const baseUrl = getBaseUrl(req);
    updateData.image = `${baseUrl}/uploads/${folder}/${uploadedImage.filename}`;

    // 👉 Get the old image
    const [[existing]] = await db.query(
      `SELECT image FROM instructors WHERE id = ? LIMIT 1`,
      [instructorId]
    );
    const oldImage = existing?.image;

    if (oldImage) {
      try {
        deleteUploadedFile(oldImage, folder);
      } catch (err) {
        console.warn(`Failed to delete old instructor image: ${err.message}`);
      }
    }
  }

  try {
    const { result, updatedFields, error } = await InstructorModel.updateInstructorDetailsById(
      instructorId,
      updateData
    );

    if (error === 'Email already exists') {
      return res.status(409).json({
        success: false,
        message: 'Email already exists',
        error
      });
    }

    if (error === 'Phone number already exists') {
      return res.status(409).json({
        success: false,
        message: 'Phone number already exists',
        error
      });
    }

    if (result?.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found or nothing to update'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Instructor details updated successfully',
      updatedFields
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};

export const changeInstructorPassword = async (req, res) => {
  const instructorId = req.instructor?.id; // ✅ Comes from verifyTokenInstructor
  const { oldPassword, newPassword, confirmPassword } = req.body;

  try {
    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'New password and confirm password do not match' 
      });
    }

    // ✅ Always instructors table
    const [rows] = await db.query(
      `SELECT password FROM instructors WHERE id = ?`,
      [instructorId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Instructor not found' 
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, rows[0].password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Old password is incorrect' 
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const nowIstTimeDate = getISTDateTime();

    await db.query(
      `UPDATE instructors SET password = ?, updated_at = ? WHERE id = ?`,
      [hashedPassword, nowIstTimeDate, instructorId]
    );

    return res.status(200).json({ 
      success: true, 
      message: 'Password updated successfully' 
    });

  } catch (error) {
    return handleServerError(res, error);
  }
};

export const getInstructorCoursesDetails = async (req, res) => {
  const instructorId = req.instructor?.id;
  try {
    const courses = await InstructorModel.getInstructorCourses(instructorId);
    // console.log("line 305", courses)
    return res.status(200).json({
      success: true,
      message: "Instructor courses fetched successfully",
      courses: courses || []
    });
  } catch (error) {
    return handleServerError(res, error);
  }
};


export const getBatchesForCourseForInstructor = async (req, res) => {
  const courseId = Number(req.params.course_id);

  if (!courseId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid course_id'
    });
  }

  try {
    const batches = await InstructorModel.getBatchesDetailsCourse(courseId);

    return res.status(200).json({
      success: true,
      batches: batches
    });

  } catch (error) {
    return handleServerError(res, error);
  }
};


export const getInstructorSummaryController = async (req, res) => {
  try {
    const instructorId = req.instructor?.id;

    const summary = await InstructorModel.getInstructorSummary(instructorId);

    return res.status(200).json({
      success: true,
      data: summary
    });

  } catch (err) {
    handleServerError(res, err);
  }
};


// forgot password
export const sendOtpToInstructorEmail = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required.',
        message: 'Email is required.'
      });
    }

    const instructor = await InstructorModel.getInstructorByEmail(email);
    if (!instructor) {
      return res.status(404).json({ 
        error: 'Instructor not found.',
        message: 'Instructor not found.'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();

    await InstructorModel.updateInstructorOtp(instructor.id, otp, now);
    await sendOtpMail(email, otp); // ✅ same mail function

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully.'
    });

  } catch (error) {
    return handleServerError(res, error);
  }
};

export const verifyInstructorOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ 
      error: 'Email and OTP are required.',
      message: 'Email and OTP are required.'
    });
  }

  try {
    const instructor = await InstructorModel.getInstructorOtpDetails(email);
    if (!instructor) {
      return res.status(404).json({ 
        error: 'Instructor not found.',
        message: 'Instructor not found.'
      });
    }

    if (instructor.otp !== otp) {
      return res.status(400).json({ 
        error: 'Invalid OTP.',
        message: 'Invalid OTP.'
      });
    }

    const now = new Date();
    const created = new Date(instructor.otp_created_at);
    const diffMinutes = (now - created) / (1000 * 60);

    if (diffMinutes > 10) {
      return res.status(410).json({ 
        error: 'OTP expired.',
        message: 'OTP expired.'
      });
    }

    await InstructorModel.clearInstructorOtp(instructor.id);

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetCreatedAt = new Date();
    await InstructorModel.storeInstructorResetToken(instructor.id, resetToken, resetCreatedAt);

    return res.status(200).json({
      success: true,
      message: 'OTP verified.',
      reset_token: resetToken
    });

  } catch (error) {
    return handleServerError(res, error);
  }
};


export const resetInstructorPassword = async (req, res) => {
  try {
    const { email, reset_token, new_password } = req.body;

    if (!email || !reset_token || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.'
      });
    }

    const instructor = await InstructorModel.getInstructorResetTokenDetails(email);

    if (!instructor || instructor.reset_token !== reset_token) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }

    const diffMinutes = (new Date() - new Date(instructor.reset_token_created_at)) / (1000 * 60);

    if (diffMinutes > 15) {
      return res.status(410).json({
        success: false,
        message: 'Reset token expired.'
      });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await InstructorModel.updateInstructorPasswordWithForgot(instructor.id, hashed);

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.'
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};

