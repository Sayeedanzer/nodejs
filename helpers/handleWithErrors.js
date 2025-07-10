import logger from "./logger.js";
export const handleServerError = (res, err, req = null) => {
//   const endpoint = req ? `${req.method} ${req.originalUrl}` : 'Unknown endpoint';
  logger.warn(`${err?.message}`);
  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err?.message,
  });
};

