
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { addFullCourseData, clearAdminOtp, counInstructorsByRoleModel, countAllCoursesModel, countContactMessages, countCoursePayments, countUsersByRoleModel, createAdmin, deleteCarouselById, deleteCourseById, deleteUserOrInstructorById, findAdminByEmail, getAdminByEmail, getAdminOtpDetails, getAdminResetTokenDetails, getAllCoursesModel, getContactMessages, getCourseCurriculumProgressByAdmin, getCourseDataById, getCourseEMIsByAdmin, getCoursePayments, getDashboardStats, getInstructorsWithPaginationModel, getPendingInstructors, getStudentEnrollmentsByAdmin, getStudentInfoByAdmin, getUsersByRoleWithPaginationModel, insertCarousel, storeAdminResetToken, updateAdminDetailsById, updateAdminOtp, updateAdminPasswordWithForgot, updateCarouselById, updateCourseDetailsById } from '../models/adminModel.js';
// import { createUser } from '../models/userModel.js';
import { handleServerError } from '../helpers/handleWithErrors.js';
import db from '../config/db.js';
import { getBaseUrl } from '../config/getBaseUrl.js';
import moment from 'moment-timezone';
import { getISTDateTime } from '../helpers/dateTimeFormat.js';
import { sendOtpMail } from '../config/mailer.js';
import crypto from 'crypto';
import { deleteUploadedFile } from '../helpers/uploadingFolders.js';




export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const data = await createAdmin({
      name,
      email,
      password: hashedPassword,
    });

    // Generate JWT token using user id or email
    const token = jwt.sign(
      { id: data.insertId, email },
      process.env.JWT_SECRET_ADMIN,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      success: true,
      message: 'Registered successfully',
      userId: data.insertId,
      token, // send token here
      data
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};


