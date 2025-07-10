import db from '../config/db.js'
import { getISTDateTime } from '../helpers/dateTimeFormat.js';
import moment from "moment-timezone";



export async function createAdmin({ name, email, password }) {
  const nowIstTimeDate = getISTDateTime();
  const [result] = await db.query(
    `INSERT INTO admin (name, email, password, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, password, nowIstTimeDate, nowIstTimeDate]
  );

  return {
    insertId: result.insertId,
    name,
    email
  };
}

export async function findAdminByEmail(email) {
    const [rows] = await db.query(
        `SELECT * FROM admin WHERE email = ?`, [email]
    );
    return rows[0];
}

export const updateAdminDetailsById = async (adminId, adminData) => {
  const now = getISTDateTime();

  const [result] = await db.query(
    `UPDATE admin SET 
      name = ?, 
      email = ?, 
      phone = ?, 
      bio = ?, 
      image = ?, 
      updated_at = ?
     WHERE id = ?`,
    [
      adminData.name,
      adminData.email,
      adminData.phone || 0,
      adminData.bio,
      adminData.image || 'https://img.freepik.com/premium-vector/upload-1_272430-663.jpg?semt=ais_hybrid&w=740',
      now,
      adminId
    ]
  );

  return result;
};


function percentChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function formatTimeAgo(datetime) {
  return moment(datetime).fromNow(); // e.g., "2 hours ago"
}

export const getDashboardStats = async ( lastMonthStart, lastMonthEnd, prevMonthStart, prevMonthEnd) => {
  // ✅ Total courses created last month & month before last
  const [[{ total_courses }]] = await db.query(`SELECT COUNT(*) AS total_courses FROM courses`);
  const [[{ lastMonth_courses }]] = await db.query(`
    SELECT COUNT(*) AS lastMonth_courses
    FROM courses
    WHERE created_at BETWEEN ? AND ?
  `, [lastMonthStart, lastMonthEnd]);
  const [[{ prevMonth_courses }]] = await db.query(`
    SELECT COUNT(*) AS prevMonth_courses
    FROM courses
    WHERE created_at BETWEEN ? AND ?
  `, [prevMonthStart, prevMonthEnd]);

  // ✅ Total students
  const [[{ total_students }]] = await db.query(`SELECT COUNT(*) AS total_students FROM users`);
  const [[{ lastMonth_students }]] = await db.query(`
    SELECT COUNT(*) AS lastMonth_students
    FROM users
    WHERE created_at BETWEEN ? AND ?
  `, [lastMonthStart, lastMonthEnd]);
  const [[{ prevMonth_students }]] = await db.query(`
    SELECT COUNT(*) AS prevMonth_students
    FROM users
    WHERE created_at BETWEEN ? AND ?
  `, [prevMonthStart, prevMonthEnd]);

  // ✅ Active instructors
  const [[{ total_instructors }]] = await db.query(`
    SELECT COUNT(*) AS total_instructors FROM instructors WHERE status = 'active'
  `);
  const [[{ lastMonth_instructors }]] = await db.query(`
    SELECT COUNT(*) AS lastMonth_instructors
    FROM instructors
    WHERE status = 'active' AND created_at BETWEEN ? AND ?
  `, [lastMonthStart, lastMonthEnd]);
  const [[{ prevMonth_instructors }]] = await db.query(`
    SELECT COUNT(*) AS prevMonth_instructors
    FROM instructors
    WHERE status = 'active' AND created_at BETWEEN ? AND ?
  `, [prevMonthStart, prevMonthEnd]);

      // ✅ Revenue
    // Total revenue: ALL TIME
    const [[{ total_revenue }]] = await db.query(`
      SELECT
        COALESCE((
          SELECT SUM(amount) FROM course_payments WHERE status = 'paid'
        ), 0)
        +
        COALESCE((
          SELECT SUM(installment_amount) FROM course_emis WHERE paid = 1
        ), 0) AS total_revenue
    `);

    // Last month revenue
    const [[{ lastMonth_revenue }]] = await db.query(`
      SELECT
        COALESCE((
          SELECT SUM(amount)
          FROM course_payments
          WHERE status = 'paid' AND created_at BETWEEN ? AND ?
        ), 0)
        +
        COALESCE((
          SELECT SUM(installment_amount)
          FROM course_emis
          WHERE paid = 1 AND created_at BETWEEN ? AND ?
        ), 0) AS lastMonth_revenue
    `, [lastMonthStart, lastMonthEnd, lastMonthStart, lastMonthEnd]);

    // Prev month revenue
    const [[{ prevMonth_revenue }]] = await db.query(`
      SELECT
        COALESCE((
          SELECT SUM(amount)
          FROM course_payments
          WHERE status = 'paid' AND created_at BETWEEN ? AND ?
        ), 0)
        +
        COALESCE((
          SELECT SUM(installment_amount)
          FROM course_emis
          WHERE paid = 1 AND created_at BETWEEN ? AND ?
        ), 0) AS prevMonth_revenue
    `, [prevMonthStart, prevMonthEnd, prevMonthStart, prevMonthEnd]);


  // ✅ Recent activity same as before
  const [recentEnrollment] = await db.query(`
    SELECT u.name AS student_name, c.name AS course_name, cp.created_at
    FROM course_payments cp
    JOIN users u ON cp.user_id = u.id
    JOIN courses c ON cp.course_id = c.id
    WHERE cp.status = 'paid'
    ORDER BY cp.created_at DESC
    LIMIT 1
  `);

  const [recentCourse] = await db.query(`
    SELECT name AS course_name, created_at
    FROM courses
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const [recentReview] = await db.query(`
    SELECT u.name AS student_name, c.name AS course_name, cr.rating, cr.created_at
    FROM course_reviews cr
    JOIN users u ON cr.user_id = u.id
    JOIN courses c ON cr.course_id = c.id
    ORDER BY cr.created_at DESC
    LIMIT 1
  `);

  const [recentInstructor] = await db.query(`
    SELECT name AS instructor_name, created_at
    FROM instructors
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const recent_activity = [];

  if (recentEnrollment.length) {
    recent_activity.push({
      message: `${recentEnrollment[0].student_name} enrolled in ${recentEnrollment[0].course_name}`,
      time_ago: formatTimeAgo(recentEnrollment[0].created_at)
    });
  }

  if (recentCourse.length) {
    recent_activity.push({
      message: `New course ${recentCourse[0].course_name} was created`,
      time_ago: formatTimeAgo(recentCourse[0].created_at)
    });
  }

  if (recentReview.length) {
    recent_activity.push({
      message: `${recentReview[0].student_name} left a ${recentReview[0].rating}-star review`,
      time_ago: formatTimeAgo(recentReview[0].created_at)
    });
  }

  if (recentInstructor.length) {
    recent_activity.push({
      message: `${recentInstructor[0].instructor_name} joined as an instructor`,
      time_ago: formatTimeAgo(recentInstructor[0].created_at)
    });
  }

  return {
    courses: {
      total: total_courses,
      growth_from_last_month: `${percentChange(lastMonth_courses, prevMonth_courses)}%`
    },
    students: {
      total: total_students,
      growth_from_last_month: `${percentChange(lastMonth_students, prevMonth_students)}%`
    },
    instructors: {
      total: total_instructors,
      growth_from_last_month: `${percentChange(lastMonth_instructors, prevMonth_instructors)}%`
    },
    revenue: {
      total: parseFloat(total_revenue),
      growth_from_last_month: `${percentChange(lastMonth_revenue, prevMonth_revenue)}%`
    },
    recent_activity
  };
};


export const getUsersByRoleWithPaginationModel = async (role = "student", limit, offset, search) => {
  const searchQuery = `%${search}%`;

  // Safe because limit and offset are integers
  const query = `
    SELECT 
      u.id, u.name, u.email, u.image, u.status,
      DATE_FORMAT(CONVERT_TZ(u.created_at, '+00:00', '+00:00'), '%d-%m-%Y %r') AS created_at,
      (
        SELECT COUNT(*) 
        FROM course_enrollments ce 
        WHERE ce.user_id = u.id
      ) AS enrolled_course_count
    FROM users u
    WHERE u.role = ? 
      AND (u.name LIKE ? OR u.email LIKE ?) 
    ORDER BY enrolled_course_count DESC, u.created_at DESC
    LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
  `;

  const [users] = await db.execute(query, [role, searchQuery, searchQuery]);
  return users;
};



export const countUsersByRoleModel = async (role = "student", search) => {
  const searchQuery = `%${search}%`;

  const [result] = await db.execute(
    `SELECT COUNT(*) as total 
     FROM users 
     WHERE role = ? 
     AND (name LIKE ? OR email LIKE ?)`,
    [role, searchQuery, searchQuery]
  );

  return result[0].total;
};

// one student details
export const getStudentInfoByAdmin = async (user_id) => {
  const [users] = await db.execute(
    `SELECT id, name, email, phone, role, status, qualification, gender, bio, experience,
            affiliation, image, company, DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:30'), '%d-%m-%Y %r') AS created_at
     FROM users
     WHERE id = ? AND role = 'student'`,
    [user_id]
  );
  return users[0] || null;
};

export const getStudentEnrollmentsByAdmin = async (user_id) => {
  const [enrollments] = await db.execute(
    `SELECT e.course_id, DATE_FORMAT(CONVERT_TZ(e.enrolled_at, '+00:00', '+00:00'), '%d-%m-%Y %r') AS enrolled_at,
          c.name, c.instructor_name, c.price, 
            c.duration_time, c.level, c.image, c.max_installments, batch_id
     FROM course_enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.user_id = ?
     ORDER BY enrolled_at ASC`,
    [user_id]
  );
  return enrollments;
};

export const getCourseCurriculumProgressByAdmin = async (user_id, course_id) => {
  const [result] = await db.execute(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM user_course_progress
     WHERE user_id = ? AND course_id = ?`,
    [user_id, course_id]
  );
  return result[0];
};


export const getCourseEMIsByAdmin = async (user_id, course_id) => {
  const [emis] = await db.execute(
    `SELECT video_index, installment_amount, 
            DATE_FORMAT(CONVERT_TZ(due_date, '+00:00', '+00:00'), '%d-%m-%Y %r') AS due_date,
            paid, 
            DATE_FORMAT(CONVERT_TZ(paid_at, '+00:00', '+05:30'), '%d-%m-%Y %r') AS paid_at 
     FROM course_emis
     WHERE user_id = ? AND course_id = ?
     ORDER BY video_index ASC`,
    [user_id, course_id]
  );
  return emis;
};


export const getInstructorsWithPaginationModel = async (role = "instructor", limit, offset, search) => {
  const searchQuery = `%${search}%`;

  const [rows] = await db.execute(
    `
    SELECT 
      instructors.id,
      instructors.name,
      instructors.image,
      DATE_FORMAT(CONVERT_TZ(instructors.created_at, '+00:00', '+05:30'), '%d-%m-%Y') AS joined_date,
      (
        SELECT courses.name 
        FROM courses 
        WHERE courses.instructor_id = instructors.id 
        ORDER BY courses.created_at DESC 
        LIMIT 1
      ) AS course_name,
      (
        SELECT COUNT(*) 
        FROM courses 
        WHERE courses.instructor_id = instructors.id
      ) AS course_count,
      (
        SELECT COUNT(*) 
        FROM course_enrollments 
        JOIN courses ON courses.id = course_enrollments.course_id 
        WHERE courses.instructor_id = instructors.id
      ) AS student_count,
      (
        SELECT ROUND(AVG(course_reviews.rating), 1) 
        FROM course_reviews 
        JOIN courses ON courses.id = course_reviews.course_id 
        WHERE courses.instructor_id = instructors.id
      ) AS avg_rating
    FROM instructors
    WHERE instructors.role = ? AND instructors.status = "active"
      AND (instructors.name LIKE ? OR instructors.email LIKE ?)
    ORDER BY course_count DESC
    LIMIT ${limit} OFFSET ${offset}
    `,
    [role, searchQuery, searchQuery]
  );

  return rows;
};




export const counInstructorsByRoleModel = async (role = "instructor", search) => {
  const searchQuery = `%${search}%`;

  const [result] = await db.execute(
    `SELECT COUNT(*) as total 
     FROM instructors 
     WHERE instructors.role = ? AND instructors.status = "active"
     AND (name LIKE ? OR email LIKE ?)`,
    [role, searchQuery, searchQuery]
  );

  return result[0].total;
};



export const deleteUserOrInstructorById = async (role, id) => {
  let tableName;

  if (role === 'student') {
    tableName = 'users';
  } else if (role === 'instructor') {
    tableName = 'instructors';
  } else {
    throw new Error('Invalid role');
  }

  const [result] = await db.execute(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
  return result;
};

export const getPendingInstructors = async (searchQuery, limit, offset) => {
  // 1. Total pending instructors
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total 
     FROM instructors 
     WHERE status = 'pending'
     AND (name LIKE ? OR email LIKE ?)`,
    [searchQuery, searchQuery]
  );

  // 2. Fetch paginated instructors
  const [rows] = await db.query(
    `SELECT id, name, email, image, phone, status, experience, specialties, institute_name,
            created_at AS joined_date
     FROM instructors
     WHERE role = 'instructor' AND status = 'pending'
     AND (name LIKE ? OR email LIKE ?)
     ORDER BY created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    [searchQuery, searchQuery]
  );

  // 3. Format results
  const instructors = rows.map((instructor) => ({
    ...instructor,
    specialties: parseSpecialties(instructor.specialties),
    joined_date: formatISTDateAMPM(instructor.joined_date),
  }));

  return { total, instructors };
};

// ✅ Reuse-friendly formatter
const formatISTDateAMPM = (date) => {
  return moment(date).tz('Asia/Kolkata').format('DD MMM YYYY, hh:mm A');
};

// ✅ Safe JSON parse
const parseSpecialties = (value) => {
  try {
    return value ? JSON.parse(value) : [];
  } catch (e) {
    return [];
  }
};

// course
export const getAllCoursesModel = async (options) => {
  const {
    limit,
    offset,
    search,
    category,
    instructor,
    level,
    sortBy,
    sortOrder
  } = options;

  const filters = [];
  const values = [];

  if (search) {
    filters.push(`(courses.name LIKE ? OR courses.instructor_name LIKE ?)`);
    values.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    filters.push(`courses.category = ?`);
    values.push(category);
  }

  if (instructor) {
    filters.push(`courses.instructor_name = ?`);
    values.push(instructor);
  }

  if (level) {
    filters.push(`courses.level = ?`);
    values.push(level);
  }

  let query = `
    SELECT 
      courses.id, 
      courses.name, 
      courses.slug, 
      courses.overview, 
      courses.duration_time,
      courses.level, 
      courses.certificate, 
      courses.amount, 
      courses.instructor_name, 
      courses.category,
      courses.sub_categories,  
      COUNT(course_enrollments.id) AS students,
      DATE_FORMAT(CONVERT_TZ(courses.created_at, '+00:00', '+00:00'), '%d-%m-%Y %r') AS created_at,
      courses.status
    FROM courses
    LEFT JOIN course_enrollments ON courses.id = course_enrollments.course_id
    WHERE courses.deleted_at IS NULL
  `;

  if (filters.length > 0) {
    query += ` AND ` + filters.join(' AND ');
  }

  query += ` GROUP BY courses.id `;

  const validSortFields = ['created_at', 'students'];
  const sortColumn = validSortFields.includes(sortBy) ? sortBy : 'students';
  const orderDirection = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  query += ` ORDER BY ${sortColumn} ${orderDirection} LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

  const [rows] = await db.execute(query, values);
    for (const row of rows) {
    try {
      row.sub_categories = row.sub_categories ? JSON.parse(row.sub_categories) : [];
    } catch (err) {
      row.sub_categories = [];
    }
  }

  return rows;
};


export const countAllCoursesModel = async (options) => {
  const { search, category, level, instructor } = options;

  const filters = [];
  const values = [];

  if (search) {
    filters.push(`(courses.name LIKE ? OR courses.instructor_name LIKE ?)`);
    values.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    filters.push(`courses.category = ?`);
    values.push(category);
  }

  if (instructor) {
    filters.push(`courses.instructor_name = ?`);
    values.push(instructor);
  }

  if (level) {
    filters.push(`courses.level = ?`);
    values.push(level);
  }

  let query = `SELECT COUNT(*) as total FROM courses WHERE deleted_at IS NULL`;

  if (filters.length > 0) {
    query += ` AND ` + filters.join(' AND ');
  }

  const [result] = await db.execute(query, values);
  return result[0].total;
};





export async function addFullCourseData(courseData, overviewDetails, curriculums) {
  const {
    name, slug, overview, duration_time,
    level, certificate = 1, amount = 0, is_installments = 1,
    instructor_id, instructor_name,
    price = 0, category, image,
    sub_categories = [], is_upcoming = 0,
    start_date = null, total_slots = 0,
    enrolled = 0, instructorBadge = '', max_installments = 0
  } = courseData;

  const fallbackImage = 'https://cdn.example.com/default-course-image.png';

  // 🔍 Check if the slug already exists
  const [existing] = await db.query(
    `SELECT id FROM courses WHERE slug = ? LIMIT 1`,
    [slug]
  );

  if (existing.length > 0) {
    const error = new Error('Course slug already exists.');
    error.status = 409;
    throw error;
  }
  // console.log(typeof(category), category)
  const [categoryRows] = await db.query(
  `SELECT category FROM course_categories WHERE id = ${category} LIMIT 1`
  );
  const categoryName = categoryRows[0].category;

  if (categoryRows.length === 0) {
    const error = new Error('Invalid category ID.');
    error.status = 400;
    throw error;
  }



  // ✅ Sub-category → thumbnail mapping
  const subCategoryThumbMap = {
    "Frontend": "https://cdn.site.com/thumbs/frontend.png",
    "Backend": "https://cdn.site.com/thumbs/backend.png",
    "Databases": "https://cdn.site.com/thumbs/databases.png",
    "React": "https://cdn.site.com/thumbs/react.png",
    "JSX": "https://cdn.site.com/thumbs/jsx.png"
  };

    const DEFAULT_THUMBNAIL = "https://cdn.site.com/thumbs/default.png";

    const sub_category_thumbnails = sub_categories.map(name => ({
      name,
      thumbnail: subCategoryThumbMap[name] || DEFAULT_THUMBNAIL
    }));

  // ✅ Insert into courses
  const nowIstTimeDate = getISTDateTime();
// ✅ Insert into courses
  const [courseResult] = await db.query(
    `INSERT INTO courses (
      name, slug, overview, duration_time,
      level, certificate, amount, is_installments,
      instructor_id, instructor_name,
      price, category, image, sub_categories, sub_category_thumbnails,
      is_upcoming, start_date, total_slots, enrolled,
      instructorBadge, max_installments, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name, slug, overview, duration_time,
      level, certificate, amount, is_installments,
      instructor_id, instructor_name,
      price, categoryName, image || fallbackImage,
      JSON.stringify(sub_categories),
      JSON.stringify(sub_category_thumbnails),
      is_upcoming, start_date, total_slots, enrolled,
      instructorBadge, max_installments,
      nowIstTimeDate,
    ]
  );


  const courseId = courseResult.insertId;
  
  // ✅ Insert overview
  await db.query(
    `INSERT INTO course_overview (
      course_id, long_overview, learning_outcomes, requirements, faqs, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      courseId,
      overviewDetails.long_overview,
      JSON.stringify(overviewDetails.learning_outcomes || []),
      JSON.stringify(overviewDetails.requirements || []),
      JSON.stringify(overviewDetails.faqs || []), nowIstTimeDate
    ]
  );
  
  // ✅ Insert curriculum
  for (const curriculum of curriculums) {
    await db.query(
      `INSERT INTO course_curriculums (
        course_id, title, sequence, description, duration, content_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        courseId,
        curriculum.title,
        curriculum.sequence || 1,
        curriculum.description || '',
        curriculum.duration || '00:00:00',
        curriculum.content_url || null, nowIstTimeDate
      ]
    );
  }

  return {
    id: courseId,
    name,
    instructor_name,
    category,
    price
  };
}


