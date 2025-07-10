import db from "../config/db.js";
import { getISTDateTime } from "../helpers/dateTimeFormat.js";

export const createInstro = async ({
  name,
  email,
  password,
  phone,
  gender,
  role = "instructor",
  status = "pending",
  specialties = null,
  experience = null,
  institute_name = null, image= ''
}) => {
  const created_at = getISTDateTime();

  const [result] = await db.query(
    `
    INSERT INTO instructors (
      name, email, password, phone, gender, image, role, status,
      specialties, experience, institute_name, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      name,
      email,
      password,
      phone,
      gender,
      image,
      role,
      status,
      specialties,
      experience,
      institute_name,
      created_at
    ]
  );

  return result;
};


export async function findInstructorByEmail(email) {
  const [rows] = await db.query(
    `SELECT * FROM instructors WHERE email = ?`,
    [email]
  );
  return rows[0];
}


export async function updateInstructorPassword(instructorId, newHashedPassword) {
  await db.query(
    `UPDATE instructors SET password = ? WHERE id = ?`,
    [newHashedPassword, instructorId]
  );
}



export async function getInstructorFullDetails(instructor_id) {
  const [rows] = await db.query(
    `SELECT 
      id,
      name,
      email,
      phone,
      status,
      qualification,
      gender,
      bio,
      image,
      company,
      specialties,
      experience,
      institute_name,
      created_at,
      updated_at
    FROM instructors
    WHERE id = ?`,
    [instructor_id]
  );

  const instructor = rows[0];
  if (instructor && instructor.specialties) {
    try {
      instructor.specialties = JSON.parse(instructor.specialties);
    } catch {
      instructor.specialties = [];
    }
  }

  return instructor;
}


export const updateInstructorDetailsById = async (instructorId, updateData) => {
    try {
      const allowedFields = [
        'name',
        'email',
        'phone',
        'qualification',
        'gender',
        'bio',
        'image',
        'specialties',
        'experience',
        'institute_name'
      ];

      // ✅ Check email uniqueness
      if (updateData?.email) {
        const [emailExists] = await db.query(
          `SELECT id FROM instructors WHERE email = ? AND id != ?`,
          [updateData.email, instructorId]
        );
        if (emailExists.length > 0) {
          return { error: 'Email already exists' };
        }
      }

      // ✅ Check phone uniqueness
      if (updateData?.phone) {
        const [phoneExists] = await db.query(
          `SELECT id FROM instructors WHERE phone = ? AND id != ?`,
          [updateData.phone, instructorId]
        );
        if (phoneExists.length > 0) {
          return { error: 'Phone number already exists' };
        }
      }

      // ✅ Make sure specialties is JSON string
      if (updateData?.specialties && Array.isArray(updateData.specialties)) {
        updateData.specialties = JSON.stringify(updateData.specialties);
      }

      const fieldsToUpdate = Object.keys(updateData).filter(field =>
        allowedFields.includes(field)
      );

      if (fieldsToUpdate.length === 0) {
        throw new Error('No valid fields to update');
      }

      const nowIstTimeDate = getISTDateTime();
      const setClause = fieldsToUpdate.map(field => `${field} = ?`).join(', ');
      const values = fieldsToUpdate.map(field => updateData[field]);

      const sql = `UPDATE instructors SET ${setClause}, updated_at = ? WHERE id = ?`;
      values.push(nowIstTimeDate, instructorId);

      const [result] = await db.execute(sql, values);

      return { result, updatedFields: fieldsToUpdate };

    } catch (err) {
      console.error('Update Instructor Error:', err.message);
      throw err;
    }
}


export const getInstructorCourses = async (instructorId) => {
  try {
    const [courses] = await db.query(
      `
      SELECT
        c.id AS course_id,
        c.name AS course_name,
        c.category,
        c.sub_categories,
        c.created_at,
        (
          SELECT COUNT(*)
          FROM course_enrollments ce
          WHERE ce.course_id = c.id
        ) AS total_students,
        (
          SELECT COUNT(*)
          FROM course_batches cb
          WHERE cb.course_id = c.id
        ) AS total_batches
      FROM courses c
      WHERE c.instructor_id = ?
      `,
      [instructorId]
    );

    // ✅ Fix: Parse JSON string to real array
    const parsedCourses = courses.map(course => ({
      ...course,
      sub_categories: course.sub_categories
        ? JSON.parse(course.sub_categories)
        : []
    }));

    return parsedCourses;

  } catch (error) {
    console.error("DB Error in getInstructorCourses:", error.message);
    throw error;
  }
};


export const getBatchesDetailsCourse = async (courseId) => {
  try {
    const [batches] = await db.query(
      `
      SELECT
        id AS batch_id,
        batch_name,
        DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
        TIME_FORMAT(start_time, '%h:%i %p') AS start_time,
        TIME_FORMAT(end_time, '%h:%i %p') AS end_time,
        batch_number,
        meeting_link,
        (
          SELECT COUNT(*)
          FROM course_enrollments ce
          WHERE ce.batch_id = course_batches.id
        ) AS students_count,
        CASE
          WHEN end_date IS NOT NULL AND (
            end_date < CURDATE() OR
            (end_date = CURDATE() AND end_time < CURTIME())
          )
          THEN 'completed'
          ELSE 'active'
        END AS batch_status
      FROM course_batches
      WHERE course_id = ?
      ORDER BY start_date ASC
      `,
      [courseId]
    );

    return batches;

  } catch (error) {
    console.error('Error fetching batches:', error.message);
    throw error;
  }
};

export const getInstructorSummary = async (instructorId) => {
  try {
    const [courses] = await db.query(
      `SELECT id FROM courses WHERE instructor_id = ?`,
      [instructorId]
    );
    const courseIds = courses.map(c => c.id);

    const coursesCount = courseIds.length;

    if (coursesCount === 0) {
      return {
        courses_count: 0,
        students_count: 0,
        batches_count: 0,
        meetings_completed_count: 0,
        upcoming_batch: []
      };
    }

    // 2️⃣ Total students
    const [students] = await db.query(
      `SELECT COUNT(*) AS students_count 
       FROM course_enrollments 
       WHERE course_id IN (?)`,
      [courseIds]
    );
    const studentsCount = students[0].students_count;

    // 3️⃣ Total batches
    const [batches] = await db.query(
      `SELECT id 
       FROM course_batches 
       WHERE course_id IN (?)`,
      [courseIds]
    );
    const batchesCount = batches.length;

    const batchIds = batches.map(b => b.id);

    let meetingsCompletedCount = 0;

    if (batchIds.length > 0) {
          const [sessions] = await db.query(
            `
            SELECT COUNT(*) AS completed_meetings
            FROM batch_sessions bs
            JOIN course_batches batch ON bs.batch_id = batch.id
            WHERE batch.id IN (?)
              AND (
                DATE_ADD(batch.start_date, INTERVAL (bs.session_number - 1) DAY) < CURDATE()
                OR (
                  DATE_ADD(batch.start_date, INTERVAL (bs.session_number - 1) DAY) = CURDATE()
                  AND bs.start_time < CURTIME()
                )
              )
            `,
            [batchIds]
          );

      meetingsCompletedCount = sessions[0].completed_meetings;
    }

    // 4️⃣ Get next upcoming batch
    const [upcoming] = await db.query(
      `
      SELECT
        id AS batch_id,
        batch_name,
        DATE_FORMAT(start_date, '%Y-%m-%d') AS batch_start_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') AS batch_end_date,
        TIME_FORMAT(start_time, '%h:%i %p') AS batch_start_time,
        TIME_FORMAT(end_time, '%h:%i %p') AS batch_end_time,
        meeting_link,
        (
          SELECT COUNT(*)
          FROM course_enrollments ce
          WHERE ce.batch_id = course_batches.id
        ) AS batch_students_count
      FROM course_batches
      WHERE course_id IN (?) 
        AND (
          start_date >= CURDATE() OR 
          (end_date >= CURDATE() AND end_time >= CURTIME())
        )
      ORDER BY start_date ASC, start_time ASC
      LIMIT 2
      `,
      [courseIds]
    );

    return {
      courses_count: coursesCount,
      students_count: studentsCount,
      batches_count: batchesCount,
      meetings_completed_count: meetingsCompletedCount,
      upcoming_batch: upcoming.length > 0 ? upcoming : []
    };

  } catch (err) {
    console.error("DB Error in getInstructorSummary:", err.message);
    throw err;
  }
};




/// forgot password - verify otp - reset password
// ✅ Get instructor by email
export async function getInstructorByEmail(email) {
  const [rows] = await db.execute(
    "SELECT id, name FROM instructors WHERE email = ?",
    [email]
  );
  return rows[0] || null;
}

// ✅ Update OTP and timestamp
export async function updateInstructorOtp(instructorId, otp, timestamp) {
  await db.execute(
    "UPDATE instructors SET otp = ?, otp_created_at = ? WHERE id = ?",
    [otp, timestamp, instructorId]
  );
}

// ✅ Get OTP details
export async function getInstructorOtpDetails(email) {
  const [rows] = await db.execute(
    "SELECT id, otp, otp_created_at FROM instructors WHERE email = ?",
    [email]
  );
  return rows[0] || null;
}

// ✅ Clear OTP
export async function clearInstructorOtp(instructorId) {
  await db.execute(
    "UPDATE instructors SET otp = NULL, otp_created_at = NULL WHERE id = ?",
    [instructorId]
  );
}

// ✅ Store reset token and timestamp
export async function storeInstructorResetToken(instructorId, token, timestamp) {
  await db.execute(
    "UPDATE instructors SET reset_token = ?, reset_token_created_at = ? WHERE id = ?",
    [token, timestamp, instructorId]
  );
}

// ✅ Get reset token details
export async function getInstructorResetTokenDetails(email) {
  const [rows] = await db.execute(
    "SELECT id, reset_token, reset_token_created_at FROM instructors WHERE email = ?",
    [email]
  );
  return rows[0] || null;
}

// ✅ Update password
export async function updateInstructorPasswordWithForgot(id, hashedPassword) {
  await db.execute(
    "UPDATE instructors SET password = ?, reset_token = NULL, reset_token_created_at = NULL WHERE id = ?",
    [hashedPassword, id]
  );
}