export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await findAdminByEmail(email);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email },
        process.env.JWT_SECRET_ADMIN,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const adminData = {
      id: admin.id,
      name: admin.name || '',
      email: admin.email || '',
    };

    return res.status(200).json({
      success: true,
      token,
      admin: adminData
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};


export const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.admin.id; // Comes from token middleware

    const [rows] = await db.query(
      `SELECT name, email, phone, bio, image FROM admin WHERE id = ? LIMIT 1`,
      [adminId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    return res.status(200).json({
      success: true,
      admin: rows[0],
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};



export const updateAdmin = async (req, res) => {
  try {
    const adminId = req.admin.id;
    const adminData = req.body;
    const uploadedImage = req.file;
    // console.log("Uploaded file:", uploadedImage);

    if (uploadedImage) {
      const baseUrl = getBaseUrl(req);
      adminData.image = `${baseUrl}/uploads/admin/${uploadedImage.filename}`;
    } else if (adminData.image) {
      adminData.image = adminData.image;
    } else {
      adminData.image = ''; // Optional: fallback if both are missing
    }
    const result = await updateAdminDetailsById(adminId, adminData);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Admin not found." });
    }


    return res.status(200).json({
      success: true,
      message: "Admin details updated successfully.",
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};

export const changeAdminPassword = async (req, res) => {
  try {
    const adminId = req.admin.id;
    const { old_password, new_password, confirm_password } = req.body;

    if (!old_password || !new_password || !confirm_password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation do not match",
      });
    }

    const [rows] = await db.query(
      `SELECT password FROM admin WHERE id = ?`,
      [adminId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    const passwordMatch = await bcrypt.compare(old_password, rows[0].password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Old password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await db.query(
      `UPDATE admin SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [hashedPassword, adminId]
    );

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};

export const getAdminDashboardSummary = async (req, res) => {
  try {
    const now = moment().tz('Asia/Kolkata');

    // FULL last month: e.g. June 1 → June 30
    const startOfLastMonth = now.clone().subtract(1, 'month').startOf('month');
    const endOfLastMonth = now.clone().subtract(1, 'month').endOf('month');

    // FULL month before last: e.g. May 1 → May 31
    const startOfMonthBeforeLast = now.clone().subtract(2, 'month').startOf('month');
    const endOfMonthBeforeLast = now.clone().subtract(2, 'month').endOf('month');

    const stats = await getDashboardStats(
      startOfLastMonth.toDate(),
      endOfLastMonth.toDate(),
      startOfMonthBeforeLast.toDate(),
      endOfMonthBeforeLast.toDate()
    );

    return res.status(200).json({
      success: true,
      data: stats
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};

export const getUsersByRoleWithPagination = async (req, res) => {
  const { search = '' } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const role = "student"; // fixed role
    const users = await getUsersByRoleWithPaginationModel(role, limit, offset, search);
    const total = await countUsersByRoleModel(role, search);
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      users: users,
      settings: {
        success: 1,
        message: "Users fetched successfully.",
        status: 200,
        count: total,
        page: page,
        rows_per_page: limit,
        next_page: page < totalPages,
        prev_page: page > 1
      }
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};

// all instructors
export const getAllInstructors = async (req, res) => {
  const { search = '' } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const role = "instructor"; // fixed role
    const instructors = await getInstructorsWithPaginationModel(role, limit, offset, search);
    const total = await counInstructorsByRoleModel(role, search);
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      instructors: instructors,
      settings: {
        success: 1,
        message: "Users fetched successfully.",
        status: 200,
        count: total,
        page: page,
        rows_per_page: limit,
        next_page: page < totalPages,
        prev_page: page > 1
      }
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};

// single instructor in admin
export const getInstructorDetailsByAdmin = async (req, res) => {
  const instructor_id = req.params.id;

  try {
    const [instructorRows] = await db.execute(
      `SELECT id, name, email, image, bio,
              DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:30'), '%d-%m-%Y') AS joined_date
       FROM instructors 
       WHERE id = ?`,
      [instructor_id]
    );

    const instructor = instructorRows[0];
    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found"
      });
    }

    const [courses] = await db.execute(
      `SELECT id, name, status, 
      DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:30'), '%d-%m-%Y') AS created_at,
      DATE_FORMAT(CONVERT_TZ(updated_at, '+00:00', '+05:30'), '%d-%m-%Y') AS updated_at
       FROM courses 
       WHERE instructor_id = ?`,
      [instructor_id]
    );

    const courseIds = courses.map(course => course.id);

    let totalStudents = 0;
    if (courseIds.length > 0) {
      const [studentCountRows] = await db.execute(
        `SELECT COUNT(*) AS total_students 
         FROM course_enrollments 
         WHERE course_id IN (${courseIds.map(() => '?').join(',')})`,
        courseIds
      );
      totalStudents = studentCountRows[0]?.total_students || 0;
    }

    let avgRating = 0;
    if (courseIds.length > 0) {
      const [ratingRows] = await db.execute(
        `SELECT ROUND(AVG(rating), 1) AS avg_rating 
         FROM course_reviews 
         WHERE course_id IN (${courseIds.map(() => '?').join(',')})`,
        courseIds
      );
      avgRating = ratingRows[0]?.avg_rating || 0;
    }

    const courseDetails = await Promise.all(
      courses.map(async (course) => {
        const [enrollmentRows] = await db.execute(
          `SELECT COUNT(*) AS students 
           FROM course_enrollments 
           WHERE course_id = ?`,
          [course.id]
        );
        const [ratingRow] = await db.execute(
          `SELECT ROUND(AVG(rating), 1) AS ratings 
           FROM course_reviews 
           WHERE course_id = ?`,
          [course.id]
        );

        return {
          course_id: course.id,
          name: course.name,
          created_at: course.created_at,
          updated_at:course?.updated_at,
          students: enrollmentRows[0]?.students || 0,
          ratings: ratingRow[0]?.ratings || 0,
          status: course.status
        };
      })
    );

    const latestCourse = [...courses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    // 7. Prepare final response
    return res.status(200).json({
      success: true,
      message: "Instructor details fetched successfully",
      instructor: {
        name: instructor.name,
        image: instructor.image,
        email: instructor.email,
        bio: instructor.bio,
        joined_date: instructor.joined_date,
        avg_rating: avgRating,
        total_courses: courses.length,
        total_students: totalStudents,
        course_name: latestCourse?.name || null,
      },
      course_details: courseDetails
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};


export const deleteUserByRoleAndId = async (req, res) => {
  const { role, id } = req.params;

  if (!role || !id) {
    return res.status(400).json({
      success: false,
      message: 'Role and ID are required',
    });
  }

  try {
    const result = await deleteUserOrInstructorById(role, id);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: `No ${role} found with ID ${id}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `${role} deleted successfully`,
    });
  } catch (err) {
    return handleServerError(res, err)
  }
};

export const getRequestInstructors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const searchQuery = `%${req.query.search || ''}%`;

    const { total, instructors } = await getPendingInstructors(searchQuery, limit, offset);
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      instructors,
      settings: {
        success: 1,
        message: "Users fetched successfully.",
        status: 200,
        count: total,
        page,
        rows_per_page: limit,
        next_page: page < totalPages,
        prev_page: page > 1
      }
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};

export const updateInstructorStatus = async (req, res) => {
  try {
    const instructorId = req.params.id;
    const { status } = req.body;

    // Allowed ENUM values from DB
    const validStatuses = ["pending", "active", "inactive"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: 'pending', 'active', or 'inactive'.",
      });
    }

    // Check if instructor exists
    const [existing] = await db.query(
      `SELECT id FROM instructors WHERE id = ? LIMIT 1`,
      [instructorId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found.",
      });
    }

    // Update status
    await db.query(
      `UPDATE instructors 
       SET status = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [status, instructorId]
    );

    return res.status(200).json({
      success: true,
      message: `Instructor status changed to '${status}'.`,
      instructorId: parseInt(instructorId),
      status
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};



// courses

export const getAllCoursesController = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    category,
    instructor,
    level,
    sortBy = 'students',
    sortOrder = 'desc'
  } = req.query;

  const currentPage = parseInt(page) || 1
  const rowsPerPage = parseInt(limit) || 10
  const offset = (currentPage - 1) * rowsPerPage;

  try {
    const courses = await getAllCoursesModel({
      limit: rowsPerPage,
      offset,
      search,
      category,
      instructor,
      level,
      sortBy,
      sortOrder,
    });

    const totalCourses = await countAllCoursesModel({
      search,
      category,
      instructor,
      level
    });

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
  } catch (err) {
    return handleServerError(res, err);
  }
};

export const addFullCourse = async (req, res) => {
  try {
    const uploadedImage = req.file;

    const {
      name = '',
      slug = '',
      overview = '',
      duration_time = '',
      level = 'Beginner',
      amount = 0,
      instructor_id = 0,
      instructor_name = '',
      price = 0,
      category = 0,
      sub_categories = [],
      is_upcoming = 0,
      start_date = null,
      instructorBadge = '',
      is_installments = 0,
      overviewDetails = {},
      curriculums = []
    } = req.body;

    const course = {
      name,
      slug,
      overview,
      duration_time,
      level,
      amount: Number(amount) || 0,
      instructor_id: Number(instructor_id) || 0,
      instructor_name,
      price: Number(price) || 0,
      category: Number(category) || 0,
      sub_categories: Array.isArray(sub_categories) ? sub_categories : [],
      is_upcoming: Number(is_upcoming) || 0,
      start_date,
      instructorBadge,
      is_installments: Number(is_installments) || 0,
      image: ''
    };

    // console.log("✔️ Final course object:", course);

    if (uploadedImage) {
      const baseUrl = getBaseUrl(req);
      course.image = `${baseUrl}/uploads/courses/${uploadedImage.filename}`;
    } else {
      course.image = "https://www.rmquest.in/wp-content/uploads/2020/03/communication.jpg";
    }

    const insertedCourse = await addFullCourseData(
      course,
      overviewDetails,
      curriculums
    );

    return res.status(201).json({
      success: true,
      message: 'Course added successfully with curriculum and overview.',
      courseId: insertedCourse.id,
      data: insertedCourse
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};



export const getFullCourseById = async (req, res) => {
  try {
    const courseId = req.params.id;
    const data = await getCourseDataById(courseId);

    if (!data) {
      return res.status(404).json({ 
        success: false, 
        message: 'Course not found' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      data 
    });
  } catch (error) {
    return handleServerError(res, error); // ✅ consistent error handling
  }
};



export const updateCourseDetails = async (req, res) => {
  try {
    const courseId = req.params.id;
    const uploadedImage = req.file;

    // ✅ Destructure directly for flat body
    const {
      name = '',
      slug = '',
      overview = '',
      duration_time = '',
      level = 'Beginner',
      amount = 0,
      instructor_id = 0,
      instructor_name = '',
      price = 0,
      category = 0,
      sub_categories = [],
      is_upcoming = 0,
      start_date = null,
      instructorBadge = '',
      is_installments = 0,
      overviewDetails = {},
      curriculums = [],
      image = ''
    } = req.body;

    // console.log("body", req.body);

    // ✅ Build safe updated course object
    const updatedCourse = {
      name,
      slug,
      overview,
      duration_time,
      level,
      amount: Number(amount) || 0,
      instructor_id: Number(instructor_id) || 0,
      instructor_name,
      price: Number(price) || 0,
      category: Number(category) || 0,
      sub_categories: Array.isArray(sub_categories) ? sub_categories : [],
      is_upcoming: Number(is_upcoming) || 0,
      start_date: start_date || null,
      instructorBadge,
      is_installments: Number(is_installments) || 0,
      image: ''
    };

    // ✅ Attach uploaded image if present or fallback to incoming one
    if (uploadedImage) {
      const baseUrl = getBaseUrl(req);
      updatedCourse.image = `${baseUrl}/uploads/courses/${uploadedImage.filename}`;
    } else if (image) {
      updatedCourse.image = image;
    } else {
      updatedCourse.image = ''; // Keep empty — your DB SQL should skip update if empty
    }

    // ✅ Call update
    const result = await updateCourseDetailsById(
      courseId,
      updatedCourse,
      overviewDetails,
      curriculums
    );

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found or not updated'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Course updated successfully'
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};


export const deleteCourse = async (req, res) => {
  const courseId = req.params.id;

  try {
    const result = await deleteCourseById(courseId);

    if (result.blocked) {
      return res.status(400).json({
        success: false,
        message: 'Course cannot be deleted. Related records exist.',
        details: {
          payments: result.payments_count,
          enrollments: result.enrollments_count,
          batches: result.batches_count,
          emis: result.emis_count
        }
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};




// instructors names   // categories and sub category
export const getInstructorsNamesForDropDownList = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, name FROM instructors WHERE instructors.status = "active"`
    );

    return res.status(200).json({
      success: true,
      message: "Instructors names fetched successfully.",
      instructors: rows
    });
  } catch (err) {
    return handleServerError(res, err);
  }
}

export const getAllCategories = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, category FROM course_categories`
    );

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully.",
      categories: rows
    });
  } catch (error) {
    return handleServerError(res, error);
  }
};


// 2. Get sub-categories by category ID
export const getSubCategoriesByCategoryId = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute(
      `SELECT sub_categories FROM course_categories WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found."
      });
    }

    const subCategories = JSON.parse(rows[0].sub_categories || '[]');

    return res.status(200).json({
      success: true,
      message: "Sub-categories fetched successfully.",
      category_id: parseInt(id),
      sub_categories: subCategories
    });
  } catch (error) {
    return handleServerError(res, error);
  }
};



