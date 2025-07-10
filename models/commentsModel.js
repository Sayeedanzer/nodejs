import db from '../config/db.js';
import { getISTDateTime } from '../helpers/dateTimeFormat.js';

export const addBlogCommentData = async ({ blog_id, user_id, comment }) => {
  const nowIstTimeDate = getISTDateTime();
  const query = `
    INSERT INTO comments (blog_id, user_id, comments, created_at)
    VALUES (?, ?, ?, ?)
  `;
  const values = [blog_id, user_id, comment, nowIstTimeDate];

  const [result] = await db.execute(query, values);
  return result;
};



export const getCommentsByBlogId = async (blogId) => {
  const [rows] = await db.query(`
    SELECT 
      c.id,
      c.comments AS comment,
      DATE_FORMAT(c.created_at, '%d %b %Y') AS date,
      u.name AS user_name,
      u.image AS user_image
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.blog_id = ?
    ORDER BY c.created_at DESC
  `, [blogId]);

  return rows;
};



//home page top course reviews
export const getTopCourseReviews = async () => {
  const [rows] = await db.execute(`
    SELECT 
      u.id AS user_id,
      u.name AS user_name,
      u.affiliation,
      u.image,
      ROUND(cr.rating, 1) AS rating,
      cr.review,
      c.name AS course_name
    FROM 
      course_reviews cr
    JOIN users u ON u.id = cr.user_id
    JOIN courses c ON c.id = cr.course_id
    JOIN course_enrollments ce ON ce.user_id = cr.user_id AND ce.course_id = cr.course_id
    WHERE cr.rating >= 4
    ORDER BY cr.rating DESC, cr.created_at DESC
    LIMIT 20
  `);
  return rows;
};
