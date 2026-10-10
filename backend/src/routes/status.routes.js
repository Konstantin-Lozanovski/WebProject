import express from "express";
import { getStatus } from "../controllers/status.controller.js";

const router = express.Router();

/**
 * @openapi
 * /api/status:
 *   get:
 *     summary: Check that the API is running
 *     description: Open to everyone, no token needed. Also says whether the backend is connected to the database.
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: The API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   example: API is running
 *                 database:
 *                   type: string
 *                   enum: [connected, disconnected]
 */
router.get("/", getStatus);

export default router;
