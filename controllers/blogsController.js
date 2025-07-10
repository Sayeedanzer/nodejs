import db from "../config/db.js";
import { getBaseUrl } from "../config/getBaseUrl.js";
import { getISTDateTime } from "../helpers/dateTimeFormat.js";
import { handleServerError } from "../helpers/handleWithErrors.js";
import { updateAdminDetailsById } from "../models/adminModel.js";
import { addToNewBlogsData, countTotalBlogs, fetchBlogDetailsbyId, fetchPaginatedBlogs, getTopThreeBlogsData } from "../models/blogsModel.js";
import moment from "moment-timezone";
export const addToNewBlogs = async (req, res) => {

  try {
    const result = await addToNewBlogsData(req.body, req);
    return res.status(200).json({
      success: true,
      message: "Blog added successfully",
      blogId: result.insertId,
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};


export const updateBlogById = async (req, res) => {
  try {
    const blogId = req.params.id;
    const blogData = req.body;

    const uploadedImage = req.file;
    if (uploadedImage) {
      const folder = 'blogs';
      const baseUrl = getBaseUrl(req);
      blogData.image = `${baseUrl}/uploads/${folder}/${uploadedImage.filename}`;
    }

    // console.log(blogData.publish_date)
    // ✅ Use moment to parse and format publish_date
    if (blogData.publish_date) {
      const m = moment(blogData.publish_date, ["DD MMM YYYY", "YYYY-MM-DD", "DD/MM/YYYY"], true);
      if (m.isValid()) {
        blogData.publish_date = m.format("YYYY-MM-DD");
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid publish_date format. Use 'DD MMM YYYY' or 'YYYY-MM-DD'.",
        });
      }
    }

    // Build dynamic SET clause
    const fields = [];
    const values = [];

    const allowedFields = [
      "title",
      "image",
      "category",
      "instructor_id",
      "excerpt",
      "content",
      "key_benefits",
      "publish_date",
      "read_time",
      "comments_count"
    ];

    allowedFields.forEach((field) => {
      if (blogData[field] !== undefined) {
        if (field === "key_benefits") {
          fields.push(`${field} = ?`);
          values.push(JSON.stringify(blogData[field]));
        } else {
          fields.push(`${field} = ?`);
          values.push(blogData[field]);
        }
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided to update",
      });
    }

    values.push(blogId);

    const query = `
      UPDATE blogs
      SET ${fields.join(", ")}
      WHERE id = ?
    `;

    const [result] = await db.query(query, values);

    return res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      affectedRows: result.affectedRows,
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};





export const getTopThreeBlogs = async (req, res) => {
  try {
    const blogs = await getTopThreeBlogsData();

    const formatted = blogs.map(blog => ({
      id: blog.id,
      title: blog.title,
      excerpt: blog.excerpt,
      author: blog.author,
      content: blog.content,
      publishDate: new Date(blog.publish_date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      }),
      readTime: blog.read_time,
      category: blog.category,
      image: blog.image
    }));

    // return  throw new Error("okay");
    

    return res.status(200).json({ 
        success: true, 
        blogs: formatted 
    });
  } catch (err) {
   return handleServerError(res, err);
  }
};



export const getPaginatedBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const rowsPerPage = 10; // Define rows per page

    // Fetch paginated blogs with instructor name
    const blogs = await fetchPaginatedBlogs(page, rowsPerPage);

    // Get the total number of blogs
    const totalBlogs = await countTotalBlogs();

    const totalPages = Math.ceil(totalBlogs / rowsPerPage);

    return res.status(200).json({
      success: true,
      blogs,
      settings: {
        success: 1,
        message: "Data found successfully.",
        status: 200,
        count: totalBlogs,
        page: page,
        rows_per_page: rowsPerPage,
        next_page: page < totalPages,
        prev_page: page > 1
      }
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};


export const getBlogdetails = async (req, res) => {
  try {
      const blogId = req.params.id;
    const blogDetails = await fetchBlogDetailsbyId(blogId);
    if (!blogDetails) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }
    return res.status(200).json({
        success: true,
        data: blogDetails
    });
  } catch (err) {
    console.error(`error fetching blog`, err);
    handleServerError(res, err);
  }
}


export const deleteBlogById = async (req, res) => {
  try {
    const blogId = req.params.id;

    // Optional: Check if blog exists
    const [blogCheck] = await db.query(
      `SELECT id FROM blogs WHERE id = ? LIMIT 1`,
      [blogId]
    );

    if (blogCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

    const [result] = await db.query(
      `DELETE FROM blogs WHERE id = ?`,
      [blogId]
    );

    return res.status(200).json({
      success: true,
      message: "Blog deleted successfully"
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};