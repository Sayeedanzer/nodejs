import db from "../config/db.js";
import { getISTDateTime } from "../helpers/dateTimeFormat.js";

export const getLatestServices = async (limit = 5, descLength = 100) => {
  const safeLimit = parseInt(limit, 10);
  const [rows] = await db.execute(`
    SELECT id, image, title, service_description
    FROM our_services
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `);

  return rows.map(service => ({
    id: service?.id,
    image: service.image,
    title: service.title,
    service_description:
      service.service_description.length > descLength
        ? service.service_description.slice(0, descLength - 3) + '...'
        : service.service_description
  }));
};



export const getServiceById = async (id) => {
  const [rows] = await db.execute(`
    SELECT id, title, service_description, our_offering, image, created_at
    FROM our_services
    WHERE id = ?
  `, [id]);

  if (rows.length === 0) return null;

  const service = rows[0];
  return {
    ...service,
    our_offering: JSON.parse(service.our_offering)
  };
};


export const insertService = async (title, service_description, our_offering, image) => {
  const nowIstTimeDate = getISTDateTime();
  const [result] = await db.execute(
    `INSERT INTO our_services (title, service_description, our_offering, image, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title, service_description, JSON.stringify(our_offering), image, nowIstTimeDate, nowIstTimeDate]
  );

  return result;
};

export const removeServiceById = async (id) => {
  const [result] = await db.execute(`DELETE FROM our_services WHERE id = ?`, [id]);
  return result;
};
