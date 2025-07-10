// models/courseBundleModel.js
import db from '../config/db.js';

export const getTopBundlesByStudents = async () => {
  const [rows] = await db.execute(`
    SELECT 
      cb.id AS id,
      cb.title,
      cb.description,
      cb.total_value AS totalValue,
      cb.bundle_price AS bundlePrice,
      cb.savings,
      cb.rating,
      cb.students,
      cb.duration,
      cb.image,
      GROUP_CONCAT(c.name ORDER BY c.id SEPARATOR ', ') AS courses
    FROM course_bundles cb
    JOIN bundle_courses bc ON cb.id = bc.bundle_id
    JOIN courses c ON bc.course_id = c.id
    GROUP BY cb.id
    ORDER BY cb.students DESC
    LIMIT 3
  `);

  // Convert courses string into array
  return rows.map(row => ({
    ...row,
    courses: row.courses ? row.courses.split(',').map(course => course.trim()) : []
  }));
};
