// controllers/courseBundleController.js
import { handleServerError } from '../helpers/handleWithErrors.js';
import { getTopBundlesByStudents } from '../models/courseBundleModel.js';

export const fetchTopBundles = async (req, res) => {
  try {
    const bundles = await getTopBundlesByStudents();
    return res.status(200).json({
      success: true,
      bundles: bundles
    });
  } catch (err) {
    return handleServerError(res, err)
  }
};
