// paymentController.js
import db from '../config/db.js';
import { sendPaymentConfirmation } from '../config/mailer.js';
import razorpay from '../config/razorpay.js';
import { getISTDateTime } from '../helpers/dateTimeFormat.js';
import { handleServerError } from '../helpers/handleWithErrors.js';
import { enrollUserInCourse, getPaymentDetailsByOrderId, insertPayment, updatePaymentStatus } from '../models/paymentModel.js';
import moment from 'moment-timezone';



// export const getBatchesOnThisCourse = async (req, res) => {
//   const courseId = Number(req.params.course_id);
//   const userId = req.user?.id || 0;

//   try {
//     const [rows] = await db.query(
//       `SELECT 
//          cb.id AS batch_id,
//          cb.batch_name,
//          DATE_FORMAT(cb.start_date, '%Y-%m-%d') AS start_date,
//          TIME_FORMAT(cb.start_time, '%h:%i %p') AS start_time,
//          TIME_FORMAT(cb.end_time, '%h:%i %p') AS end_time,
//          IF(ce.id IS NOT NULL, 'Already paid', 'Available') AS batch_status
//        FROM course_batches cb
//        LEFT JOIN course_enrollments ce
//          ON ce.course_id = cb.course_id
//          AND ce.batch_id = cb.id
//          AND ce.user_id = ?
//        WHERE cb.course_id = ? AND cb.status = 'active'
//        ORDER BY cb.start_date ASC`,
//       [userId, courseId]
//     );

//     // Group by month using plain JS Date
//     const grouped = {};

//     rows.forEach(batch => {
//       const date = new Date(batch.start_date); // 'YYYY-MM-DD' => UTC by default
//       const monthYear = date.toLocaleString('en-IN', { // 'en-IN' for Indian style
//         month: 'long',
//         year: 'numeric',
//         timeZone: 'Asia/Kolkata' // force IST
//       });

//       if (!grouped[monthYear]) {
//         grouped[monthYear] = [];
//       }

//       grouped[monthYear].push(batch);
//     });

//     return res.json({
//       success: true,
//       batches: grouped
//     });
//   } catch (err) {
//     return handleServerError(res, err);
//   }
// };

