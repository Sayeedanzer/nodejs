import express from "express";
import { changeInstructorPassword, editInstructorDetails, getBatchesForCourseForInstructor, getInstructorCoursesDetails, getInstructorDetailsOnProfile, getInstructorSummaryController, login, newRegisterForInstructor, resetInstructorPassword, sendOtpToInstructorEmail, verifyInstructorOtp } from "../controllers/instructorController.js";
import { verifyTokenInstructor } from "../middleware/instructor.js";
import { getUploader } from "../middleware/upload.js";
const uploadImageToInstructors = getUploader('instructors');

const router = express.Router();

router.post('/register-instructor', newRegisterForInstructor);
router.post('/login', login);

// profile
router.get("/get-instructor-profile-details", verifyTokenInstructor, getInstructorDetailsOnProfile);
router.put("/edit-instructor-details", verifyTokenInstructor, uploadImageToInstructors.single('image'), editInstructorDetails);
router.post('/change-password', verifyTokenInstructor , changeInstructorPassword);


router.get("/aasigned-courses", verifyTokenInstructor, getInstructorCoursesDetails);
router.get('/get-batches-by-course/:course_id', verifyTokenInstructor, getBatchesForCourseForInstructor);

router.get('/dashboard-details',verifyTokenInstructor, getInstructorSummaryController);


// forgot password
// If you want separate routes:
router.post("/otp-for-forgot-password", sendOtpToInstructorEmail);
router.post("/verify-otp", verifyInstructorOtp);
router.post("/reset-password", resetInstructorPassword);


export default router;