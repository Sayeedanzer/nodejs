
import db from '../config/db.js';
import { getISTDateTime } from '../helpers/dateTimeFormat.js';
import { handleServerError } from '../helpers/handleWithErrors.js';
import { countFilteredCourses, fetchCourseById, fetchCourseReviewsWithStats, fetchFilteredCourses, getInstructorByCourseId, getTopInstructors, getTopThreeCourses } from '../models/courseModel.js';

export const topThreeCourses = async (req, res) => {
  try {
    const courses = await getTopThreeCourses();
    return res.status(200).json({
      success: true,
      courses
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};

// feedback
export const getAllStudentFeedback = async (req, res) => {
  try {
    const [feedback] = await db.execute(`
      SELECT 
        sf.id,
        sf.user_id,
        u.name AS user_name,
        u.image AS user_image,
        sf.video AS video,
        sf.heading,
        sf.paragraph
      FROM students_feedback sf
      JOIN users u ON sf.user_id = u.id
    `);

    return res.status(200).json({
      success: true,
      data: feedback
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};



// courses page filters
export const getFilteredCourses = async (req, res) => {
  try {
    const {
      category,
      instructor,
      level,
      sub_category,
      page = 1
    } = req.query;

    const currentPage = parseInt(page) || 1;

    const courses = await fetchFilteredCourses({
      category: Array.isArray(category) ? category : category ? [category] : [],
      instructor: Array.isArray(instructor) ? instructor : instructor ? [instructor] : [],
      level: Array.isArray(level) ? level : level ? [level] : [],
      sub_category: Array.isArray(sub_category) ? sub_category : sub_category ? [sub_category] : [],
      page: currentPage
    });

    const totalCourses = await countFilteredCourses({
      category: Array.isArray(category) ? category : category ? [category] : [],
      instructor: Array.isArray(instructor) ? instructor : instructor ? [instructor] : [],
      level: Array.isArray(level) ? level : level ? [level] : [],
      sub_category: Array.isArray(sub_category) ? sub_category : sub_category ? [sub_category] : []
    });

    const rowsPerPage = 6;
    const totalPages = Math.ceil(totalCourses / rowsPerPage);

    return res.status(200).json({
      success: true,
      courses: courses,
      settings: {
        success: 1,
        message: "Data found successfully.",
        status: 200,
        count: totalCourses,
        page: currentPage,
        rows_per_page: rowsPerPage,
        next_page: currentPage < totalPages,
        prev_page: currentPage > 1
      }
    });
  } catch (error) {
    return handleServerError(res, error);
  }
};


export const getCourseFilters = async (req, res) => {
  try {
    const [courses] = await db.query(
      `SELECT category, sub_categories, instructor_name, level FROM courses WHERE deleted_at IS NULL`
    );

    const categoriesMap = new Map();
    const instructors = new Set();
    const levels = new Set();

    for (const course of courses) {
      if (course.category) {
        if (!categoriesMap.has(course.category)) {
          categoriesMap.set(course.category, new Set());
        }

        try {
          const subs = JSON.parse(course.sub_categories || '[]');
          subs.forEach((sub) => categoriesMap.get(course.category).add(sub));
        } catch (e) {}
      }

      if (course.instructor_name) instructors.add(course.instructor_name);
      if (course.level) levels.add(course.level);
    }

    const categories = Array.from(categoriesMap.entries()).map(([category, subSet]) => ({
      category,
      sub_categories: Array.from(subSet)
    }));

    return res.status(200).json({
      success: true,
      filters: {
        categories,
        instructors: Array.from(instructors),
        levels: Array.from(levels)
      }
    });
  } catch (error) {
    return handleServerError(res, error);
  }
};


////////////////////////////////////////////////////////////////////////////////////////////////////////

// home page
export const getHomePageCarousels = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, title, subtitle, image AS image_url, link_url
      FROM homepage_carousels
      WHERE is_active = TRUE
      ORDER BY created_at ASC

    `);

    return res.status(200).json({
      success: true,
      carousels: rows
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};

export const getUpcomingCourses = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        id,
        name AS title,
        instructor_name AS instructor,
        start_date,
        duration_time AS duration,
        enrolled,
        total_slots AS maxStudents,
        price,
        image,
        category,
        ROUND((enrolled / total_slots) * 100) AS enrollment_progress  -- Enrollment Progress
      FROM courses
      WHERE is_upcoming = 1
        AND start_date > CURDATE()
      ORDER BY start_date ASC
      LIMIT 4
    `);

    return res.status(200).json({
      success: true,
      courses: rows
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};

// one course details in course page
export const getOneCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await fetchCourseById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: course,
    });
  } catch (err) {
        return handleServerError(res, err);
  }
};

//single -course - details
export const getSingleCoursePaymentsDetailsOnCoursePage = async (req, res) => {
  const course_id = Number(req.params.courseId);
  const user_id = req.user?.id || null;

  try {
    // 1. Course details
    const [[course]] = await db.execute(
      `SELECT name AS course_name, price, instructor_name, level, duration_time
       FROM courses WHERE id = ?`,
      [course_id]
    );
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    // 2. Lesson count
    const [[{ total_lessons }]] = await db.execute(
      `SELECT COUNT(*) AS total_lessons FROM course_curriculums WHERE course_id = ?`,
      [course_id]
    );

    // 3. Batches with enrollment flag
    const currentDate = getISTDateTime().split(" ")[0];
    const [batchesRaw] = await db.execute(
      `SELECT
        cb.id AS batch_id,
        cb.batch_name AS batch_name,
        DATE_FORMAT(cb.start_date, '%Y-%m-%d') AS start_date,
        TIME_FORMAT(cb.start_time, '%h:%i %p') AS start_time,
        TIME_FORMAT(cb.end_time,   '%h:%i %p') AS end_time,
        IF(ce.batch_id IS NOT NULL, 1, 0) AS enrolled
      FROM course_batches cb
      LEFT JOIN course_enrollments ce
        ON ce.course_id = cb.course_id
        AND ce.user_id = ?
        AND ce.batch_id = cb.id
      WHERE cb.course_id = ?
        AND cb.start_date >= ?
      ORDER BY cb.start_date ASC`,
      [user_id || 0, course_id, currentDate]
    );

    // Separate: NOT enrolled batches
    const batches = batchesRaw
      .filter(b => b.enrolled === 0)
      .map(b => ({
        batch_name : b.batch_name,
        batch_id: b.batch_id,
        start_date: b.start_date,
        start_time: b.start_time,
        end_time: b.end_time
      }));

    // Separate: enrolled batches
    const enrolled_batches = batchesRaw
      .filter(b => b.enrolled === 1)
      .map(b => ({
         batch_name : b.batch_name,
        batch_id: b.batch_id,
        start_date: b.start_date,
        start_time: b.start_time,
        end_time: b.end_time
      }));

    // Base response
    const response = {
      course_name: course.course_name,
      price: course.price,
      instructor_name: course.instructor_name,
      level: course.level,
      duration_time: course.duration_time,
      total_lessons,
      batches,            // NOT enrolled only
      enrolled_batches    // enrolled only
    };

    // User not logged in
    if (!user_id) {
      return res.status(200).json({
        ...response,
        payment_status: "please login"
      });
    }

    // No upcoming batches
    if (batchesRaw.length === 0) {
      return res.status(200).json({
        ...response,
        payment_status: "Batch not started"
      });
    }

    // If any NOT enrolled batches remain → not enrolled
    // If all batches enrolled → already paid
    const payment_status = batches.length > 0 ? "not enrolled" : "already paid";

    return res.status(200).json({
      ...response,
      payment_status
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};


export const getCourseOverview = async (req, res) => {
  const { courseId } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT * FROM course_overview WHERE course_id = ? LIMIT 1`,
      [courseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Course overview not found"
      });
    }

    const overview = rows[0];

    const parsedOverview = {
      ...overview,
      learning_outcomes: JSON.parse(overview.learning_outcomes || '[]'),
      requirements: JSON.parse(overview.requirements || '[]'),
      faqs: JSON.parse(overview.faqs || '[]')
    };

    return res.status(200).json({
      success: true,
      data: parsedOverview
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};




//instructor
export const getInstructorDetails = async (req, res) => {
  const instructorId = req.params.instructorId;

  try {
    const instructor = await getInstructorByCourseId(instructorId);

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found for this course',
      });
    }

    return res.status(200).json({
      success: true,
      instructor,
    });

  } catch (err) {
      return handleServerError(res, err);
  }
};



export const getCourseReviewsWithStats = async (req, res) => {
  try {
    const { courseId } = req.params;

    const data = await fetchCourseReviewsWithStats(courseId);

    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    return handleServerError(res, err)
  }
};


export const fetchTopInstructors = async (req, res) => {
  try {
    const instructors = await getTopInstructors();
    res.status(200).json({
      success: true,
      instructors
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};
