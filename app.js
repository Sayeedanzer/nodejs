import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import './helpers/dateTimeFormat.js';

import userRoutes from './routes/userRoutes.js';
import CourseRoutes from './routes/CourseRoutes.js';
import contactRoutes from './routes/ContactRoutes.js'
import adminRoutes from './routes/adminRoutes.js';
import blogsRoutes from './routes/blogsRoutes.js';
import commentsRoutes from './routes/commentsRoutes.js';
import coursesBundles from './routes/courseBundle.js';
import payments from './routes/paymentRoutes.js';
import email from './routes/emailRoutes.js';
import services from './routes/servicesRoutes.js';
import courseBatches from './routes/courseBatches.js';
import instructorRoutes from './routes/instructorRoutes.js';

import logApiCalls from './middleware/logApiCalls.js';
import logger from './helpers/logger.js';

import { ensureUploadFolders } from './helpers/uploadingFolders.js';
import helmet from 'helmet';
import staticRoutes from './helpers/staticRoutes.js';
import { allowedOrigins } from './config/allowedOrigins.js';


//cronjobs
import { nextEmiDueReminderToStudents } from './helpers/cronJob.js';


dotenv.config();
const app = express();
app.use(helmet());


app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('CORS policy: This origin is not allowed.'), false);
    }
  },
  credentials: true
}));



const limiter = rateLimit({
  windowMs: 30 * 1000,  // 30 seconds
  max: 1000,             
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({     
      status: 429,
      error: 'Too many requests. Please wait and try again.'
    });
  }
});

ensureUploadFolders()
app.use(limiter);
app.use(express.json());
app.use(logApiCalls);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use('/api/user', userRoutes);
app.use('/api/courses', CourseRoutes);
app.use('/api/contact', contactRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/blogs", blogsRoutes);
app.use("/api/comments", commentsRoutes);
app.use("/api/coursesBundles", coursesBundles);
app.use("/api/payments", payments);
app.use("/api/email", email);
app.use("/api/services", services);
app.use('/api/batches', courseBatches);
app.use('/api/instructor', instructorRoutes);


nextEmiDueReminderToStudents();


app.use('/', staticRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0",  () => logger.info(`Server running on port ${PORT}`))