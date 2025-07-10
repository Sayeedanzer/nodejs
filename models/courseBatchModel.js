import db from '../config/db.js';
import { getISTDateTime } from '../helpers/dateTimeFormat.js';

export const getNextBatchNumber = async (courseId) => {
  const [rows] = await db.query(
    'SELECT MAX(batch_number) as max FROM course_batches WHERE course_id = ?',
    [courseId]
  );
  return (rows[0].max || 0) + 1;
};

export const addCourseBatch = async (batch) => {
  const now = getISTDateTime();
  const {
    course_id, instructor_id, start_time, end_time,
    start_date, course_type, batch_number,
    end_date, batch_name, meeting_link
  } = batch;

  const [result] = await db.query(
    `INSERT INTO course_batches (
      course_id, instructor_id,
      start_time, end_time, start_date,
      course_type, batch_number,
      meeting_link,
      end_date, batch_name,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      course_id, instructor_id,
      start_time, end_time, start_date,
      course_type, batch_number,
      meeting_link,
      end_date, batch_name,
      now, now
    ]
  );
  return result.insertId;
};


export const addBatchSession = async (session) => {
  const now = getISTDateTime();
  const {
    batch_id, instructor_id, session_number,
    start_time, end_time, meeting_link, video_link, status
  } = session;

  await db.query(
    `INSERT INTO batch_sessions (
      batch_id, instructor_id, session_number,
      start_time, end_time, status,
      meeting_link, video_link, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batch_id, instructor_id, session_number,
      start_time, end_time, status,
      meeting_link, video_link,
      now, now
    ]
  );
};

export const getCourseBatchById = async (batch_id) => {
  // 1. Get batch and course details
  const [batchRows] = await db.execute(
    `SELECT 
      cb.id AS batch_id,
      cb.course_id,
      c.name AS course_name,
      cb.start_time,
      cb.end_time,
      cb.start_date,
      cb.end_date,
      cb.course_type,
      cb.batch_name,
      cb.batch_number,
      cb.status,
      cb.created_at,
      cb.updated_at
    FROM course_batches cb
    JOIN courses c ON c.id = cb.course_id
    WHERE cb.id = ?`,
    [batch_id]
  );

  if (batchRows.length === 0) return null;

  const batch = batchRows[0];

  // 2. Get enrolled students with payment done (filtered and trimmed)
  const [studentRows] = await db.execute(
    `SELECT 
      u.id AS user_id,
      u.name AS user_name,
      u.email,
      ce.enrolled_at,
      ce.payment_method
    FROM course_enrollments ce
    JOIN users u ON u.id = ce.user_id
    WHERE ce.batch_id = ? AND ce.isItUserPaid = 1`,
    [batch_id]
  );

  return {
    ...batch,
    students: studentRows.length > 0 
        ? studentRows 
        : [{
            user_id: null,
            user_name: null,
            email: null,
            enrolled_at: null,
            payment_method: null
          }]
  };
};



// export const getCoursesWithBatchesAndEnrollment = async (limit, offset) => {
//   const [rows] = await db.query(`
//     SELECT 
//       c.id AS course_id,
//       c.name AS course_name,
//       COUNT(DISTINCT cb.id) AS total_batches,
//       COUNT(DISTINCT ce.user_id) AS total_students_enrolled
//     FROM courses c
//     INNER JOIN course_batches cb ON cb.course_id = c.id
//     LEFT JOIN course_enrollments ce ON ce.course_id = c.id
//     GROUP BY c.id
//     ORDER BY total_batches DESC
//     LIMIT ${Number(limit)} OFFSET ${Number(offset)}
//   `);

//   const [[{ total }]] = await db.query(`
//     SELECT COUNT(DISTINCT c.id) AS total
//     FROM courses c
//     INNER JOIN course_batches cb ON cb.course_id = c.id
//   `);

//   return { rows, total };
// };
export const getCoursesWithBatchesAndEnrollment = async (limit, offset) => {
  const [rows] = await db.query(`
    SELECT 
      c.id AS course_id,
      c.name AS course_name,
      COUNT(DISTINCT cb.id) AS total_batches,
      COUNT(DISTINCT ce.user_id) AS total_students_enrolled
    FROM courses c
    INNER JOIN course_batches cb ON cb.course_id = c.id
    LEFT JOIN course_enrollments ce ON ce.course_id = c.id
    GROUP BY c.id
    ORDER BY
      total_students_enrolled DESC,
      total_batches DESC
    LIMIT ? OFFSET ?
  `, [
    Number(limit),
    Number(offset)
  ]);

  const [[{ total }]] = await db.query(`
    SELECT COUNT(DISTINCT c.id) AS total
    FROM courses c
    INNER JOIN course_batches cb ON cb.course_id = c.id
  `);

  return { rows, total };
};




export const getBatchesForCourse = async (course_id, limit, offset) => {
  // 1️⃣ Get paginated batches
  const [rows] = await db.query(`
    SELECT 
      cb.id AS batch_id,
      cb.batch_name,
      cb.start_date,
      cb.end_date,
      cb.start_time,
      cb.end_time,
      cb.batch_number,
      cb.status,
      COUNT(ce.id) AS student_count
    FROM course_batches cb
    LEFT JOIN course_enrollments ce ON ce.batch_id = cb.id
    WHERE cb.course_id = ?
    GROUP BY cb.id
    ORDER BY cb.start_date ASC
    LIMIT ${Number(limit)} OFFSET ${Number(offset)}
  `, [course_id]);

  // 2️⃣ Get total count
  const [[{ total }]] = await db.query(`
    SELECT COUNT(*) AS total
    FROM course_batches
    WHERE course_id = ?
  `, [course_id]);

  return { rows, total };
};


// batches
// 1️⃣ Get batch info (including course_id and optional instructor/session times)
export const getBatchById = async (batchId) => {
  const [rows] = await db.query(
    `SELECT id, course_id
     FROM course_batches
     WHERE id = ? LIMIT 1`,
    [batchId]
  );
  return rows[0] || null;
};


// 2️⃣ Get curriculum list for a course
export const getCurriculumByCourse = async (courseId) => {
  const [rows] = await db.query(
    `SELECT id AS curriculum_id, title, sequence, description, duration
     FROM course_curriculums
     WHERE course_id = ?
     ORDER BY sequence ASC`,
    [courseId]
  );
  // console.log(rows)
  return rows;
};

// 3️⃣ Get batch session entries by batch
export const getBatchSessionsByBatchId = async (batchId, limit, offset) => {
  const [rows] = await db.query(
    `SELECT session_number, status, meeting_link, video_link
     FROM batch_sessions
     WHERE batch_id = ?
     ORDER BY session_number ASC
     `, // LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    [batchId]
  );
  // console.log("sessions", rows)
  return rows;
};

export const getCountOfBatchSessions = async (batchId) => {
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM batch_sessions WHERE batch_id = ?`,
    [batchId]
  );
  return total;
};

