import express from "express";
import {
  deleteAllData,
  seedInitialData,
} from "../controllers/db.controller.js";

const router = express.Router();

// These routes have no authenticate in front of them on purpose: after
// "delete all" there is no admin left who could log in to seed the data

/**
 * @openapi
 * /api/db:
 *   delete:
 *     summary: Delete all data from every collection
 *     description: Open to everyone, no token needed.
 *     tags: [Database]
 *     responses:
 *       204:
 *         description: Every collection is now empty
 *       500:
 *         description: The database could not be emptied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.delete("/", deleteAllData);

/**
 * @openapi
 * /api/db/seed:
 *   post:
 *     summary: Delete all data, then insert the initial demo data
 *     description: >
 *       Open to everyone, no token needed. The database is cleared first,
 *       so calling this twice gives the same data, not two copies.
 *     tags: [Database]
 *     responses:
 *       201:
 *         description: The demo data was created; counts says how many documents each collection got
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   example: Initial data seeded
 *                 counts:
 *                   type: object
 *                   example: { users: 7 }
 *       500:
 *         description: The demo data could not be created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post("/seed", seedInitialData);

export default router;