export const getCourseDataById = async (courseId) => {
  // 1. Get course info
  const [courseRows] = await db.query(
    `SELECT name, slug, overview, duration_time, level, amount, instructor_id, instructor_name, price, category, image, sub_categories, is_upcoming, start_date, instructorBadge, is_installments 
     FROM courses 
     WHERE id = ?`,
    [courseId]
  );


    const categoryName = courseRows[0]?.category;

    // Step 2: get category ID
    const [catRows] = await db.query(
      `SELECT id FROM course_categories WHERE category = ?`,
      [categoryName]
    );

    const categoryId = catRows[0]?.id;


  if (courseRows.length === 0) return null;

  const course = courseRows[0];

  // 2. Get overview
  const [overviewRows] = await db.query(
    `SELECT long_overview, learning_outcomes, requirements, faqs 
     FROM course_overview 
     WHERE course_id = ?`,
    [courseId]
  );

  // 3. Get curriculums
  const [curriculumRows] = await db.query(
    `SELECT title, sequence, description, duration, content_url 
     FROM course_curriculums 
     WHERE course_id = ? 
     ORDER BY sequence ASC`,
    [courseId]
  );

  return {
    course: {
      name: course.name,
      slug: course.slug,
      overview: course.overview,
      duration_time: course.duration_time,
      level: course.level,
      amount: course.amount,
      instructor_id: course.instructor_id,
      instructor_name: course.instructor_name,
      price: course.price,
      category: course.category,
      category_id: categoryId,
      image: course.image,
      sub_categories: JSON.parse(course.sub_categories || '[]'),
      is_upcoming: course.is_upcoming,
      start_date: course.start_date,
      instructorBadge: course.instructorBadge,
      is_installments: course.is_installments,
    },
    overviewDetails: overviewRows[0]
      ? {
          long_overview: overviewRows[0].long_overview,
          learning_outcomes: JSON.parse(overviewRows[0].learning_outcomes || '[]'),
          requirements: JSON.parse(overviewRows[0].requirements || '[]'),
          faqs: JSON.parse(overviewRows[0].faqs || '[]'),
        }
      : {},
    curriculums: curriculumRows,
  };
};



