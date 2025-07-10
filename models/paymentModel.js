
import db from '../config/db.js';
import { getISTDateTime } from '../helpers/dateTimeFormat.js';

export const insertPayment = async ({ user_id, course_id, razorpay_order_id, amount, batch_id }) => {
  const nowIstTimeDate = getISTDateTime();

  return await db.execute(
    `INSERT INTO course_payments 
      (user_id, course_id, razorpay_order_id, amount, currency, status, created_at, updated_at, batch_id) 
     VALUES (?, ?, ?, ?, 'INR', 'created', ?, ?, ?)`,
    [user_id, course_id, razorpay_order_id, amount, nowIstTimeDate, nowIstTimeDate, batch_id]
  );
};


export const updatePaymentStatus = async ({ razorpay_payment_id, razorpay_signature, razorpay_order_id }) => {
  const nowIstTimeDate = getISTDateTime();
  return await db.execute(
    `UPDATE course_payments 
     SET razorpay_payment_id = ?, razorpay_signature = ?, status = 'paid', updated_at = ?
     WHERE razorpay_order_id = ?`,
    [razorpay_payment_id, razorpay_signature, nowIstTimeDate,  razorpay_order_id],
  );
};

export const getPaymentDetailsByOrderId = async (razorpay_order_id) => {
  const [rows] = await db.execute(
    `SELECT id, course_id, amount, batch_id FROM course_payments WHERE razorpay_order_id = ?`,
    [razorpay_order_id]
  );
  return rows[0];
};


export const enrollUserInCourse = async ({ user_id, course_id, payment_method, batch_id }) => {
  const nowIstTimeDate = getISTDateTime();

  return await db.execute(
    `INSERT INTO course_enrollments 
      (user_id, course_id, batch_id, isItUserPaid, enrolled_at, payment_method, enrollment_date, is_certified, completion_status)
     VALUES (?, ?, ?, 1, ?, ?, ?, 0, 'not-started')`,
    [user_id, course_id, batch_id, nowIstTimeDate, payment_method, nowIstTimeDate]
  );
};



///
export const getCourseInstallmentInfo = async (course_id) => {
  const [rows] = await db.execute(
    `SELECT max_installments, price FROM courses WHERE id = ?`,
    [course_id]
  );
  return rows[0];
};
////////////////////////////

export const insertEMIInstallments = async ({ user_id, course_id, payment_id, emiAmount, maxInstallments }) => {
for (let i = 0; i < maxInstallments; i++) {
  const due = batchStart.clone().add(i * interval, 'days');
  const dueFormatted = due.format('YYYY-MM-DD HH:mm:ss');

  const paid = i === 0 ? 1 : 0;
  const paid_at = i === 0 ? getISTDateTime() : null;
  const nowIstTimeDate = getISTDateTime();

  await db.execute(
    `INSERT INTO course_emis 
      (user_id, course_id, payment_id, video_index, installment_amount, due_date, paid, paid_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id,
      course_id,
      payment_id,
      i + 1, // ✅ Add video_index as 1-based index
      installmentAmount,
      dueFormatted,
      paid,
      paid_at,
      nowIstTimeDate,
      nowIstTimeDate
    ]
  );
}

};

export const markEmiAsPaid = async ({ user_id, course_id, video_index }) => {
  const nowIstTimeDate = getISTDateTime();
  return await db.execute(
    `UPDATE course_emis 
     SET paid = 1, paid_at = ?, updated_at = ? 
     WHERE user_id = ? AND course_id = ? AND video_index = ?`,
    [nowIstTimeDate, nowIstTimeDate, user_id, course_id, video_index]
  );
};

export const getNextDueEmi = async ({ user_id, course_id }) => {
  const [rows] = await db.execute(
    `SELECT * FROM course_emis 
     WHERE user_id = ? AND course_id = ? AND paid = 0 
     ORDER BY due_date ASC LIMIT 1`,
    [user_id, course_id]
  );
  return rows[0];
};