export const getBatchesOnThisCourse = async (req, res) => {
  const courseId = Number(req.params.course_id);
  const userId = req.user?.id || 0;

  try {
    const [rows] = await db.query(
      `SELECT 
         cb.id AS batch_id,
         cb.batch_name,
         DATE_FORMAT(cb.start_date, '%Y-%m-%d') AS start_date,
         TIME_FORMAT(cb.start_time, '%h:%i %p') AS start_time,
         TIME_FORMAT(cb.end_time, '%h:%i %p') AS end_time,
         IF(ce.id IS NOT NULL, 'Already paid', 'Available') AS batch_status
       FROM course_batches cb
       LEFT JOIN course_enrollments ce
         ON ce.course_id = cb.course_id
         AND ce.batch_id = cb.id
         AND ce.user_id = ?
       WHERE cb.course_id = ?
         AND cb.status = 'active'
         AND DATE(cb.start_date) >= CURDATE()
       ORDER BY cb.start_date ASC`,
      [userId, courseId]
    );

    // Group by month using plain JS Date
    const grouped = {};

    rows.forEach(batch => {
      const date = new Date(batch.start_date);
      const monthYear = date.toLocaleString('en-IN', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
      });

      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }

      grouped[monthYear].push(batch);
    });

    return res.json({
      success: true,
      batches: grouped
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};

export const getCoursePaymentPreview = async (req, res) => {
  const user_id = req.user?.id;
  const course_id = req.params.id;
  const { payment_method, selected_batch_id } = req.body;

  if (!course_id || !payment_method) {
    return res.status(400).json({
      success: false,
      message: "course_id (param) and payment_method (body) are required"
    });
  }

  try {
    const [courseRows] = await db.execute(
      `SELECT name, instructor_name, price, is_installments FROM courses WHERE id = ?`,
      [course_id]
    );
    const course = courseRows[0];

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    const [batchRows] = await db.execute(
      `SELECT id AS batch_id, start_date FROM course_batches WHERE id = ? LIMIT 1`,
      [selected_batch_id]
    );

    if (batchRows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid batch selected" });
    }

    const selectedBatch = batchRows[0];

    // ----- FULL PAYMENT -----
    if (payment_method === "full") {
      return res.status(200).json({
        success: true,
        payment_method,
        course_name: course.name,
        instructor_name: course.instructor_name,
        price: parseFloat(course.price),
        razorpay_payment_price: parseFloat(course.price),
        total_sessions: null,
        next_due_dates: [],
        total_installments: 1,
        first_installment_paid: true,
        batch_list: [
          {
            batch_id: selectedBatch.batch_id,
            start_date: new Date(selectedBatch.start_date).toLocaleString("en-CA", {
              timeZone: "Asia/Kolkata"
            }).split(',')[0]
          }
        ]
      });
    }

    // ----- EMI PAYMENT -----
 // ----- EMI PAYMENT -----
    if (payment_method === "2emis" || payment_method === "3emis") {
      if (!course.is_installments) {
        return res.status(400).json({
          success: false,
          message: "Installments not available for this course"
        });
      }

      // Get curriculum session count
      const [[{ session_count }]] = await db.execute(
        `SELECT COUNT(*) as session_count FROM course_curriculums WHERE course_id = ?`,
        [course_id]
      );

      const installment_count = payment_method === "3emis" ? 3 : 2;
      const installment_amount = parseFloat((course.price / installment_count).toFixed(2));

      // ✅ Fallback to minimum of 1 day if session_count is 0
      let sessionInterval = Math.floor(session_count / installment_count);
      if (sessionInterval < 1) sessionInterval = 1;

      const startDate = new Date(selectedBatch.start_date);
      const due_dates = [];

      for (let i = 1; i < installment_count; i++) {
        const due = new Date(startDate);
        due.setDate(due.getDate() + (i * sessionInterval));
        due_dates.push(
          due.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
        );
      }

      return res.status(200).json({
        success: true,
        payment_method,
        course_name: course.name,
        instructor_name: course.instructor_name,
        price: parseFloat(course.price),
        installment_amount,
        total_installments: installment_count,
        next_due_dates: due_dates,
        total_sessions: session_count,
        razorpay_payment_price: installment_amount,
        first_installment_paid: true,
        batch_list: [
          {
            batch_id: selectedBatch.batch_id,
            start_date: new Date(selectedBatch.start_date).toLocaleString("en-CA", {
              timeZone: "Asia/Kolkata"
            })
          }
        ]
      });
    }



  } catch (error) {
    return handleServerError(res, error);
  }
};



export const createOrder = async (req, res) => {
  try {
    const nowIstTimeDate = getISTDateTime();
    const { course_id, amount, payment_method, batch_id } = req.body;
    const user_id = req.user.id;

      // console.log("line 100", req.user.id);
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `receipt_${nowIstTimeDate}`,
    });
    // console.log('Create Order Params:', { user_id, course_id, amount, orderId: order.id });

    await insertPayment({ user_id, course_id, razorpay_order_id: order.id, amount, batch_id });

    return res.status(201).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      payment_method,
    });

  } catch (error) {
    // console.log("line 242", error)
        return handleServerError(res, error)
  }
};


