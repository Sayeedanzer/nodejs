import express from 'express';
import {
  addBlogComment,
  fetchTopCourseReviews,
  getBlogComments
} from '../controllers/commentsController.js';

const router = express.Router();

router.get('/blog-comments/:id', getBlogComments);
router.post('/add', addBlogComment);
router.get("/top-course-reviews-in-home-page", fetchTopCourseReviews);


export default router;
