import db from "../config/db.js";
import { getBaseUrl } from "../config/getBaseUrl.js";
import { getISTDateTime } from "../helpers/dateTimeFormat.js";
import { handleServerError } from "../helpers/handleWithErrors.js";


export async function addToNewBlogsData(data, req) {
  let {
    title,
    image,
    category,
    instructor_id,
    excerpt,
    content,
    key_benefits,
    publish_date,
    read_time,
    comments_count = 0
  } = data;

  const uploadedImage = req.file;
  if (uploadedImage) {
    const folder = 'blogs';
    const baseUrl = getBaseUrl(req);
    image = `${baseUrl}/uploads/${folder}/${uploadedImage.filename}`;
  }

  const query = `
    INSERT INTO blogs (
      title, image, category, instructor_id, excerpt, content,
      key_benefits, publish_date, read_time, comments_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    title,
    image,
    category,
    instructor_id,
    excerpt,
    content,
    key_benefits ? JSON.stringify(key_benefits) : null,
    publish_date || null,
    read_time || null,
    comments_count
  ];

  try {
    const [result] = await db.query(query, values);
    return result;
  } catch (err) {
    console.error("Error inserting blog:", err);
    throw err;
  }
}




export async function getTopThreeBlogsData() {
  const query = `
    SELECT 
      b.id,
      b.title,
      b.excerpt,
      b.content,  -- Include full content
      b.publish_date,
      b.read_time,
      b.category,
      b.image,
      i.name AS author
    FROM blogs b
    JOIN instructors i ON b.instructor_id = i.id
    ORDER BY b.publish_date DESC
    LIMIT 3
  `;

  const [rows] = await db.query(query);
  return rows;
}




export const fetchPaginatedBlogs = async (page = 1, limit = 6) => {
  const offset = (page - 1) * limit;

  // Join blogs with instructors table to get instructor name
  const [rows] = await db.query(
    `SELECT blogs.id, blogs.title, blogs.image, blogs.category, blogs.publish_date, 
            blogs.comments_count, instructors.name AS instructor_name
    FROM blogs 
    LEFT JOIN instructors ON blogs.instructor_id = instructors.id
    ORDER BY blogs.publish_date DESC 
    LIMIT ? OFFSET ?`,
    [limit, offset]
  );


  const formatted = rows.map((row) => ({
    id: row.id,
    title: row.title,
    image: row.image,
    category: row.category,
    author: row.instructor_name || 'Unknown', // Use instructor name or fallback
    date: row.publish_date
      ? new Date(row.publish_date).toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'Unknown',
    comments: `${row.comments_count} Comments`
  }));

  return formatted;
};

export const countTotalBlogs = async () => {
  const [result] = await db.execute('SELECT COUNT(*) as count FROM blogs');
  return result[0].count;
};

export const fetchBlogDetailsbyId = async (blogId) => {
  const [rows] = await db.execute(`
    SELECT 
      b.id,
      b.title,
      b.image,
      b.category,
      b.instructor_id,
      b.excerpt,
      b.content,
      b.key_benefits,
      DATE_FORMAT(b.publish_date, '%d %b %Y') AS publish_date, 
      b.read_time,
      (
        SELECT COUNT(*) 
        FROM comments 
        WHERE comments.blog_id = b.id
      ) AS comments_count,
      b.created_at,
      b.updated_at
    FROM blogs b
    WHERE b.id = ?
  `, [blogId]);

  if (rows.length === 0) return null;

  const blog = rows[0];

  try {
    blog.key_benefits = blog.key_benefits ? JSON.parse(blog.key_benefits) : [];
  } catch (err) {
    blog.key_benefits = [];
  }

  return blog;
};




/////////////////////////////////////////////////// Student Feedback 
// GET all feedbacks
export const getAllStudentsFeedback = async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT * FROM students_feedback ORDER BY created_at DESC`);
    return res.status(200).json({
      success: true,
      feedbacks: rows
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};

// GET single feedback by ID
export const getStudentFeedbackById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(`SELECT * FROM students_feedback WHERE id = ? LIMIT 1`, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Feedback not found" });
    }

    return res.status(200).json({
      success: true,
      feedback: rows[0]
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};

// CREATE feedback
export const getAllStudentsForCreatingFeedback = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, name, phone FROM users ORDER BY name ASC`
    );

    return res.status(200).json({
      success: true,
      students: rows
    });
  } catch (err) {
    console.error('Error fetching students:', err);
    return handleServerError(res, err);
  }
};



export const createStudentFeedback = async (req, res) => {
  try {
    const { user_id, heading, paragraph, video } = req.body;

    if (!user_id || !heading || !paragraph) {
      return res.status(400).json({ success: false, message: "Required fields missing" });
    }

    const now = getISTDateTime();

    const [result] = await db.execute(
      `INSERT INTO students_feedback (user_id, heading, paragraph, video, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, heading, paragraph, video, now, now]
    );

    return res.status(201).json({
      success: true,
      message: "Feedback created",
      feedbackId: result.insertId
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};

// UPDATE feedback
export const updateStudentFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { heading, paragraph, video } = req.body;

    const now = getISTDateTime();

    const [result] = await db.execute(
      `UPDATE students_feedback
       SET heading = ?, paragraph = ?, video = ?, updated_at = ?
       WHERE id = ?`,
      [heading, paragraph, video, now, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Feedback not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Feedback updated"
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};

// DELETE feedback
export const deleteStudentFeedback = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute(
      `DELETE FROM students_feedback WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Feedback not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Feedback deleted"
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};
