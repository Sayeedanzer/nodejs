import express  from "express";
import { resetPassword, sendOtpToEmail, verifyOtp } from "../controllers/emailController.js";


const router = express.Router();

// forgot password
router.post("/otp-for-forgot-password", sendOtpToEmail);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);


export default router;