// home page carousels
// Add new carousel
export const addCarousel = async (req, res) => {
  try {
    const uploadedImage = req.file;
    const { title, subtitle, link_url, is_active } = req.body;

    if (!title || !link_url) {
      return res.status(400).json({ success: false, message: "Title and link URL are required." });
    }

    let image = '';
    if (uploadedImage) {
      const folder = 'carousels';
      const baseUrl = getBaseUrl(req);
      image= `${baseUrl}/uploads/${folder}/${uploadedImage.filename}`;
    } else {
      return res.status(400).json({ success: false, message: "Image is required." });
    }

    await insertCarousel({
      title,
      subtitle,
      image,
      link_url,
      is_active: is_active ? 1 : 0,
    });

    return res.status(201).json({ success: true, message: "Carousel added successfully" });
  } catch (err) {
    return handleServerError(res, err);
  }
};

// Update carousel
export const updateCarousel = async (req, res) => {
  const { id } = req.params;
  const uploadedImage = req.file;
  const {
    title,
    subtitle,
    link_url,
    is_active
  } = req.body;
  
  try {
    let image;
    // console.log("line 895",uploadedImage)
    if (uploadedImage) {
      const folder = 'carousel';
      const baseUrl = getBaseUrl(req);
      image = `${baseUrl}/uploads/${folder}/${uploadedImage.filename}`;

      const [[existing]] = await db.query(
        `SELECT image FROM homepage_carousels WHERE id = ? LIMIT 1`,
        [id]
      );

      const oldImage = existing?.image;
      if (oldImage) {
        try {
          deleteUploadedFile(oldImage, 'carousel');
        } catch (err) {
          console.warn('Failed to delete old image:', err.message);
        }
      }
    } else if (req.body.image) {
          image = req.body.image;
    } else {
      const [[existing]] = await db.query(`SELECT image FROM homepage_carousels WHERE id = ? LIMIT 1`, [id]);
      image = existing?.image || null;
    }


   const [result] = await updateCarouselById(id, {
      title,
      subtitle,
      image,
      link_url,
      is_active: Number(is_active), // ✅ Fixed here
    });
    // console.log(result);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Carousel not found." });
    }

    return res.status(200).json({ success: true, message: "Carousel updated successfully." });
  } catch (err) {
    return handleServerError(res, err);
  }
};

