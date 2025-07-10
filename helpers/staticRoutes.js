import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// Root `/` page
router.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>LMS Backend</title>
      <style>
        body {
          background: #0f172a;
          color: #f8fafc;
          font-family: system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          text-align: center;
        }
        h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }
        p {
          font-size: 1.2rem;
          color: #94a3b8;
        }
        @media (max-width: 600px) {
          h1 { font-size: 1.5rem; }
          p { font-size: 1rem; }
        }
      </style>
    </head>
    <body>
      <h1>🚀 Welcome to LMS Node.js applications </h1>
      <p>Server is up & running in <strong>${process.env.NODE_ENV || 'development'}</strong> mode.</p>
    </body>
    </html>
  `);
});

// 404 fallback
router.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>404 - Not Found</title>
      <style>
        body {
          background: #0f172a;
          color: #f8fafc;
          font-family: system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          text-align: center;
        }
        h1 {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }
        p {
          font-size: 1.2rem;
          color: #94a3b8;
        }
        a {
          color: #38bdf8;
          text-decoration: none;
          font-weight: bold;
        }
        a:hover {
          text-decoration: underline;
        }
        @media (max-width: 600px) {
          h1 { font-size: 2rem; }
          p { font-size: 1rem; }
        }
      </style>
    </head>
    <body>
      <h1>🚫 404 - Not Found</h1>
      <p>Oops! The page you're looking for does not exist.</p>
      <p><a href="/">Return Home</a></p>
    </body>
    </html>
  `);
});

export default router;
