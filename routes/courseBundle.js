// routes/courseBundleRoutes.js
import express from 'express';
import { fetchTopBundles } from '../controllers/courseBundleController.js';

const router = express.Router();

router.get('/top-3', fetchTopBundles);

export default router;