export const updateCourseDetailsById = async (courseId, course, overviewDetails, curriculums) => {
  const now = getISTDateTime();
  const categoryId = Number(course.category);

  const [categoryRows] = await db.query(
    `SELECT category FROM course_categories WHERE id = ${categoryId}`
  );

  if (categoryRows.length === 0) {
    // console.log(categoryId)
    // console.log(typeof (categoryId))
    throw new Error("Invalid category ID");
  }

  const categoryName = categoryRows[0].category;

  // ✅ Build dynamic fields & values
  const fields = [
    "name = ?",
    "slug = ?",
    "overview = ?",
    "duration_time = ?",
    "level = ?",
    "amount = ?",
    "instructor_id = ?",
    "instructor_name = ?",
    "price = ?",
    "category = ?",
    // Image is optional — handled below
    "sub_categories = ?",
    "is_upcoming = ?",
    "start_date = ?",
    "instructorBadge = ?",
    "is_installments = ?",
    "updated_at = ?"
  ];

  const values = [
    course.name,
    course.slug,
    course.overview,
    course.duration_time,
    course.level,
    course.amount,
    course.instructor_id,
    course.instructor_name,
    course.price,
    categoryName,
    JSON.stringify(course.sub_categories),
    Number(course.is_upcoming) || 0,
    course.start_date || null,
    course.instructorBadge,
    Number(course.is_installments) || 0,
    now
  ];

  // ✅ Only include image if provided
  if (course.image) {
    fields.splice(10, 0, "image = ?");
    values.splice(10, 0, course.image);
  }

  values.push(courseId);

  const [courseResult] = await db.query(
    `UPDATE courses SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  // ✅ Update overview
  await db.query(
    `UPDATE course_overview SET 
      long_overview = ?, 
      learning_outcomes = ?, 
      requirements = ?, 
      faqs = ?, 
      updated_at = ?
     WHERE course_id = ?`,
    [
      overviewDetails.long_overview,
      JSON.stringify(overviewDetails.learning_outcomes),
      JSON.stringify(overviewDetails.requirements),
      JSON.stringify(overviewDetails.faqs),
      now,
      courseId
    ]
  );

  // ✅ Replace curriculums
  await db.query(`DELETE FROM course_curriculums WHERE course_id = ?`, [courseId]);

  for (const curriculum of curriculums) {
    await db.query(
      `INSERT INTO course_curriculums (
        course_id, title, sequence, description, duration, content_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        courseId,
        curriculum.title,
        curriculum.sequence,
        curriculum.description,
        curriculum.duration,
        curriculum.content_url || '',
        now
      ]
    );
  }

  return courseResult;
};


