import db from '../config/db.js';

export async function getTopThreeCourses() {
  const [rows] = await db.query(`
    SELECT 
      courses.id,
      courses.name,
      courses.slug,
      courses.level,
      courses.duration_time AS duration,
      courses.amount,  -- Original price
      courses.price AS price_with_discount,  -- Discounted price
      courses.instructor_id,
      courses.image,
      COUNT(course_reviews.id) AS total_reviews,
      ROUND(AVG(course_reviews.rating), 1) AS average_rating,
       (
              SELECT COUNT(*) 
              FROM course_enrollments e 
              WHERE e.course_id = courses.id
            ) AS total_students,
      instructors.name AS instructor_name,
      instructors.company AS instructor_company
    FROM courses
    LEFT JOIN course_reviews ON courses.id = course_reviews.course_id
    LEFT JOIN instructors ON courses.instructor_id = instructors.id
    GROUP BY courses.id
    ORDER BY total_students DESC
    LIMIT 8
  `);

  return rows;
}





// export async function fetchFilteredCourses({
//   category = [],
//   instructor = [],
//   level = [],
//   sub_category = [],
//   page = 1,
//   perPage = 6
// }) {
//   const offset = (page - 1) * perPage;
//   let conditions = [];
//   let values = [];

//   if (category.length > 0) {
//     conditions.push(`category IN (${category.map(() => '?').join(', ')})`);
//     values.push(...category);
//   }

//   if (instructor.length > 0) {
//     conditions.push(`instructor_name IN (${instructor.map(() => '?').join(', ')})`);
//     values.push(...instructor);
//   }

//   if (level.length > 0) {
//     conditions.push(`level IN (${level.map(() => '?').join(', ')})`);
//     values.push(...level);
//   }

//   if (sub_category.length > 0) {
//     for (let sub of sub_category) {
//       conditions.push(`sub_categories LIKE ?`);
//       values.push(`%${sub}%`);
//     }
//   }
//   }

//   const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

//   const query = `
//     SELECT id, name, slug, overview, duration_time, level, 
//            certificate, amount, is_installments, instructor_id, instructor_name, students, price, category, image, video, 
//            is_upcoming, start_date, sub_categories, total_slots, enrolled, created_at
//     FROM courses
//     ${whereClause}
//     ORDER BY created_at DESC
//     LIMIT ? OFFSET ?
//   `;

//   values.push(perPage, offset);

//   const [rows] = await db.query(query, values);

//   const courses = rows.map(row => ({
//     ...row,
//     sub_categories: safeParseArray(row.sub_categories)
//   }));

//   return courses;
// }

// function safeParseArray(json) {
//   try {
//     const parsed = JSON.parse(json || '[]');
//     return Array.isArray(parsed) ? parsed : [];
//   } catch {
//     return [];
//   }
// }