export const getSingleCarousel = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT * FROM homepage_carousels WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Carousel not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};

export const getAllCarousels = async (req, res) => {
  try {
    const currentPage = parseInt(req.query.page) || 1;
    const rowsPerPage = parseInt(req.query.limit) || 10;
    const offset = (currentPage - 1) * rowsPerPage;
    const isActiveFilter = req.query.is_active;

    let query = `SELECT * FROM homepage_carousels`;
    let countQuery = `SELECT COUNT(*) as total FROM homepage_carousels`;
    const params = [];

    if (isActiveFilter !== undefined) {
      query += ` WHERE is_active = ?`;
      countQuery += ` WHERE is_active = ?`;
      params.push(Number(isActiveFilter));
    }

    query += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
    params.push(rowsPerPage, offset);

    const [data] = await db.query(query, params);
    const [countResult] = await db.query(
      countQuery,
      isActiveFilter !== undefined ? [Number(isActiveFilter)] : []
    );

    const totalCourses = countResult[0].total;
    const totalPages = Math.ceil(totalCourses / rowsPerPage);

    return res.status(200).json({
      success: true,
      data,
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
  } catch (err) {
    return handleServerError(res, err);
  }
};


// Delete carousel
export const deleteCarousel = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await deleteCarouselById(id);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Carousel not found." });
    }

    return res.status(200).json({ success: true, message: "Carousel deleted successfully." });
  } catch (err) {
    return handleServerError(res, err);
  }
};



