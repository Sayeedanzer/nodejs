import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as UserModel from '../models/userModel.js';
import { handleServerError } from '../helpers/handleWithErrors.js';
import db from '../config/db.js';
import { getISTDateTime } from '../helpers/dateTimeFormat.js';
import { getBaseUrl } from '../config/getBaseUrl.js';
import dayjs from 'dayjs';
import { getCurriculumByCourse } from '../models/courseBatchModel.js';
import * as InstructorModel from "../models/instructorModel.js";
import { deleteUploadedFile } from '../helpers/uploadingFolders.js';


export const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      confirm_password,
      phone,
      role,
      gender,
      affiliation, // for students
      specialties, // for instructors
      experience,  // for instructors
      institute_name // for instructors
    } = req.body;

    let table;
    if (role === "student") {
      table = "users";
    } else if (role === "instructor") {
      table = "instructors";
    } else {
      throw new Error("Invalid role specified");
    }

    const [existingEmail] = await db.query(
      `SELECT id FROM ${table} WHERE email = ? LIMIT 1`,
      [email]
    );

    if (existingEmail?.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered.",
      });
    }

    const [existingPhone] = await db.query(
      `SELECT id FROM ${table} WHERE phone = ? LIMIT 1`,
      [phone]
    );

    if (existingPhone?.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Phone number is already registered.",
      });
    }

    if (password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: "Password and confirm password do not match.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const image = gender === "Female" ? "https://cdn-icons-png.flaticon.com/512/8820/8820807.png": "https://cdn-icons-png.flaticon.com/256/8820/8820806.png";
    let data;
    if (role === "student") {
      data = await UserModel.createUser({
        name,
        email,
        password: hashedPassword,
        phone,
        role,
        gender,
        affiliation: affiliation || null,
        image
      });
    } else if (role === "instructor") {
      const status = "pending"; // new instructors are pending by default

      data = await InstructorModel.createInstro({
        name,
        email,
        password: hashedPassword,
        phone,
        gender,
        role,
        status,
        specialties: specialties ? JSON.stringify(specialties) : null,
        experience,
        institute_name,
        image
      });
    }

    return res.status(201).json({
      success: true,
      message: "Registered successfully",
      userId: data.insertId
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};


export const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const user = await UserModel.findUserByEmail(email, role);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
        process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const userData = {
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || '',
      qualification: user.qualification || null,
      created_at: user.created_at || null
    };

    return res.status(200).json({
      success: true,
      token,
      user: userData
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};


/// students details

export const getStudentDetailsOnProfile = async (req, res) => {
  const user_id = req.user.id;
  try {
    const studentDetails = await UserModel.getStudentFullDetails(user_id);

    if (!studentDetails) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student details fetched successfully",
      student: studentDetails
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};


export const editDetails = async (req, res) => {
  const userId = req.user?.id;
  const updateData = req.body;

  const uploadedImage = req.file;
  if (uploadedImage) {
    const folder = 'users';
    const baseUrl = getBaseUrl(req);
    updateData.image = `${baseUrl}/uploads/${folder}/${uploadedImage.filename}`;

    // 👉 Get the old image first, so we can delete it
    const [[existing]] = await db.query(
      `SELECT image FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    const oldImage = existing?.image;

    if (oldImage) {
      try {
        deleteUploadedFile(oldImage, folder); // your sync version
      } catch (err) {
        console.warn(`Failed to delete old user image: ${err.message}`);
      }
    }
  }

  try {
    const { result, updatedFields, error } = await UserModel.updateStudentDetailsById(userId, updateData);

    if (error === 'Email already exists') {
      return res.status(409).json({
        success: false,
        message: 'Email already exists',
        error
      });
    }

    if (error === 'Phone number already exists') {
      return res.status(409).json({
        success: false,
        message: 'Phone number already exists',
        error
      });
    }

    if (result?.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found or nothing to update'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Details updated successfully',
      updatedFields
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};




export const changePassword = async (req, res) => {
  const userId = req.user?.id; // from JWT
  const { role } = req.user || {};
  const { oldPassword, newPassword, confirmPassword } = req.body;

  try {
    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'New password and confirm password do not match' 
      });
    }

    const table = role === 'instructor' ? 'instructors' : 'users';

    const [rows] = await db.query(`SELECT password FROM ${table} WHERE id = ?`, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, rows[0].password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Old password is incorrect' 
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const nowIstTimeDate = getISTDateTime();  
    await db.query(`UPDATE ${table} SET password = ?, updated_at = ? WHERE id = ?`, [
      hashedPassword, nowIstTimeDate,
      userId
    ]);

    return res.status(200).json({ 
      success: true, 
      message: 'Password updated successfully' 
    });

  } catch (error) {
    return handleServerError(res, error);
  }
};



export const getUsers = async (req, res) => {
  try {
    const users = await UserModel.getAllUsers();
    res.status(200).json({ success: true, users });
  } catch (err) {
    return handleServerError(res, err);
  }
};


// export const getCourseEMIDetails = async (req, res) => {
//   const user_id = req.user?.id;

//   if (!user_id) {
//     return res.status(401).json({ success: false, message: 'Unauthorized' });
//   }

//   try {
//     const enrollments = await UserModel.getUserEnrolledCoursesWithBatches(user_id);

//     if (!enrollments || enrollments.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'No course enrollments found.'
//       });
//     }

//     const result = [];
//     const currentDate = new Date();

//     for (const course of enrollments) {
//       const { course_id, batch_id, payment_method } = course;
//       const isEMI = payment_method === '2emis' || payment_method === '3emis';

//       const emis = isEMI ? await UserModel.getCourseEmisForUser(user_id, course_id, batch_id) : [];
//       const upcomingEmis = emis.filter(e => e.paid === 0 && new Date(e.due_date) >= currentDate);
//       const nextEmi = upcomingEmis[0];

//       // Get total lessons
//       const [curriculumLessons] = await db.execute(
//         `SELECT id FROM course_curriculums WHERE course_id = ?`,
//         [course_id]
//       );
//       const totalLessons = curriculumLessons.length;

//       // Get user progress
//       const userProgress = await UserModel.getCurriculumStatus(course_id, user_id);
//       const completedLessons = userProgress.filter(c => c.status === 'completed').length;

//       const progressPercent = totalLessons > 0
//         ? Math.round((completedLessons / totalLessons) * 100)
//         : 0;

//       const courseInfo = {
//         course_id,
//         batch_id,
//         course_name: course.name,
//         instructor: course.instructor_name,
//         level: course.level,
//         image: course.image,
//         duration: course.duration_time,
//         price: course.price,
//         sub_categories: JSON.parse(course.sub_categories || '[]'),
//         is_payment_with_emi: isEMI,
//         progress: {
//           percent: progressPercent,
//           completed: completedLessons,
//           total: totalLessons
//         },
//         payment_status: isEMI
//           ? nextEmi
//             ? `next EMI due: ₹${nextEmi.installment_amount} on ${new Date(nextEmi.due_date).toDateString()}`
//             : 'fully paid'
//           : 'fully paid',
//         batch: {
//           batch_id: batch_id,
//           batch_name: course.batch_name
//         }
//       };

//       if (isEMI) {
//         courseInfo.emi_details = {
//           total_emis: emis.length || 0,
//           unpaid_emis: upcomingEmis.length || 0,
//           next_due: nextEmi?.due_date || null,
//           emis: upcomingEmis.map(e => ({
//             emi_id: e?.id,
//             amount: e?.installment_amount,
//             installment_amount: e.installment_amount,
//             due_date: e.due_date,
//           }))
//         };
//       }

//       result.push(courseInfo);
//     }

//     return res.status(200).json({
//       success: true,
//       message: 'Course EMI and progress details fetched successfully.',
//       data: result
//     });
//   } catch (err) {
//     return handleServerError(res, err);
//   }
// };

export const getCourseEMIDetails = async (req, res) => {
  const user_id = req.user?.id;

  if (!user_id) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const enrollments = await UserModel.getUserEnrolledCoursesWithBatches(user_id);

    if (!enrollments || enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No course enrollments found.'
      });
    }

    const result = [];

    for (const course of enrollments) {
      const { course_id, batch_id, payment_method } = course;
      const isEMI = payment_method === '2emis' || payment_method === '3emis';

      const emis = isEMI
        ? await UserModel.getCourseEmisForUser(user_id, course_id, batch_id)
        : [];

      const unpaidEmis = emis
        .filter(e => e.paid === 0)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

      const nextEmi = unpaidEmis[0];

      // ✅ Get total lessons
      const [curriculumLessons] = await db.execute(
        `SELECT id FROM course_curriculums WHERE course_id = ?`,
        [course_id]
      );
      const totalLessons = curriculumLessons.length;

      // ✅ Get batch start & end dates
     
      const [[batchInfo]] = await db.execute(
        `SELECT start_date, end_date, start_time, end_time FROM course_batches WHERE id = ?`,
        [batch_id]
      );

      const batchStartDate = batchInfo.start_date;
      const batchEndDate = batchInfo.end_date;
      const sessionEndTime = batchInfo.end_time;

      const { completedLessons, percent: progressPercent } = await UserModel.calculateBatchProgressWithSessionIST(
          totalLessons,
          batchStartDate,
          batchEndDate,
          sessionEndTime
        );

      const courseInfo = {
        course_id,
        batch_id,
        course_name: course.name,
        instructor: course.instructor_name,
        level: course.level,
        image: course.image,
        duration: course.duration_time,
        price: course.price,
        sub_categories: JSON.parse(course.sub_categories || '[]'),
        is_payment_with_emi: isEMI,
        progress: {
          percent: progressPercent,
          completed: completedLessons,
          total: totalLessons
        },
        payment_status: isEMI
          ? nextEmi
            ? `next EMI due: ₹${nextEmi.installment_amount} on ${new Date(nextEmi.due_date).toDateString()}`
            : 'fully paid'
          : 'fully paid',
        batch: {
          batch_id: batch_id,
          batch_name: course.batch_name
        }
      };

      if (isEMI) {
        courseInfo.emi_details = {
          total_emis: emis.length || 0,
          unpaid_emis: unpaidEmis.length || 0,
          next_due: nextEmi?.due_date || null,
          emis: unpaidEmis.map(e => ({
            emi_id: e.id,
            amount: e.installment_amount,
            installment_amount: e.installment_amount,
            due_date: e.due_date
          }))
        };
      }

      result.push(courseInfo);
    }

    return res.status(200).json({
      success: true,
      message: 'Course EMI and progress details fetched successfully.',
      data: result
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};
export const getCourseOverview = async (req, res) => {
  const { courseId, batchId} = req.params;

  try {
    const courseData = await UserModel.getCourseOverviewData(courseId, batchId);
    const overviewData = await UserModel.getCourseOverviewExtras(courseId);
    // const lessons = await UserModel.getCourseCurriculumTitles(courseId);

    if (!courseData || !overviewData) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.'
      });
    }
    const [batch] = await db.execute(
         `SELECT id AS batch_id, batch_name AS batch_name, start_date FROM course_batches WHERE id = ?`,
    [batchId]
  );
    return res.status(200).json({
      success: true,
      message: 'Course overview fetched successfully.',
      data: {
        batch: batch[0],
        ...courseData,
        ...overviewData,
        // lessons
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error.', error });
  }
};

export const getLessonsById = async (req, res) => {
  const { curriculumId } = req.params;

  try {
    const data = await UserModel.getFullCurriculumById(curriculumId);

    if (!data) {
      return res.status(404).json({ success: false, message: 'Curriculum not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Curriculum content fetched successfully.',
      data
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error.', error });
  }
};


 // ✅ use dayjs for clean date ops

export const getCourseLessonsWithBatchSessionDetails = async (req, res) => {
  const { course_id, batch_id } = req.params;
  const userId = req.user?.id;

  try {
    const courseId = Number(course_id);
    const batchId = Number(batch_id);

    if (!courseId || !batchId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course_id, batch_id or user'
      });
    }

    // ✅ Get enrollment
    const [[enrollment]] = await db.query(
      `SELECT ce.payment_method, cp.id as payment_id, cp.status
       FROM course_enrollments ce
       JOIN course_payments cp 
         ON cp.course_id = ce.course_id AND cp.batch_id = ce.batch_id AND cp.user_id = ce.user_id
       WHERE ce.user_id = ? AND ce.course_id = ? AND ce.batch_id = ?
       LIMIT 1`,
      [userId, courseId, batchId]
    );

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'No enrollment/payment found for this course and batch'
      });
    }

    // ✅ Determine EMI payment breakdown
    const isEmi = enrollment.payment_method?.includes('emi');

    let fullyPaid = false;
    let totalEmis = 0, paidEmis = 0;

    if (isEmi) {
      const [emis] = await db.query(
        `SELECT paid FROM course_emis WHERE payment_id = ?`,
        [enrollment.payment_id]
      );
      totalEmis = emis.length;
      paidEmis = emis.filter(e => e.paid === 1).length;

      fullyPaid = paidEmis === totalEmis && totalEmis > 0;
    } else {
      fullyPaid = enrollment.payment_method === 'full' || enrollment.status === 'paid';
    }

    // ✅ Fetch lessons with batch + batch details
    const [lessons] = await db.query(
      `SELECT
         curr.id AS curriculum_id,
         curr.title AS curriculum_title,
         curr.sequence,
         bs.status,
         bs.video_link,
         cb.meeting_link,
         DATE_FORMAT(cb.start_date, '%Y-%m-%d') AS start_date,
         TIME_FORMAT(cb.start_time, '%H:%i:%s') AS start_time, -- 24hr for math ops
         TIME_FORMAT(cb.end_time, '%H:%i:%s') AS end_time
       FROM course_curriculums curr
       LEFT JOIN batch_sessions bs
         ON bs.batch_id = ? AND bs.session_number = curr.sequence
       JOIN course_batches cb ON cb.id = ?
       WHERE curr.course_id = ?
       ORDER BY curr.sequence ASC`,
      [batchId, batchId, courseId]
    );

    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No lessons found for this course and batch'
      });
    }

    const totalLessons = lessons.length;

    let unlockedLessons = totalLessons; // default for fully paid

    if (isEmi && totalEmis > 0) {
      const lessonsPerEmi = Math.ceil(totalLessons / totalEmis);
      unlockedLessons = lessonsPerEmi * paidEmis;
    }

    // ✅ Get base start date/time once
    const batchStartDate = lessons[0].start_date;
    const batchStartTime = lessons[0].start_time;
    const batchEndTime = lessons[0].end_time;

    const now = dayjs(); // current IST time (make sure server timezone is IST!)

    const processed = lessons.map(lesson => {
      const locked = !fullyPaid && lesson.sequence > unlockedLessons;

      // Compute lesson start date: batch start + (sequence - 1) days
      const lessonDate = dayjs(batchStartDate).add(lesson.sequence - 1, 'day').format('YYYY-MM-DD');

      // Combine date + time for meeting check
      const lessonStart = dayjs(`${lessonDate} ${batchStartTime}`);
      const lessonEnd = dayjs(`${lessonDate} ${batchEndTime}`);
      const joinWindowStart = lessonStart.subtract(30, 'minute');

      let meeting_status = 'meeting not started';
      if (now.isAfter(lessonEnd)) {
        meeting_status = 'meeting completed';
      } else if (now.isAfter(joinWindowStart) && now.isBefore(lessonEnd)) {
        meeting_status = 'join meeting';
      }

      let videoLinkFinal = locked ? null : lesson.video_link;
      let meetingLinkFinal = locked ? null : lesson.meeting_link;

      // 🔒 Mutual exclusion: If video exists, meeting link must be null.
      if (videoLinkFinal) {
        meetingLinkFinal = null;
      }

      // 🟢 NEW: If meeting is completed, force meeting link to null.
      if (meeting_status === 'meeting completed') {
        meetingLinkFinal = null;
      }
      if (meeting_status === 'meeting not started') {
        meetingLinkFinal = null;
        videoLinkFinal = null
      }

      return {
        curriculum_id: lesson.curriculum_id,
        curriculum_title: lesson.curriculum_title,
        sequence: lesson.sequence,
        video_link: videoLinkFinal,
        meeting_link: meetingLinkFinal,
        lesson_lock: locked,
        lesson_start_date: locked ? null : lessonDate,
        lesson_start_time: locked ? null : dayjs(lessonStart).format('hh:mm A'),
        meeting_status: locked ? null : meeting_status
      };
    });


    return res.status(200).json({
      success: true,
      course_id: courseId,
      batch_id: batchId,
      batch_start_date: batchStartDate,
      batch_start_time: dayjs(`${batchStartDate} ${batchStartTime}`).format('hh:mm A'),
      lessons: processed
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};





// export const getCourseLessonsWithBatchSessionDetails = async (req, res) => {
//   const { course_id, batch_id } = req.params;
//   const userId = req.user?.id;

//   try {
//     const courseId = Number(course_id);
//     const batchId = Number(batch_id);

//     if (!courseId || !batchId || !userId) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid course_id, batch_id or user'
//       });
//     }

//     // 1️⃣ Get payment info
//     const [paymentRows] = await db.query(
//       `SELECT ce.payment_method, cp.status, cp.id as payment_id
//        FROM course_enrollments ce
//        JOIN course_payments cp ON cp.course_id = ce.course_id AND cp.batch_id = ce.batch_id AND cp.user_id = ce.user_id
//        WHERE ce.user_id = ? AND ce.course_id = ? AND ce.batch_id = ?
//        LIMIT 1`,
//       [userId, courseId, batchId]
//     );

//     if (paymentRows.length === 0) {
//       return res.status(403).json({
//         success: false,
//         message: 'No payment found for this course and batch'
//       });
//     }

//     const payment = paymentRows[0];

//     // 2️⃣ Get curriculum + sessions + course_batches
//     const [lessons] = await db.query(
//       `SELECT
//          curr.id AS curriculum_id,
//          curr.title AS curriculum_title,
//          curr.sequence,
//          bs.status,
//          bs.video_link,
//          cb.meeting_link
//        FROM course_curriculums curr
//        LEFT JOIN batch_sessions bs
//          ON bs.batch_id = ? AND bs.session_number = curr.sequence
//        JOIN course_batches cb
//          ON cb.id = ?
//        WHERE curr.course_id = ?
//        ORDER BY curr.sequence ASC`,
//       [batchId, batchId, courseId]
//     );

//     // 3️⃣ By default: all unlocked
//     let unlockedCount = lessons.length;

//     // 4️⃣ Check for EMI
//     if (payment.payment_method === '2emis' || payment.payment_method === '3emis') {
//       // Get EMI details
//       const [emis] = await db.query(
//         `SELECT * FROM course_emi_payments WHERE user_id = ? AND course_id = ? AND paid = 1 ORDER BY due_date ASC`,
//         [userId, courseId]
//       );
//       const totalEmisPaid = emis.length;

//       const totalEmis = payment.payment_method === '2emis' ? 2 : 3;
//       const totalLessons = lessons.length;

//       unlockedCount = Math.floor((totalLessons / totalEmis) * totalEmisPaid);
//     }

//     // 5️⃣ Apply lock & hide links if locked
//     const processed = lessons.map((lesson, index) => {
//       const locked = index >= unlockedCount;

//       return {
//         curriculum_id: lesson.curriculum_id,
//         curriculum_title: lesson.curriculum_title,
//         sequence: lesson.sequence,
//         status: locked ? null : lesson.status,
//         video_link: locked ? null : lesson.video_link,
//         meeting_link: locked ? null : lesson.meeting_link,
//         lesson_lock: locked
//       };
//     });

//     return res.status(200).json({
//       success: true,
//       course_id: courseId,
//       batch_id: batchId,
//       lessons: processed
//     });

//   } catch (err) {
//     return handleServerError(res, err);
//   }
// };




// billing history of student


export const CurriculumDetailsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params; 
    const allLessonsByCourse = await getCurriculumByCourse(courseId);
    // console.log(allLessonsByCourse)
    return res.status(200).json({
        success: true,
        getLessonsByCourse: allLessonsByCourse
    });
  } catch (err) {
    return handleServerError(res, err);
  }
}

export const getBillingHistory = async (req, res) => {
  try {
    const user_id = req.user?.id;

    const [rows] = await db.execute(
      `
      (
        SELECT 
          ce.course_id,
          c.name AS course_name,
          cp.amount,
          DATE_FORMAT(CONVERT_TZ(cp.created_at, '+00:00', '+00:00'), '%d-%m-%Y %r') AS payment_datetime,
          cp.status,
          'full_payment' AS payment_type
        FROM course_enrollments ce
        JOIN course_payments cp ON cp.user_id = ce.user_id AND cp.course_id = ce.course_id
        JOIN courses c ON c.id = ce.course_id
        WHERE ce.user_id = ?
          AND ce.payment_method = 'full'
      )

      UNION ALL

      (
        SELECT 
          ce.course_id,
          c.name AS course_name,
          emis.installment_amount AS amount,
          DATE_FORMAT(CONVERT_TZ(emis.paid_at, '+00:00', '+00:00'), '%d-%m-%Y %r') AS payment_datetime,
          CASE emis.paid WHEN 1 THEN 'paid' ELSE 'unpaid' END AS status,
          'emi_payment' AS payment_type
        FROM course_enrollments ce
        JOIN course_emis emis ON emis.user_id = ce.user_id AND emis.course_id = ce.course_id
        JOIN courses c ON c.id = ce.course_id
        WHERE ce.user_id = ?
          AND ce.payment_method IN ('2emis', '3emis')
          AND emis.paid = 1
      )

      ORDER BY payment_datetime DESC
      `,
      [user_id, user_id]
    );

    return res.status(200).json({
      success: true,
      payments: rows
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};



export const getCourseProgress = async (req, res) => {
  const { user_id, course_id } = req.params;

  try {
    const data = await UserModel.getCourseProgressData(user_id, course_id);

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No progress data found or payment not completed.'
      });
    }

    return res.status(200).json({
      success: true,
      course_id: course_id,
      user_id: user_id,
      progress: data
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};

// export const getCourseProgress = async (req, res) => {
//   const { user_id, course_id, batch_id } = req.params;

//   try {
//     // If you still want to check payment:
//     const [payment] = await db.query(
//       `SELECT id FROM course_payments WHERE user_id = ? AND course_id = ? AND status = 'paid' LIMIT 1`,
//       [user_id, course_id]
//     );
//     if (payment.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'No progress data found or payment not completed.'
//       });
//     }

//     // Now get progress merged with batch_sessions:
//     const [result] = await db.query(
//       `SELECT
//          curr.id AS curriculum_id,
//          curr.title AS curriculum_title,
//          bs.status,
//          bs.video_link,
//          bs.meeting_link
//        FROM course_curriculums curr
//        LEFT JOIN batch_sessions bs
//          ON bs.batch_id = ? AND bs.session_number = curr.sequence
//        WHERE curr.course_id = ?
//        ORDER BY curr.sequence ASC`,
//       [batch_id, course_id]
//     );

//     return res.status(200).json({
//       success: true,
//       course_id,
//       user_id,
//       batch_id,
//       progress: result
//     });

//   } catch (err) {
//     return handleServerError(res, err);
//   }
// };




export const addCourseReviewByStudent = async (req, res) => {
  const user_id = req.user?.id;
  const { course_id, review, rating } = req.body;

  // ✅ Basic validation
  if (!user_id || !course_id || !review || !rating) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: user_id, course_id, review, rating'
    });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      message: 'Rating must be between 1 and 5'
    });
  }

  try {
    // ✅ Optional: check if course exists
    const [[course]] = await db.query(`SELECT id FROM courses WHERE id = ?`, [course_id]);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // ✅ Optional: check if user exists
    const [[user]] = await db.query(`SELECT id FROM users WHERE id = ?`, [user_id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ✅ Insert review
    await db.query(`
      INSERT INTO course_reviews (course_id, user_id, review, rating, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `, [course_id, user_id, review, rating]);

    return res.status(201).json({
      success: true,
      message: 'Review added successfully'
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};