export const deleteCourseById = async (courseId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1️⃣ Check dependencies
    const [[{ payments_count }]] = await conn.query(
      `SELECT COUNT(*) AS payments_count FROM course_payments WHERE course_id = ?`,
      [courseId]
    );

    const [[{ enrollments_count }]] = await conn.query(
      `SELECT COUNT(*) AS enrollments_count FROM course_enrollments WHERE course_id = ?`,
      [courseId]
    );

    const [[{ batches_count }]] = await conn.query(
      `SELECT COUNT(*) AS batches_count FROM course_batches WHERE course_id = ?`,
      [courseId]
    );

    const [[{ emis_count }]] = await conn.query(
      `SELECT COUNT(*) AS emis_count FROM course_emis WHERE course_id = ?`,
      [courseId]
    );

    if (payments_count > 0 || enrollments_count > 0 || batches_count > 0 || emis_count > 0) {
      await conn.rollback();
      conn.release();
      return { blocked: true, payments_count, enrollments_count, batches_count, emis_count };
    }

    // 2️⃣ Safe to delete
    await conn.query(`DELETE FROM course_curriculums WHERE course_id = ?`, [courseId]);
    await conn.query(`DELETE FROM course_overview WHERE course_id = ?`, [courseId]);

    const [result] = await conn.query(`DELETE FROM courses WHERE id = ?`, [courseId]);

    await conn.commit();
    conn.release();

    return result;

  } catch (err) {
    await conn.rollback();
    conn.release();
    throw new Error('Failed to delete course and related data');
  }
};


