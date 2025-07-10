import express from 'express';
import {register, login, getUsers, editDetails, getCourseProgress, changePassword, getCourseEMIDetails, getBillingHistory, getStudentDetailsOnProfile, getCourseOverview, getLessonsById, getCourseLessonsWithBatchSessionDetails, CurriculumDetailsByCourse, addCourseReviewByStudent} from '../controllers/userController.js';
import {  verifyTokenUser } from '../middleware/user.js';
import { getUploader } from '../middleware/upload.js';


const uploadImageToUsers = getUploader('users');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.post("/edit", verifyTokenUser, uploadImageToUsers.single('image'), editDetails);
router.get("/get-students-profile-details", verifyTokenUser, getStudentDetailsOnProfile);
router.post('/change-password', verifyTokenUser, changePassword);
router.get('/all', verifyTokenUser, getUsers);



router.get('/course-and-emi-details', verifyTokenUser, getCourseEMIDetails);
router.get('/course-overview-on-profile/:courseId/:batchId',verifyTokenUser,  getCourseOverview);
router.get('/lesson-details/:curriculumId', verifyTokenUser,  getLessonsById);

router.get(
  '/course-lessons-with-batch-sessions/:course_id/:batch_id',
  verifyTokenUser,
  getCourseLessonsWithBatchSessionDetails
);

router.get('/get-course-lessons/:courseId', CurriculumDetailsByCourse)
router.get('/billing-history', verifyTokenUser, getBillingHistory);
router.get('/course-progress/:user_id/:course_id', verifyTokenUser, getCourseProgress);

router.post('/add-course-review', verifyTokenUser,  addCourseReviewByStudent);



//// instructor


export default router;
