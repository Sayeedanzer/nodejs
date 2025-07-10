// middlewares/upload.js
import multer from 'multer';
import path from 'path';

export const getUploader = (folder) => {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.resolve(`public/uploads/${folder}`);
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname); // safer than .split
        const unique = `${folder}_${Date.now()}${ext}`;
        cb(null, unique);
      },
    }),
    limits: {
      fileSize: 10 * 1024 * 1024, 
    },
  });
};