export const verifyPayment = async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    payment_method,
  } = req.body;

  const user_id = req.user.id;

  try {
    const nowIstTimeDate = getISTDateTime();
    // 1. Update course_payments with payment info
    await updatePaymentStatus({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    // 2. Get payment and course info
    const payment = await getPaymentDetailsByOrderId(razorpay_order_id);
    const { id: payment_id, course_id, amount, batch_id } = payment;

    // 3. Enroll user
    await enrollUserInCourse({ user_id, course_id, payment_method, batch_id });

    const [[user]] = await db.execute(`SELECT name, email FROM users WHERE id = ? LIMIT 1`, [user_id]);
    const [[course]] = await db.execute(`SELECT name, price FROM courses WHERE id = ? LIMIT 1`, [course_id]);
    if (payment_method === "full" ){
      await sendPaymentConfirmation(user.email, user.name, course.name, amount);
    }
    // 5. If EMI — create EMI schedule
    if (payment_method === '2emis' || payment_method === '3emis') {
      const maxInstallments = payment_method === '3emis' ? 3 : 2;

      const installmentAmount = parseFloat((course.price / maxInstallments).toFixed(2));

      // Get batch start date
      const [batches] = await db.execute(
        `SELECT start_date FROM course_batches WHERE id = ? LIMIT 1`,
        [batch_id]
      );

      if (batches.length === 0) {
        return res.status(400).json({ success: false, message: "Batch not found for course" });
      }


      // Get session count
      const [[{ session_count }]] = await db.execute(
        `SELECT COUNT(*) as session_count FROM course_curriculums WHERE course_id = ?`,
        [course_id]
      );

      const interval = Math.floor(session_count / maxInstallments);

      const batchStart = moment.tz(batches[0].start_date, 'Asia/Kolkata');

      for (let i = 0; i < maxInstallments; i++) {
        const due = batchStart.clone().add(i * interval, 'days'); // Safe use of clone
        const dueFormatted = due.format('YYYY-MM-DD HH:mm:ss');

        const paid = i === 0 ? 1 : 0;
        const paid_at = i === 0 ? getISTDateTime() : null;

  
        await db.execute(
          `INSERT INTO course_emis 
            (user_id, course_id, batch_id, payment_id, installment_amount, due_date, paid, paid_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            user_id,
            course_id,
            batch_id,            // ✅ Must be included
            payment_id,
            installmentAmount,
            dueFormatted,
            paid,
            paid_at,
            nowIstTimeDate,
            nowIstTimeDate
          ]
        );
      }
      await sendPaymentConfirmation(user.email, user.name, course.name, amount);
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified and course access granted."
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};






export const createNextEmiOrder = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { emi_id, amount } = req.body;

    if (!emi_id) {
      return res.status(400).json({ success: false, message: "emi_id is required" });
    }

    // 🔍 1️⃣ Find that EMI for this user
    const [[emi]] = await db.query(
      `SELECT id, installment_amount, payment_id, paid 
       FROM course_emis
       WHERE id = ? AND user_id = ?`,
      [emi_id, user_id]
    );

    if (!emi) {
      return res.status(404).json({ success: false, message: "EMI not found" });
    }

    if (emi.paid) {
      return res.status(400).json({ success: false, message: "This EMI is already paid" });
    }

    // ✅ 2️⃣ Create Razorpay order for this EMI
    const order = await razorpay.orders.create({
      amount: Math.round(emi.installment_amount * 100),
      currency: 'INR',
      receipt: `emi_receipt_${Date.now()}`
    });

    // console.log('Create Specific EMI Order:', {
    //   emi_id: emi.id,
    //   payment_id: emi.payment_id,
    //   orderId: order.id,
    //   amount: emi.installment_amount
    // });

    // 🔑 3️⃣ Save razorpay_order_id back on this EMI record
    await db.query(
      `UPDATE course_emis SET razorpay_order_id = ? WHERE id = ?`,
      [order.id, emi.id]
    );

    return res.status(201).json({
      success: true,
      orderId: order.id,
      emi_id: emi.id,
      payment_id: emi.payment_id,
      amount: order.amount,
      currency: order.currency
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};


export const verifyNextEmiPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const user_id = req.user.id;

  // console.log('line 413', req.body)

  try {
    // Find the EMI record with this order_id
    const [[emi]] = await db.query(
      `SELECT id FROM course_emis WHERE razorpay_order_id = ? AND user_id = ?`,
      [razorpay_order_id, user_id]
    );

    if (!emi) {
      return res.status(400).json({ success: false, message: "Invalid EMI order" });
    }

      await db.query(
      `UPDATE course_emis 
       SET paid = 1,
           paid_at = ?,
           updated_at = ?,
           razorpay_payment_id = ?,
           razorpay_signature = ?
       WHERE id = ?`,
      [getISTDateTime(), getISTDateTime(), razorpay_payment_id, razorpay_signature, emi.id]
    );

    return res.status(200).json({
      success: true,
      message: "EMI payment verified and updated"
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};

