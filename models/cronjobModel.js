import db from '../config/db.js';

export const getUpcomingEmiUsers = async () => {
  const [rows] = await db.execute(`
    SELECT 
      ce.id, ce.due_date, ce.installment_amount, ce.course_id, 
      c.name AS course_name,
      u.phone, u.email, u.name 
    FROM 
      course_emis ce
    JOIN 
      users u ON ce.user_id = u.id
    JOIN
      courses c ON ce.course_id = c.id
    WHERE 
      ce.paid = 0 
      AND ce.due_date BETWEEN CURDATE() AND CURDATE() + INTERVAL 2 DAY
    ORDER BY ce.id DESC
  `);
  return rows;
};
