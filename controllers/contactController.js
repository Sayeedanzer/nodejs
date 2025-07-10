import db from '../config/db.js'; // your MySQL db connection file
import { handleServerError } from '../helpers/handleWithErrors.js';

export const submitContactForm = async (req, res) => {
  try {
    const { first_name, last_name, email, phone, subject, message, message_type = "contact" } = req.body;

    // Basic validation
    if (!first_name || !last_name || !email || !subject || !message || !message_type) {
      return res.status(400).json({
        success: false,
        message: 'Required fields are missing.'
      });
    }

    await db.query(
      `INSERT INTO contact_messages (first_name, last_name, email, phone, subject, message, message_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, email, phone || null, subject, message, message_type]
    );

    return res.status(201).json({
      success: true,
      message: 'Your message has been submitted successfully.'
    });

  } catch (err) {
      return handleServerError(res, err);
  }
};



export const getAllContactMessages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 20;
    const offset = (page - 1) * perPage;

    const [rows] = await db.query(`
      SELECT 
        id,
        first_name,
        last_name,
        email,
        phone,
        subject,
        message,
        created_at
      FROM contact_messages
      ORDER BY created_at DESC
      LIMIT ${perPage} OFFSET ${offset}
    `);

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM contact_messages`);

    return res.status(200).json({
      success: true,
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
      messages: rows
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};