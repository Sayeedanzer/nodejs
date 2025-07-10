import express from 'express';
import { fetchTopInstructors, 
    getAllStudentFeedback, 
    getCourseFilters, 
    getCourseOverview, getCourseReviewsWithStats, getFilteredCourses, getHomePageCarousels, getInstructorDetails, getOneCourseDetails, getSingleCoursePaymentsDetailsOnCoursePage, getUpcomingCourses, topThreeCourses,
} from '../controllers/CourseController.js';
import { parseUserToken, verifyTokenUser } from '../middleware/user.js';

const router = express.Router();


// home page
router.get('/home-page-carousels', getHomePageCarousels);
router.get('/topInstructors', fetchTopInstructors);
router.get('/top', topThreeCourses); // home page popular
router.get('/upcoming', getUpcomingCourses); // home page up coming courses
router.get('/student-feedback', getAllStudentFeedback);
router.get('/courses-page-data', getFilteredCourses); // course page top 6
router.get('/courses-page-data/filters', getCourseFilters);



// course overview
router.get('/overview/:courseId', getCourseOverview);
router.get('/reviews/:courseId', getCourseReviewsWithStats);
router.get('/instructor/:instructorId', getInstructorDetails);

// instructor


router.get('/single-course-details/:courseId', getOneCourseDetails);
router.get('/single-course-payments/:courseId', parseUserToken, getSingleCoursePaymentsDetailsOnCoursePage);

export default router;
