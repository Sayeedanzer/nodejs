import { handleServerError } from '../helpers/handleWithErrors.js';
import { addBlogCommentData, getCommentsByBlogId, getTopCourseReviews, 
  // getCommentsByBlogId 
} from '../models/commentsModel.js';

export const addBlogComment = async (req, res) => {
  try {
    const { blog_id, user_id, comment } = req.body;
    // console.log(req.body)
    if (!blog_id || !user_id || !comment) {
      return res.status(400).json({
        success: false,
        message: 'blog_id, user_id, and comment are required',
      });
    }

    const result = await addBlogCommentData({ blog_id, user_id, comment });

    res.status(200).json({
      success: true,
      message: 'Comment added successfully',
      commentId: result.insertId,
      blog_id,
      user_id,
      comment,
    });

  } catch (err) {
    handleServerError(res, err)
  }
};



export const getBlogComments = async (req, res) => {
  const blog_id  = req.params.id;

  try {
    const comments = await getCommentsByBlogId(blog_id);
    const totalBlogComments = comments?.length;
    return res.status(200).json({
      success: true,
      blog_id: blog_id,
      totalBlogComments: totalBlogComments,
      comments: comments,
    });
  } catch (err) {
    return handleServerError(res, err);
  }
};


export const fetchTopCourseReviews = async (req, res) => {
  try {
    const reviews = await getTopCourseReviews();

    const aboutSkillZMap = {
      experience: 1,              
      expert_instructors: 25,      
      courses: 120,               
      successful_students: 434
    };

    return res.status(200).json({
      success: true,
      message: "Top course reviews fetched successfully",
      reviews: reviews,
      aboutSkillZMap: aboutSkillZMap
    });

  } catch (error) {
    return handleServerError(res, error);
  }
};
