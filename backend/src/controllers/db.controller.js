import { StatusCodes } from "http-status-codes";
import { clearDatabase, seedDatabase } from "../db/seed.js";

// DELETE /api/db
export const deleteAllData = async (req, res) => {
  await clearDatabase();

  // 204 means "done, and there is nothing to send back"
  res.status(StatusCodes.NO_CONTENT).send();
};

// POST /api/db/seed
export const seedInitialData = async (req, res) => {
  const counts = await seedDatabase();

  res.status(StatusCodes.CREATED).json({ msg: "Initial data seeded", counts });
};
