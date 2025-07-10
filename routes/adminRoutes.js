import express from 'express';
import { addCarousel, addFullCourse, changeAdminPassword, deleteCarousel, deleteCourse, deleteUserByRoleAndId, getAdminDashboardSummary, getAdminProfile, getAllCarousels, getAllCategories, getAllCoursesController, getAllInstructors, getContactMessagesController, getCoursePaymentsController, getFullCourseById, getInstructorDetailsByAdmin, getInstructorsNamesForDropDownList, getRequestInstructors, getSingleCarousel, getStudentDetailsByAdmin, getSubCategoriesByCategoryId, getUsersByRoleWithPagination, login, register, resetAdminPassword, sendOtpToAdminEmail, updateAdmin, updateCarousel, updateCourseDetails, updateInstructorStatus, uploadingAnImage, verifyAdminOtp } from '../controllers/adminController.js';
import { verifyTokenAdmin } from '../middleware/admin.js';
import { addToNewBlogs, deleteBlogById, getBlogdetails, getPaginatedBlogs, updateBlogById } from '../controllers/blogsController.js';
import { addNewService, deleteServiceById, fetchLatestServices, fetchServiceById, updateServiceById } from '../controllers/servicesController.js';
import { getUploader } from '../middleware/upload.js';
import { createStudentFeedback, deleteStudentFeedback, getAllStudentsFeedback, getAllStudentsForCreatingFeedback, getStudentFeedbackById, updateStudentFeedback } from '../models/blogsModel.js';

const uploadImage = getUploader('courses');
const uploadImageToBlog = getUploader('blogs');
const uploadImageToServices = getUploader('services');
const uploadImageToAdmin = getUploader('admin')
const uploadImageToCarousel = getUploader('carousel');

const router = express.Router();


router.post("/register", register);
router.post("/login", login);
router.get('/get-admin-profile-details', verifyTokenAdmin, getAdminProfile);
router.put('/update-to-admin-details', verifyTokenAdmin, uploadImageToAdmin.single('image'),  updateAdmin);
router.put('/change-password', verifyTokenAdmin, changeAdminPassword);

router.get('/dashboard-summary-details', verifyTokenAdmin, getAdminDashboardSummary);

// showing students or instructor
router.get('/get-all-students', verifyTokenAdmin, getUsersByRoleWithPagination);
router.get('/get-student-details/:id', verifyTokenAdmin, getStudentDetailsByAdmin);

router.get('/get-all-instructors', verifyTokenAdmin, getAllInstructors);
router.get('/get-instructor-details/:id', verifyTokenAdmin, getInstructorDetailsByAdmin);
router.delete('/deleteUser/:role/:id', verifyTokenAdmin, deleteUserByRoleAndId);

router.get('/get-request-instrutors', verifyTokenAdmin, getRequestInstructors);
router.put('/update-to-instructor-status/:id', verifyTokenAdmin, updateInstructorStatus)


/// course
router.get('/courses',verifyTokenAdmin, getAllCoursesController);
router.post('/addFullCourse',verifyTokenAdmin, uploadImage.single('image'), addFullCourse);
router.get('/get-full-course-details/:id', verifyTokenAdmin,  getFullCourseById);
router.put('/updateCourse/:id', verifyTokenAdmin, uploadImage.single('image'),updateCourseDetails);
router.delete('/deleteCourse/:id', verifyTokenAdmin, deleteCourse);


// categories and sub categories
router.get('/get-instructors-names', verifyTokenAdmin, getInstructorsNamesForDropDownList);
router.get("/get-categories", verifyTokenAdmin, getAllCategories);
router.get("/get-sub-categories/:id", verifyTokenAdmin, getSubCategoriesByCategoryId);

// home page for carousels
router.post("/homepage-carousel", verifyTokenAdmin, uploadImageToCarousel.single('image'), addCarousel);
router.put("/update-homepage-carousel/:id", verifyTokenAdmin, uploadImageToCarousel.single('image'), updateCarousel);
router.get("/get-single-carousel-details/:id",verifyTokenAdmin,  getSingleCarousel);
router.get("/get-all-carousels", verifyTokenAdmin, getAllCarousels);   
router.delete("/homepage-carousel/:id", verifyTokenAdmin, deleteCarousel);

// payments
router.get('/coursePayments', verifyTokenAdmin, getCoursePaymentsController);


// blogs
router.post("/addBlogs", verifyTokenAdmin, uploadImageToBlog.single('image'), addToNewBlogs);
router.put("/update-to-the-blog/:id", verifyTokenAdmin,uploadImageToBlog.single('image'),  updateBlogById);
router.get('/paginated-six-blogs', verifyTokenAdmin,  getPaginatedBlogs);
router.get('/get-blog-details/:id', verifyTokenAdmin,  getBlogdetails);
router.delete("/delete-blog/:id",verifyTokenAdmin,  deleteBlogById);


// our sevices
router.get('/get-all-our-services', verifyTokenAdmin,  fetchLatestServices);
router.get('/get-single-service-details/:id',verifyTokenAdmin,  fetchServiceById);
router.post('/add-service', verifyTokenAdmin, uploadImageToServices.single('image'),  addNewService);
router.put("/update-to-our-service/:id", verifyTokenAdmin, uploadImageToServices.single('image'), updateServiceById);
router.delete('/delete-service/:id', verifyTokenAdmin, deleteServiceById);


// student feedback - showing in web page home
router.get('/get-all-students-feedback', verifyTokenAdmin,  getAllStudentsFeedback);
router.get('/get-single-student-feedback/:id',verifyTokenAdmin,  getStudentFeedbackById);
router.get('/get-all-students-for-feedback', verifyTokenAdmin, getAllStudentsForCreatingFeedback)
router.post('/create-student-feedback', verifyTokenAdmin, createStudentFeedback);
router.put('/update-to-student-feedback/:id', verifyTokenAdmin, updateStudentFeedback);
router.delete('/delete-students-feedback/:id', verifyTokenAdmin, deleteStudentFeedback);

// contact details

// testing api for uploading pic
router.post("/testing-image",  verifyTokenAdmin, uploadImage.single('image'), uploadingAnImage);


router.get('/contactMessages', verifyTokenAdmin, getContactMessagesController);


// forgot password
router.post("/otp-for-forgot-password", sendOtpToAdminEmail);
router.post("/verify-otp", verifyAdminOtp);
router.post("/reset-password", resetAdminPassword);








export default router;