export async function fetchFilteredCourses({
  category = [],
  instructor = [],
  level = [],
  sub_category = [],
  page = 1,
  perPage = 6
}) {
  const offset = (page - 1) * perPage;
  let conditions = [];
  let values = [];
  conditions.push(`is_upcoming = 0`);
  // ✅ If sub_category is passed, ignore category filter
  if (sub_category.length === 0 && category.length > 0) {
    conditions.push(`category IN (${category.map(() => '?').join(', ')})`);
    values.push(...category);
  }

  if (instructor.length > 0) {
    conditions.push(`instructor_name IN (${instructor.map(() => '?').join(', ')})`);
    values.push(...instructor);
  }

  if (level.length > 0) {
    conditions.push(`level IN (${level.map(() => '?').join(', ')})`);
    values.push(...level);
  }

  if (sub_category.length > 0) {
    const orConditions = sub_category.map(() => `JSON_CONTAINS(sub_categories, ?)`).join(' OR ');
    conditions.push(`(${orConditions})`);
    for (const sub of sub_category) {
      values.push(`"${sub}"`);
    }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT id, name, slug, overview, duration_time, level, 
           certificate, amount, is_installments, instructor_id, instructor_name,     
            (
              SELECT COUNT(*) 
              FROM course_enrollments e 
              WHERE e.course_id = courses.id
            ) AS students,
              price, category, image, video, 
           is_upcoming, start_date, sub_categories, total_slots, enrolled, created_at
    FROM courses
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${perPage} OFFSET ${offset}
  `;


  const [rows] = await db.query(query, values);

  const courses = rows.map(row => ({
    ...row,
    sub_categories: safeParseArray(row.sub_categories)
  }));

  return courses;
}



function safeParseArray(json) {
  try {
    const parsed = JSON.parse(json || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}




export async function countFilteredCourses({
  category = [],
  instructor = [],
  level = [],
  sub_category = []
}) {
  let conditions = [];
  let values = [];

  conditions.push(`is_upcoming = 0`);

  if (sub_category.length === 0 && category.length > 0) {
    conditions.push(`category IN (${category.map(() => '?').join(', ')})`);
    values.push(...category);
  }

  if (instructor.length > 0) {
    conditions.push(`instructor_name IN (${instructor.map(() => '?').join(', ')})`);
    values.push(...instructor);
  }

  if (level.length > 0) {
    conditions.push(`level IN (${level.map(() => '?').join(', ')})`);
    values.push(...level);
  }

  if (sub_category.length > 0) {
    const orConditions = sub_category.map(() => `JSON_CONTAINS(sub_categories, ?)`).join(' OR ');
    conditions.push(`(${orConditions})`);
    for (const sub of sub_category) {
      values.push(`"${sub}"`);
    }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT COUNT(*) as total
    FROM courses
    ${whereClause}
  `;

  const [rows] = await db.query(query, values);
  return rows[0].total;
}





//one course
// courseModel.js


export const fetchCourseById = async (courseId) => {
  const [rows] = await db.query(
    `SELECT 
        c.id,
        c.name,
        c.slug,
        c.overview,
        c.duration_time,
        c.level,
        c.certificate,
        c.amount,
        c.is_installments,
        c.instructor_id,
        c.created_at,
        c.updated_at,
        c.deleted_at,
        c.instructor_name,
        c.students,
        c.price,
        c.category,
        c.video,
        c.is_upcoming,
        c.start_date,
        c.total_slots,
        c.enrolled,
        c.instructorBadge,
        c.image AS course_image,
        i.image AS instructor_image,
        ROUND(AVG(r.rating), 1) AS ratings
     FROM courses c
     LEFT JOIN instructors i ON c.instructor_id = i.id
     LEFT JOIN course_reviews r ON c.id = r.course_id
     WHERE c.id = ?
     GROUP BY c.id`,
    [courseId]
  );

  return rows[0] || null;
};







/// instructor
export async function getInstructorByCourseId(instructor_id) {
  const [rows] = await db.query(
    `SELECT 
      id,
      name,
      email,
      phone,
      role,
      qualification,
      gender,
      bio,
      affiliation,
      image,
      company,
      specialties,
      created_at,
      updated_at
     FROM instructors
     WHERE id = ?
     LIMIT 1`,
    [instructor_id]
  );

  const instructor = rows[0];

  // Parse specialties if it exists
  if (instructor && instructor.specialties) {
    try {
      instructor.specialties = JSON.parse(instructor.specialties);
    } catch (e) {
      instructor.specialties = [];
    }
  }

  return instructor || null;
}



export const fetchCourseReviewsWithStats = async (courseId) => {
  // 1. Get all reviews + user names + user image
  const [reviews] = await db.query(`
    SELECT 
      co.review,
      co.rating,
      co.created_at,
      u.id AS user_id,
      u.name AS user_name,
      u.image AS user_image
    FROM course_reviews co
    JOIN users u ON co.user_id = u.id
    WHERE co.course_id = ?
    ORDER BY co.created_at DESC
  `, [courseId]);

  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let totalRating = 0;  

  reviews.forEach(r => {
    const rate = r.rating;
    ratingCounts[rate] = (ratingCounts[rate] || 0) + 1;
    totalRating += rate;
  });

  const avgRating = reviews.length ? (totalRating / reviews.length).toFixed(2) : "0.00";

  return {
    averageRating: avgRating,
    totalRatings: reviews.length,
    ratingBreakdown: ratingCounts,
    reviews
  };
};



export const getTopInstructors = async () => {
  const [rows] = await db.query(`
    SELECT 
      i.id,
      i.name,
      i.email,
      i.bio,
      i.image,
      i.company,
      i.specialties,
      COUNT(DISTINCT c.id) AS courses_count,
      IFNULL(COUNT(DISTINCT ce.id), 0) AS total_students,
      ROUND(AVG(r.rating), 1) AS average_rating
    FROM instructors i
    LEFT JOIN courses c ON i.id = c.instructor_id
    LEFT JOIN course_enrollments ce ON ce.course_id = c.id
    LEFT JOIN course_reviews r ON c.id = r.course_id
    WHERE i.role = 'instructor'
    GROUP BY i.id
    ORDER BY total_students DESC, average_rating DESC
    LIMIT 4
  `);

  return rows.map(instructor => ({
    ...instructor,
    specialties: (() => {
      try {
        return instructor.specialties ? JSON.parse(instructor.specialties) : [];
      } catch (e) {
        console.warn(`Invalid JSON for instructor ID ${instructor.id}`);
        return [];
      }
    })(),
    courses_count: instructor.courses_count || 0,
    total_students: instructor.total_students || 0,
    average_rating: instructor.average_rating || 0
  }));
};

