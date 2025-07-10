import logger from '../helpers/logger.js';

const logApiCalls = (req, res, next) => {
  if (req.originalUrl.startsWith('/uploads')) {
    return next();
  }
  logger.info(`API Called: ${req?.method} ${req?.originalUrl}`);
  next();
};


export default logApiCalls;