import express from "express";
import { fetchLatestServices, fetchServiceById } from "../controllers/servicesController.js";


const router = express.Router()

router.get('/latest-services-home-page', fetchLatestServices);
router.get('/get-single-service-details/:id', fetchServiceById);

// admin 




export default router;