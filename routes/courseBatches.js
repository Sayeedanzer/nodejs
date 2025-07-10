import express from "express";
import { createCourseBatch, deleteBatch, fetchBatchesByCourseId, fetchCoursesWithBatchInfo, 
    getBatchDetailsForEdit, 
    getBatchSessionsWithCurriculum, getCourseBatch, getCoursesForCreatingToBatches, 
    updateBatchDetails, 
    updateSessionStatus, updateSessionVideoLink } from "../controllers/courseBatchController.js";
import { verifyTokenAdmin } from "../middleware/admin.js";

const router = express.Router();
// create
router.post("/create-batch",verifyTokenAdmin,  createCourseBatch);
router.get('/get-courses-for-adding-to-batches', verifyTokenAdmin, getCoursesForCreatingToBatches);

router.get('/get-single-batch-details/:batch_id',verifyTokenAdmin, getCourseBatch);



// API 1 – All Courses with Batches and Enrollment  API 2 – Specific Course's Batches with Student Count
router.get('/courses-with-batches', verifyTokenAdmin, fetchCoursesWithBatchInfo);
router.get('/all-batches-by-course/:course_id', verifyTokenAdmin,  fetchBatchesByCourseId);



// for edit , get , delete on 1 batch
router.get('/get-batch-details-for-edit/:batch_id', verifyTokenAdmin, getBatchDetailsForEdit);
router.put(
  '/update-batch-details/:batch_id',
  verifyTokenAdmin,
  updateBatchDetails
);
router.delete(
  '/delete-to-the-batch/:batch_id',
  verifyTokenAdmin,
  deleteBatch
);


// for lesson in batch
router.get('/lessons-details-in-batch/:batch_id', verifyTokenAdmin, getBatchSessionsWithCurriculum);
router.get('/updating-to-lesson-status-in-batch/batch_id/:batch_id/session_number/:session_number/status/:status',
    verifyTokenAdmin,
    updateSessionStatus
);
router.put('/edit-video-link-to-lesson',
    verifyTokenAdmin, 
    updateSessionVideoLink
);

export default router;