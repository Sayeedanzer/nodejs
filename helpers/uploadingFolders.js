// helpers/uploadingFolders.js
import fs from 'fs';
import path from 'path';

export const uploadFolders = ['users', 'instructors', 'courses', 'blogs', 'services', 'admin', 'carousel'];

export const ensureUploadFolders = () => {
  uploadFolders.forEach(folder => {
    const dir = path.resolve(`public/uploads/${folder}`);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      } 
      // else {
      //   console.log(`✅ Exists: ${dir}`);
      // }
    } catch (err) {
      // console.error(`Failed to create folder "${folder}":`, err.message);
    }
  });

  // console.log('Upload folders check completed.');
};

/**
 * Deletes an uploaded file from the given folder (based on image URL)
 * @param {string} imageUrl - Full URL of the image
 * @param {string} folder - Subfolder under /public/uploads (e.g., 'services')
 */
export const deleteUploadedFile = (imageUrl, folder) => {
  if (!imageUrl || !folder) return;

  try {
    const filename = path.basename(imageUrl); // get file name from URL
    const filePath = path.resolve(`public/uploads/${folder}/${filename}`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted file: ${filePath}`);
    } else {
      console.warn(`File not found for deletion: ${filePath}`);
    }
  } catch (err) {
    console.error(`Failed to delete image in folder "${folder}":`, err.message);
  }
};
