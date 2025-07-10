import db from "../config/db.js";
import { getBaseUrl } from "../config/getBaseUrl.js";
import { getISTDateTime } from "../helpers/dateTimeFormat.js";
import { handleServerError } from "../helpers/handleWithErrors.js";
import { deleteUploadedFile } from "../helpers/uploadingFolders.js";
import { getLatestServices, getServiceById, insertService, removeServiceById } from "../models/servicesModel.js";

export const fetchLatestServices = async (req, res) => {
  try {
    const services = await getLatestServices();

    return res.status(200).json({
      success: true,
      message: "Latest services fetched successfully",
      data: services
    });
  } catch (error) {
    return handleServerError(res, error);
  }
};


export const fetchServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await getServiceById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service details fetched successfully",
      data: service
    });
  } catch (error) {
    return handleServerError(res, error);
  }
};


export const addNewService = async (req, res) => {
  try {
    const { title, service_description, our_offering } = req.body;

    if (!title || !service_description || !our_offering) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and offerings are required"
      });
    }


    const folder = 'services';
    let image = null;

    const uploadedImage = req.file;
    // console.log(uploadedImage);

    if (!uploadedImage) {
      return res.status(400).json({
        success: false,
        message: "Image is required. Please upload a file with field name 'image'."
      });
    }
    if (uploadedImage) {
      const baseUrl = getBaseUrl(req);
      image = `${baseUrl}/uploads/${folder}/${uploadedImage.filename}`;
    }

    const row = await insertService(title, service_description, our_offering, image);
    return res.status(201).json({
      success: true,
      message: "New service added successfully",
      serviceId: row?.insertId
    });
  } catch (error) {
    return handleServerError(res, error);
  }
};


export const deleteServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "Service ID is required" });
    }

    const result = await removeServiceById(id);

    if (!result || result.affectedRows === 0) {
    return res.status(404).json({
        success: false,
        error: "Service not found or already deleted",
    });
    }

    return res.status(200).json({ 
        success: true, 
        message: "Service deleted successfully" 
    });
  } catch (error) {
    return handleServerError(res, error);
  }
};


export const updateServiceById = async (req, res) => {
  try {
    const serviceId = req.params.id;

    let {
      title,
      service_description,
      our_offering,
      image
    } = req.body;

    const uploadedImage = req.file;
    if (uploadedImage) {
      const folder = 'services';
      const baseUrl = getBaseUrl(req);
      image = `${baseUrl}/uploads/${folder}/${uploadedImage.filename}`;
    }

    const now = getISTDateTime();

    // ✅ Check if service exists
    const [existing] = await db.query(
      `SELECT id FROM our_services WHERE id = ? LIMIT 1`,
      [serviceId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    // ✅ Update the service
    await db.query(
      `UPDATE our_services SET 
        title = ?, 
        service_description = ?, 
        our_offering = ?, 
        image = ?, 
        updated_at = ?
       WHERE id = ?`,
      [
        title,
        service_description,
        JSON.stringify(our_offering),
        image,
        now,
        serviceId
      ]
    );
    console.log("Uploaded file:", req.file);
    const oldImageUrl = existing[0].image;
    // if (uploadedImage && oldImageUrl) {
    //   deleteUploadedFile(oldImageUrl, folder);
    // }


    return res.status(200).json({
      success: true,
      message: "Service details updated successfully"
    });

  } catch (err) {
    return handleServerError(res, err);
  }
};
