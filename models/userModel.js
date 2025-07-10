import db from '../config/db.js';
import { getISTDateTime } from '../helpers/dateTimeFormat.js';
import { emptyOrRows } from '../helpers/queryHelper.js';
import moment from 'moment-timezone';
 //   name, email, password, phone, role , qualification, created-at, id
export async function getAllUsers() {
  const [rows] = await db.query(`SELECT * FROM users`);
  return emptyOrRows(rows);
}

export async function createUser(data) {
  const {
    name,
    email,
    password,
    phone,
    role,
    gender,
    qualification = '',
    bio = '',
    affiliation = '', image = ''
  } = data;

  let table;
  if (role === "student") {
    table = "users";
  } else if (role === "instructor") {
    table = "instructors";
  } else {
    throw new Error("Invalid role specified");
  }

  const [result] = await db.query(
    `INSERT INTO ${table} 
    (name, email, password, phone, role, gender, qualification, bio, affiliation, image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      password,
      phone,
      role,
      gender,
      qualification,
      bio,
      affiliation,
      image
    ]
  );

  return {
    id: result.insertId,
    name,
    email,
    role,
    gender,
    phone,
    qualification,
    bio,
    affiliation
  };
}


// profile details
export const getStudentFullDetails = async (user_id) => {
  const [rows] = await db.execute(`
    SELECT 
      id, name, email, phone, status, qualification, role,
      gender, experience, affiliation, image, company,
      created_at, updated_at
    FROM users
    WHERE id = ?
  `, [user_id]);

  return rows[0] || null;
};


export const updateStudentDetailsById = async (userId, updateData) => {
  try {
    const allowedFields = [
      'name', 'email', 'phone', 'gender',
      'affiliation', 'image', 'company', 'experience', 'qualification' 
    ];

    // Email uniqueness check
    if (updateData?.email) {
      const [emailExists] = await db.query(
        `SELECT id FROM users WHERE email = ? AND id != ?`,
        [updateData.email, userId]
      );
      if (emailExists.length > 0) {
        return { error: 'Email already exists' };
      }
    }
    // console.log(updateData);
    // Phone uniqueness check
    if (updateData?.phone) {
      const [phoneExists] = await db.query(
        `SELECT id FROM users WHERE phone = ? AND id != ?`,
        [updateData.phone, userId]
      );
      if (phoneExists.length > 0) {
        return { error: 'Phone number already exists' };
      }
    }

    // Filter valid fields
    const fieldsToUpdate = Object.keys(updateData).filter(field =>
      allowedFields.includes(field)
    );

    if (fieldsToUpdate.length === 0) {
      throw new Error('No valid fields to update');
    }
    // console.log("Fields to update:", fieldsToUpdate);

    const nowIstTimeDate = getISTDateTime();

    // Build query
    const setClause = fieldsToUpdate.map(field => `${field} = ?`).join(', ');
    const values = fieldsToUpdate.map(field => updateData[field]);

    // ✅ Add updated_at and userId to the values
    const sql = `UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`;
    values.push(nowIstTimeDate, userId);

    const [result] = await db.execute(sql, values);

    return { result, updatedFields: fieldsToUpdate };

  } catch (err) {
    console.error('Update Error:', err.message);
    throw err;
  }
};



export async function findUserByEmail(email, role) {
  let table;
  if (role === "student") {
    table = "users";
  } else if (role === "instructor") {
    table = "instructors";
  } else {
    throw new Error("Invalid role specified");
  } 
  const [rows] = await db.query(`SELECT * FROM ${table} WHERE email = ?`, [email]);
  return rows[0];
}




export const getCourseProgressData = async (userId, courseId) => {
  // Check if payment exists and is paid
  const [payment] = await db.query(`
    SELECT id FROM course_payments
    WHERE user_id = ? AND course_id = ? AND status = 'paid' LIMIT 1
  `, [userId, courseId]);

  if (payment.length === 0) return [];

  // Fetch progress details
  const [result] = await db.query(`
    SELECT
      curr.id AS curriculum_id,
      curr.title AS curriculum_title,
      sub.id AS sub_detail_id,
      sub.name AS sub_detail_name,
      sub.type,
      sub.duration,
      sub.sequence,
      sub.content_url,
      progress.status
    FROM course_curriculums curr
    JOIN course_curriculum_sub_details sub ON sub.curriculum_id = curr.id
    LEFT JOIN user_curriculum_progress progress 
      ON progress.sub_detail_id = sub.id AND progress.user_id = ? AND progress.course_id = ?
    WHERE curr.course_id = ?
    ORDER BY curr.sequence ASC, sub.sequence ASC
  `, [userId, courseId, courseId]);

  return result;
};





// export const getUserEnrolledCoursesWithBatches = async (user_id) => {
//   const [rows] = await db.execute(
//     `SELECT 
//       cp.course_id,
//       cp.batch_id,
//       ce.payment_method,
//       cb.batch_name,
//       c.name,
//       c.instructor_name,
//       c.level,
//       c.image,
//       c.duration_time,
//       c.price,
//       c.sub_categories
//     FROM course_payments cp
//     JOIN course_enrollments ce 
//       ON ce.user_id = cp.user_id 
//       AND ce.course_id = cp.course_id 
//       AND ce.batch_id = cp.batch_id
//     JOIN courses c ON cp.course_id = c.id
//     JOIN course_batches cb ON cp.batch_id = cb.id
//     WHERE cp.user_id = ? AND cp.status = 'paid'`,
//     [user_id]
//   );

//   return rows;
// };

export const getUserEnrolledCoursesWithBatches = async (user_id) => {
  const [rows] = await db.execute(
    `SELECT 
      ce.course_id,
      ce.batch_id,
      ce.payment_method,
      cb.batch_name,
      c.name,
      c.instructor_name,
      c.level,
      c.image,
      c.duration_time,
      c.price,
      c.sub_categories,
      latest_ce.latest_enrollment_date AS enrollment_date  -- ✅ expose for clarity
    FROM course_enrollments ce
    JOIN (
      SELECT course_id, batch_id, MAX(enrollment_date) AS latest_enrollment_date
      FROM course_enrollments
      WHERE user_id = ? AND isItUserPaid = 1
      GROUP BY course_id, batch_id
    ) latest_ce 
      ON ce.course_id = latest_ce.course_id 
     AND ce.batch_id = latest_ce.batch_id 
     AND ce.enrollment_date = latest_ce.latest_enrollment_date  -- ✅ use enrollment_date here
    JOIN courses c ON ce.course_id = c.id
    JOIN course_batches cb ON ce.batch_id = cb.id
    WHERE ce.user_id = ? AND ce.isItUserPaid = 1
    ORDER BY latest_ce.latest_enrollment_date DESC`,
    [user_id, user_id]
  );

  return rows;
};




export const getCourseEmisForUser = async (user_id, course_id, batch_id) => {
  const [rows] = await db.execute(
    `SELECT id, installment_amount, due_date, paid, paid_at
     FROM course_emis
     WHERE user_id = ? AND course_id = ? AND batch_id = ?`,
    [user_id, course_id, batch_id]
  );
  return rows;
};


/**
 * Calculate batch progress using IST and session end time.
 *
 * @param {number} totalLessons - Total lessons.
 * @param {Date} batchStartDate - Batch start date.
 * @param {Date} batchEndDate - Batch end date.
 * @param {string} sessionEndTime - 'HH:MM:SS'
 * @returns {{ completedLessons: number, percent: number }}
 */
export const  calculateBatchProgressWithSessionIST = async (
  totalLessons,
  batchStartDate,
  batchEndDate,
  sessionEndTime
) => {
  const nowIST = moment.tz(getISTDateTime(), 'Asia/Kolkata');

  const start = moment.tz(batchStartDate, 'Asia/Kolkata').startOf('day');
  const end = moment.tz(batchEndDate, 'Asia/Kolkata').endOf('day');

  if (nowIST.isBefore(start)) {
    return { completedLessons: 0, percent: 0 };
  }

  // Total days inclusive
  const totalDays = end.diff(start, 'days') + 1;
  const daysElapsed = nowIST.clone().startOf('day').diff(start, 'days');

  let completedDays = daysElapsed;

  // Build today's session end datetime
  const [h, m, s] = sessionEndTime.split(':').map(Number);
  const todaySessionEnd = nowIST.clone().set({ hour: h, minute: m, second: s });

  if (nowIST.isAfter(todaySessionEnd)) {
    completedDays += 1;
  }

  completedDays = Math.max(0, Math.min(completedDays, totalDays));
  const completedLessons = Math.min(completedDays, totalLessons);

  const percent = totalLessons > 0
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;

  return { completedLessons, percent };
}


// 1. Basic Course Info
export const getCourseOverviewData = async (courseId) => {
  const [rows] = await db.execute(
    `SELECT name, instructor_name, level, instructorBadge, image FROM courses WHERE id = ?`,
    [courseId]
  );
  return rows[0];
};

// 2. Course Extra Overview
export const getCourseOverviewExtras = async (courseId) => {
  const [rows] = await db.execute(
    `SELECT long_overview, learning_outcomes, requirements, faqs
     FROM course_overview
     WHERE course_id = ?`,
    [courseId]
  );

  if (rows[0]) {
    return {
      long_overview: rows[0].long_overview,
      learning_outcomes: JSON.parse(rows[0].learning_outcomes),
      requirements: JSON.parse(rows[0].requirements),
      faqs: JSON.parse(rows[0].faqs)
    };
  }
  return null;
};

// 3. Curriculum Titles Only
export const getCourseCurriculumTitles = async (courseId) => {
  const [rows] = await db.execute(
    `SELECT id, title FROM course_curriculums WHERE course_id = ? ORDER BY sequence ASC`,
    [courseId]
  );
  return rows;
};


export const getFullCurriculumById = async (id) => {
  const [rows] = await db.execute(
    `SELECT id, title, description, duration, content_url
     FROM course_curriculums
     WHERE id = ?`,
    [id]
  );
  return rows[0];
};