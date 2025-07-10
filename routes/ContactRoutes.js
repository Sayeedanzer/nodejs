import express from 'express';
import { getAllContactMessages, submitContactForm } from '../controllers/contactController.js';

const router = express.Router();

router.post('/', submitContactForm);
router.get('/details', getAllContactMessages);
export default router;