// payments
export const getCoursePaymentsController = async (req, res) => {
  const { search = '', status = '' } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const payments = await getCoursePayments(limit, offset, search, status);
    const total = await countCoursePayments(search, status);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: payments,
      settings: {
        success: 1,
        message: "Data found successfully.",
        status: 200,
        count: total,
        page: page,
        rows_per_page: limit,
        next_page: page < totalPages,
        prev_page: page > 1
      }
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};



// testing image uplaod
export const uploadingAnImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }
  const folder = req.uploadFolder || 'users'; // fallback to users
  const imageUrl = `${getBaseUrl(req)}/uploads/${folder}/${req.file.filename}`;

  return res.status(200).json({
    success: true,
    message: 'Image uploaded successfully',
    imageUrl
  });
};

////// contact details 
export const getContactMessagesController = async (req, res) => {
  const { search = '' } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const messages = await getContactMessages(limit, offset, search);
    const total = await countContactMessages(search);

    return res.status(200).json({
      success: true,
      data: messages,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};

export const getStudentDetailsByAdmin = async (req, res) => {
  const user_id = req.params.id;

  try {
    const student = await getStudentInfoByAdmin(user_id);

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const enrollments = await getStudentEnrollmentsByAdmin(user_id);
    let totalSpent = 0;
    const courseDetails = [];

    for (const enroll of enrollments) {
      const course_id = enroll.course_id;
      const batch_id = enroll.batch_id;

      const [curriculums] = await db.execute(
        `SELECT id FROM course_curriculums WHERE course_id = ?`,
        [course_id]
      );
      const totalLessons = curriculums.length;

      // ✅ Get batch start & end + session end time
      const [[batchInfo]] = await db.execute(
        `SELECT start_date, end_date, end_time FROM course_batches WHERE id = ?`,
        [batch_id]
      );

      const batchStartDate = batchInfo.start_date;
      const batchEndDate = batchInfo.end_date;
      const sessionEndTime = batchInfo.end_time;

      // ✅ Get current IST
      const nowIST = moment().tz('Asia/Kolkata');

      const start = moment.tz(batchStartDate, 'Asia/Kolkata').startOf('day');
      const end = moment.tz(batchEndDate, 'Asia/Kolkata').endOf('day');

      let completedLessons = 0;

      if (nowIST.isAfter(start)) {
        const totalDays = end.diff(start, 'days') + 1;
        let daysElapsed = nowIST.clone().startOf('day').diff(start, 'days');

        // If today’s session has ended, count today too
        const [h, m, s] = sessionEndTime.split(':').map(Number);
        const todaySessionEnd = nowIST.clone().set({ hour: h, minute: m, second: s });

        if (nowIST.isAfter(todaySessionEnd)) {
          daysElapsed += 1;
        }

        daysElapsed = Math.max(0, Math.min(daysElapsed, totalDays));
        completedLessons = Math.min(daysElapsed, totalLessons);
      }

      const progressPercent = totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0;

      // ✅ EMIs etc.
      const emis = await getCourseEMIsByAdmin(user_id, course_id);
      const nextEmi = emis.find(e => e.paid === 0);
      const unpaidCount = emis.filter(e => e.paid === 0).length;
      const paidSum = emis.reduce((sum, emi) => sum + (emi.paid ? parseFloat(emi.installment_amount) : 0), 0);
      totalSpent += paidSum;

      courseDetails.push({
        course_id,
        course_name: enroll.name,
        instructor: enroll.instructor_name,
        level: enroll.level,
        duration: enroll.duration_time,
        image: enroll.image,
        enrolled_at: enroll.enrolled_at,
        progress: {
          percent: progressPercent,
          completed: completedLessons,
          total: totalLessons
        },
        emi_details: {
          total_emis: emis.length,
          emis,
          next_due: nextEmi ? nextEmi.due_date : null,
          unpaid_emis: unpaidCount
        }
      });
    }


    return res.status(200).json({
      success: true,
      message: "Student and course details fetched successfully",
      student_details: student,
      course_details: {
        total_courses: enrollments.length,
        completed_courses: courseDetails.filter(c => c.progress.percent === 100).length,
        total_spent: parseFloat(totalSpent.toFixed(2)),
        courses: courseDetails
      }
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};


// forgot password
export const sendOtpToAdminEmail = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({
        error: "Email is required.",
        message: "Email is required."
      });
    }

    const admin = await getAdminByEmail(email);
    if (!admin) {
      return res.status(404).json({
        error: "Admin not found.",
        message: "Admin not found."
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();

    await updateAdminOtp(admin.id, otp, now);
    await sendOtpMail(email, otp);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully."
    });

  } catch (error) {
    return handleServerError(res, error);
  }
};

export const verifyAdminOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      error: "Email and OTP are required.",
      message: "Email and OTP are required."
    });
  }

  try {
    const admin = await getAdminOtpDetails(email);
    if (!admin) {
      return res.status(404).json({
        error: "Admin not found.",
        message: "Admin not found."
      });
    }

    if (admin.otp !== otp) {
      return res.status(400).json({
        error: "Invalid OTP.",
        message: "Invalid OTP."
      });
    }

    const now = new Date();
    const created = new Date(admin.otp_created_at);
    const diffMinutes = (now - created) / (1000 * 60);

    if (diffMinutes > 10) {
      return res.status(410).json({
        error: "OTP expired.",
        message: "OTP expired."
      });
    }

    await clearAdminOtp(admin.id);

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetCreatedAt = new Date();
    await storeAdminResetToken(admin.id, resetToken, resetCreatedAt);

    return res.status(200).json({
      success: true,
      message: "OTP verified.",
      reset_token: resetToken
    });

  } catch (error) {
    return handleServerError(res, error);
  }
};

export const resetAdminPassword = async (req, res) => {
  try {
    const { email, reset_token, new_password } = req.body;

    if (!email || !reset_token || !new_password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required."
      });
    }

    const admin = await getAdminResetTokenDetails(email);

    if (!admin || admin.reset_token !== reset_token) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token."
      });
    }

    const diffMinutes = (new Date() - new Date(admin.reset_token_created_at)) / (1000 * 60);
    if (diffMinutes > 15) {
      return res.status(410).json({
        success: false,
        message: "Reset token expired."
      });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await updateAdminPasswordWithForgot(admin.id, hashed);

    return res.status(200).json({
      success: true,
      message: "Password updated successfully."
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};