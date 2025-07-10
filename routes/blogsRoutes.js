import express from 'express';
import {  getBlogdetails, getPaginatedBlogs, getTopThreeBlogs } from '../controllers/blogsController.js';


const router = express.Router();

/// home page
router.get('/top-three', getTopThreeBlogs);

// blogs page
router.get('/paginated-six-blogs', getPaginatedBlogs);
router.get('/details/:id', getBlogdetails);

/// admin

export default router;