// home page carousels
export const insertCarousel = async ({ title, subtitle, image, link_url, is_active }) => {
  const nowIstTimeDate = getISTDateTime();
  return db.execute(
    `INSERT INTO homepage_carousels (title, subtitle, image, link_url, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, subtitle, image, link_url, is_active, nowIstTimeDate, nowIstTimeDate]
  );
};

export const updateCarouselById = async (id, data) => {
  const now = getISTDateTime();

  return await db.query(
    `UPDATE homepage_carousels SET 
      title = ?, 
      subtitle = ?, 
      image = ?, 
      link_url = ?, 
      is_active = ?, 
      updated_at = ?
     WHERE id = ?`,
    [
      data.title,
      data.subtitle,
      data.image,
      data.link_url,
      data.is_active,
      now,
      id
    ]
  );
};


export const deleteCarouselById = async (id) => {
  return db.execute(`DELETE FROM homepage_carousels WHERE id = ?`, [id]);
};


// payments
export const getCoursePayments = async (limit, offset, search, status) => {
  const searchQuery = `%${search}%`;

  const params = [
    searchQuery, searchQuery, searchQuery,  // full
    searchQuery, searchQuery, searchQuery   // emi
  ];

  let paymentsQuery = `
    SELECT 
      cp.id AS id,
      cp.razorpay_order_id,
      cp.razorpay_payment_id,
      cp.razorpay_signature,
      cp.amount,
      cp.currency,
      cp.status,
      cp.created_at,

      u.id AS user_id,
      u.name AS user_name,
      u.email AS user_email,

      c.id AS course_id,
      c.name AS course_name,

      NULL AS emi_id,
      NULL AS installment_amount,
      NULL AS due_date,
      NULL AS paid,
      NULL AS paid_at
    FROM course_enrollments ce
    JOIN course_payments cp ON cp.user_id = ce.user_id AND cp.course_id = ce.course_id
    JOIN users u ON cp.user_id = u.id
    JOIN courses c ON cp.course_id = c.id
    WHERE ce.payment_method = 'full'
      AND (u.name LIKE ? OR u.email LIKE ? OR c.name LIKE ?)
  `;

  if (status) {
    paymentsQuery += ` AND cp.status = ?`;
    params.splice(3, 0, status);
  }

  let emisQuery = `
    SELECT 
      emis.id AS id,
      NULL AS razorpay_order_id,
      emis.razorpay_payment_id,
      emis.razorpay_signature,
      emis.installment_amount AS amount,
      'INR' AS currency,
      CASE WHEN emis.paid = 1 THEN 'paid' ELSE 'unpaid' END AS status,
      emis.paid_at AS created_at,

      u.id AS user_id,
      u.name AS user_name,
      u.email AS user_email,

      c.id AS course_id,
      c.name AS course_name,

      emis.id AS emi_id,
      emis.installment_amount,
      emis.due_date,
      emis.paid,
      emis.paid_at
    FROM course_enrollments ce
    JOIN course_emis emis ON emis.user_id = ce.user_id AND emis.course_id = ce.course_id
    JOIN users u ON emis.user_id = u.id
    JOIN courses c ON emis.course_id = c.id
    WHERE emis.paid = 1 
      AND ce.payment_method IN ('2emis', '3emis')
      AND (u.name LIKE ? OR u.email LIKE ? OR c.name LIKE ?)
  `;

  const unionQuery = `
    ${paymentsQuery}
    UNION ALL
    ${emisQuery}
    ORDER BY created_at DESC
    LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
  `;

  const [rows] = await db.execute(unionQuery, params);
  return rows;
};




export const countCoursePayments = async (search, status) => {
  const searchQuery = `%${search}%`;
  const params = [searchQuery, searchQuery, searchQuery];

  let query = `
    SELECT COUNT(*) as total
    FROM course_payments
    JOIN users ON course_payments.user_id = users.id
    JOIN courses ON course_payments.course_id = courses.id
    WHERE 
      (users.name LIKE ? OR users.email LIKE ? OR courses.name LIKE ?)
  `;

  if (status) {
    query += ` AND course_payments.status = ?`;
    params.push(status);
  }

  const [result] = await db.execute(query, params);
  return result[0].total;
};


export const getContactMessages = async (limit, offset, search) => {
  const searchQuery = `%${search}%`;

  const [messages] = await db.execute(
    `SELECT id, first_name, last_name, email, phone, subject, message, created_at 
     FROM contact_messages 
     WHERE 
       first_name LIKE ? OR 
       last_name LIKE ? OR 
       email LIKE ? OR 
       subject LIKE ?
     ORDER BY created_at DESC 
     LIMIT ${limit} OFFSET ${offset}`,
    [searchQuery, searchQuery, searchQuery, searchQuery]
  );

  return messages;
};

export const countContactMessages = async (search) => {
  const searchQuery = `%${search}%`;

  const [result] = await db.execute(
    `SELECT COUNT(*) as total 
     FROM contact_messages 
     WHERE 
       first_name LIKE ? OR 
       last_name LIKE ? OR 
       email LIKE ? OR 
       subject LIKE ?`,
    [searchQuery, searchQuery, searchQuery, searchQuery]
  );

  return result[0].total;
};



// forgot password
export async function getAdminByEmail(email) {
  const [rows] = await db.execute(
    "SELECT id, name FROM admin WHERE email = ?",
    [email]
  );
  return rows[0] || null;
}

// ✅ Update OTP and timestamp
export async function updateAdminOtp(adminId, otp, timestamp) {
  await db.execute(
    "UPDATE admin SET otp = ?, otp_created_at = ? WHERE id = ?",
    [otp, timestamp, adminId]
  );
}

// ✅ Get OTP details
export async function getAdminOtpDetails(email) {
  const [rows] = await db.execute(
    "SELECT id, otp, otp_created_at FROM admin WHERE email = ?",
    [email]
  );
  return rows[0] || null;
}

// ✅ Clear OTP
export async function clearAdminOtp(adminId) {
  await db.execute(
    "UPDATE admin SET otp = NULL, otp_created_at = NULL WHERE id = ?",
    [adminId]
  );
}

// ✅ Store reset token
export async function storeAdminResetToken(adminId, token, timestamp) {
  await db.execute(
    "UPDATE admin SET reset_token = ?, reset_token_created_at = ? WHERE id = ?",
    [token, timestamp, adminId]
  );
}

// ✅ Get reset token details
export async function getAdminResetTokenDetails(email) {
  const [rows] = await db.execute(
    "SELECT id, reset_token, reset_token_created_at FROM admin WHERE email = ?",
    [email]
  );
  return rows[0] || null;
}

// ✅ Update password with forgot flow
export async function updateAdminPasswordWithForgot(adminId, hashedPassword) {
  await db.execute(
    "UPDATE admin SET password = ?, reset_token = NULL, reset_token_created_at = NULL WHERE id = ?",
    [hashedPassword, adminId]
  );
}
