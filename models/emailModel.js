import db from "../config/db.js";

// Get user by email
export async function getUserByEmail(email) {
  const [rows] = await db.execute(
    "SELECT id, name FROM users WHERE email = ?",
    [email]
  );
  return rows[0] || null;
}

// Update OTP and timestamp
export async function updateUserOtp(userId, otp, timestamp) {
  await db.execute(
    "UPDATE users SET otp = ?, otp_created_at = ? WHERE id = ?",
    [otp, timestamp, userId]
  );
}


// Get OTP details
export async function getUserOtpDetails(email) {
  const [rows] = await db.execute(
    "SELECT id, otp, otp_created_at FROM users WHERE email = ?",
    [email]
  );
  return rows[0] || null;
}

// Clear OTP
export async function clearUserOtp(userId) {
  await db.execute(
    "UPDATE users SET otp = NULL, otp_created_at = NULL WHERE id = ?",
    [userId]
  );
}

// Store reset token and timestamp
export async function storeResetToken(userId, token, timestamp) {
  await db.execute(
    "UPDATE users SET reset_token = ?, reset_token_created_at = ? WHERE id = ?",
    [token, timestamp, userId]
  );
}

//update to password
export async function getResetTokenDetails(email) {
  const [rows] = await db.execute(
    "SELECT id, reset_token, reset_token_created_at FROM users WHERE email = ?",
    [email]
  );
  return rows[0] || null;
}

export async function updateUserPassword(id, hashedPassword) {
  await db.execute(
    "UPDATE users SET password = ?, reset_token = NULL, reset_token_created_at = NULL WHERE id = ?",
    [hashedPassword, id]
  );
}
