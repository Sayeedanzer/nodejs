import db from '../config/db.js';
import { getISTDateTime } from '../helpers/dateTimeFormat.js';
import { handleServerError } from '../helpers/handleWithErrors.js';
import * as CourseBatchModel from '../models/courseBatchModel.js';

export const createCourseBatch = async (req, res, next) => {
  try {
    const {
      course_id,
      instructor_id,
      start_time,
      end_time,
      start_date,
      end_date,
      batch_name,
      meeting_link = "",
      lessons_count,
    } = req.body;

    const batch_number = await CourseBatchModel.getNextBatchNumber(course_id);

    const batchId = await CourseBatchModel.addCourseBatch({
      course_id,
      instructor_id,
      start_time,
      end_time,
      start_date,
      course_type: "Online",
      batch_number,
      end_date,
      batch_name,
      meeting_link
    });

    // ✅ Generate sessions

    for (let i = 1; i <= lessons_count; i++) {
      await CourseBatchModel.addBatchSession({
        batch_id: batchId,
        instructor_id,
        session_number: i,
        start_time,
        end_time,
        meeting_link: meeting_link || null,
        video_link: null,
        status: "show"
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Batch created with sessions',
      batch_id: batchId,
      batch_number,
      sessions: lessons_count
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};


export const getCoursesForCreatingToBatches = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT c.id, c.name, c.category, c.sub_categories,
        COUNT(cc.id) AS lessons_count
      FROM courses c
      LEFT JOIN course_curriculums cc ON cc.course_id = c.id
      GROUP BY c.id, c.name, c.category, c.sub_categories
    `);

    const data = rows.map(r => ({
      ...r,
      sub_categories: r.sub_categories ? JSON.parse(r.sub_categories) : [],
      lessons_count: Number(r.lessons_count)
    }));

    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};



export const getCourseBatch = async (req, res) => {
  const { batch_id } = req.params;

  try {
    const batch = await CourseBatchModel.getCourseBatchById(batch_id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found"
      });
    }

    return res.status(200).json({
      success: true,
      batch
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};

export const fetchCoursesWithBatchInfo = async (req, res) => {
  try {
    // 1️⃣ Get page & limit from query params
    const currentPage = Number(req.query.page) || 1;
    const rowsPerPage = Number(req.query.limit) || 10;

    const offset = (currentPage - 1) * rowsPerPage;

    // 2️⃣ Fetch data
    const { rows: courses, total } = await CourseBatchModel.getCoursesWithBatchesAndEnrollment(rowsPerPage, offset);

    const totalPages = Math.ceil(total / rowsPerPage);

    return res.status(200).json({
      success: true,
      courses: courses,
      settings: {
        success: 1,
        message: "Data found successfully.",
        status: 200,
        count: total,
        page: currentPage,
        rows_per_page: rowsPerPage,
        next_page: currentPage < totalPages,
        prev_page: currentPage > 1
      }
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};


export const fetchBatchesByCourseId = async (req, res) => {
  const { course_id } = req.params;

  const currentPage = Number(req.query.page) || 1;
  const rowsPerPage = Number(req.query.limit) || 10;
  const offset = (currentPage - 1) * rowsPerPage;

  try {
    const { rows: batches, total } = await CourseBatchModel.getBatchesForCourse(course_id, rowsPerPage, offset);

    const totalPages = Math.ceil(total / rowsPerPage);

    return res.status(200).json({
      success: true,
      course_id: Number(course_id),
      batches,
      settings: {
        success: 1,
        message: "Data found successfully.",
        status: 200,
        count: total,
        page: currentPage,
        rows_per_page: rowsPerPage,
        next_page: currentPage < totalPages,
        prev_page: currentPage > 1
      }
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};


// get batch details for edit
export const getBatchDetailsForEdit = async (req, res) => {
  const batchId = Number(req.params.batch_id);

  if (!batchId || isNaN(batchId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid batch ID"
    });
  }

  try {
    const [[batch]] = await db.query(
      `SELECT
         id AS batch_id,
         batch_name,
         DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
         TIME_FORMAT(start_time, '%H:%i:%s')      AS start_time,
         TIME_FORMAT(end_time, '%H:%i:%s')        AS end_time,
         meeting_link
       FROM course_batches
       WHERE id = ? LIMIT 1`,
      [batchId]
    );

    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }

    return res.status(200).json({
      success: true,
      batch
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};

// edit api f   or batch
export const updateBatchDetails = async (req, res) => {
  const batchId = Number(req.params.batch_id);
  const { batch_name, start_date, start_time, end_time, meeting_link } = req.body;

  if (!batchId || isNaN(batchId)) {
    return res.status(400).json({ success: false, message: "Invalid batch ID" });
  }
  if (!batch_name || !start_date || !start_time || !end_time) {
    return res.status(400).json({
      success: false,
      message: "batch_name, start_date, start_time, and end_time are required."
    });
  }

  try {
    const now = getISTDateTime();

    const [result] = await db.query(
      `UPDATE course_batches SET
         batch_name   = ?,
         start_date   = ?,
         start_time   = ?,
         end_time     = ?,
         meeting_link = ?,
         updated_at   = ?
       WHERE id = ?`,
      [batch_name, start_date, start_time, end_time, meeting_link || null, now, batchId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }

    return res.status(200).json({ success: true, message: "Batch updated successfully" });
  } catch (err) {
    return handleServerError(res, err);
  }
};

// delete batch before checking any students are there
export const deleteBatch = async (req, res) => {
  const batchId = Number(req.params.batch_id);
  if (isNaN(batchId)) {
    return res.status(400).json({ success: false, message: "Invalid batch ID" });
  }

  try {
    const [[{ count }]] = await db.query(
      `SELECT COUNT(*) AS count
       FROM course_enrollments ce
       JOIN course_payments cp
         ON ce.course_id = cp.course_id
        AND ce.user_id = cp.user_id
        AND ce.batch_id = cp.batch_id
       WHERE ce.batch_id = ?`,
      [batchId]
    );

    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete batch – students have already paid or enrolled in this batch."
      });
    }

    const [result] = await db.query(
      `DELETE FROM course_batches WHERE id = ?`,
      [batchId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }

    return res.status(200).json({ success: true, message: "Batch deleted successfully" });
  } catch (err) {
    return handleServerError(res, err);
  }
};


/// batches
export const getBatchSessionsWithCurriculum = async (req, res) => {
  try {
    const batchId = Number(req.params.batch_id);

    const batch = await CourseBatchModel.getBatchById(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    // ✅ Get query params for pagination
    const currentPage = Number(req.query.page) || 1;
    const rowsPerPage = Number(req.query.limit) || 10;
    const offset = (currentPage - 1) * rowsPerPage;

    // ✅ Get curriculum for course (not paginated — so you always get full plan)
    const curriculumList = await CourseBatchModel.getCurriculumByCourse(batch.course_id);
    const [rows] = await db.query(
      `SELECT meeting_link FROM course_batches WHERE id = ?`, 
      [batchId]
    );

    // console.log("line 1", rows[0]?.meeting_link);

    const sessions = await CourseBatchModel.getBatchSessionsByBatchId(batchId, rowsPerPage, offset);

    // ✅ Get total count
    const totalSessions = await CourseBatchModel.getCountOfBatchSessions(batchId);
    const totalPages = Math.ceil(totalSessions / rowsPerPage);

    // ✅ Map + merge
    const sessionMap = new Map(sessions.map(s => [s.session_number, s]));

    // curriculumList.forEach(lesson => {
    //   const session = sessionMap.get(lesson.sequence);
    //   console.log("Line 329",{
    //     sequence: lesson.sequence,
    //     foundSession: session
    //   });
    // });

//     console.log('Sessions:', sessions);
// console.log('Curriculum:', curriculumList);


    const merged = curriculumList.map(lesson => {
    const session = sessionMap.get(lesson.sequence) || {};
      return {
        course_id: batch.course_id,
        curriculum_id: lesson.curriculum_id,
        title: lesson.title,
        sequence: lesson.sequence,
        description: lesson.description,
        duration: lesson.duration,
        session_number: lesson.sequence,
        status: session.status ?? null,
        meeting_link: rows[0]?.meeting_link ?? null,
        video_link: session.video_link ?? null
      };
    });

    return res.status(200).json({
      success: true,
      batch_id: batchId,
      data: merged,
      settings: {
        success: 1,
        message: "Data found successfully.",
        status: 200,
        count: totalSessions,
        page: currentPage,
        rows_per_page: rowsPerPage,
        next_page: currentPage < totalPages,
        prev_page: currentPage > 1
      }
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};


export const updateSessionStatus = async (req, res) => {
  const batchId = Number(req.params.batch_id);
  const sessionNumber = Number(req.params.session_number);
  const status = req.params.status;

  try {
    if (!['hide', 'show'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed: 'hide' or 'show'."
      });
    }

    await db.query(
      `UPDATE batch_sessions SET status = ? WHERE batch_id = ? AND session_number = ?`,
      [status, batchId, sessionNumber]
    );

    return res.status(200).json({
      success: true,
      message: `Session status updated to '${status}'.`
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};


export const updateSessionVideoLink = async (req, res) => {
  const { video_link, meeting_link, batch_id, session_number } = req.body;

  const batchId = batch_id;
  const sessionNumber = session_number;

  try {
    // console.log("line 1", req.body);
    if (!video_link && !meeting_link) {
      return res.status(400).json({
        success: false,
        message: "At least video_link or meeting_link is required"
      });
    }

    if (video_link) {
      await db.query(
        `UPDATE batch_sessions
         SET video_link = ?
         WHERE batch_id = ? AND session_number = ?`,
        [video_link, batchId, sessionNumber]
      );
    }

    if (meeting_link) {
      await db.query(
        `UPDATE course_batches
         SET meeting_link = ?
         WHERE id = ?`,
        [meeting_link, batchId]
      );
    }

    return res.status(200).json({
      success: true,
      message: "Session video link and/or batch meeting link updated"
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};


