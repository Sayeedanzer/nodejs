// routes/paymentRoutes.js
import express from 'express';
import { createNextEmiOrder, createOrder, getBatchesOnThisCourse, getCoursePaymentPreview, verifyNextEmiPayment, verifyPayment } from '../controllers/paymentController.js';
import { verifyTokenUser } from '../middleware/user.js';

const router = express.Router();

router.get('/get-batches-on-this-course/:course_id', verifyTokenUser, getBatchesOnThisCourse);
router.post('/course-payment-preview/:id', verifyTokenUser, getCoursePaymentPreview);
router.post('/create-order',verifyTokenUser,  createOrder);
router.post('/verify-payment',verifyTokenUser,  verifyPayment);


// emis
router.post('/create-next-emi-order', verifyTokenUser, createNextEmiOrder);
router.post('/verify-next-emi-payment', verifyTokenUser, verifyNextEmiPayment);

export default router;
