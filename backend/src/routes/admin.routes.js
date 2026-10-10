import express from "express";
import { getTotals, getAllGames } from "../controllers/admin.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = express.Router();

// The Admin overview is for admins only: a guest gets 401 from authenticate,
// and a logged-in user who is not an admin gets 403 from requireRole
router.use(authenticate, requireRole("admin"));

/**
 * @openapi
 * /api/admin/totals:
 *   get:
 *     summary: Count the users, the games by status and the join requests by state
 *     description: For admins only. The numbers at the top of the Admin overview. They are counted from the collections on every request, so there is no activity log behind them. Every status and every state is always in the answer, with 0 when it has none.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The totals of the whole app
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totals:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: integer
 *                       example: 10
 *                     games:
 *                       type: object
 *                       properties:
 *                         upcoming:
 *                           type: integer
 *                           example: 5
 *                         in progress:
 *                           type: integer
 *                           example: 1
 *                         finished:
 *                           type: integer
 *                           example: 3
 *                     joinRequests:
 *                       type: object
 *                       properties:
 *                         pending:
 *                           type: integer
 *                           example: 4
 *                         accepted:
 *                           type: integer
 *                           example: 44
 *                         declined:
 *                           type: integer
 *                           example: 2
 *       401:
 *         description: The token is missing, invalid or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: The user is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get("/totals", getTotals);

/**
 * @openapi
 * /api/admin/games:
 *   get:
 *     summary: List all games, at every status
 *     description: For admins only. Unlike the list of upcoming games, nothing is left out and there are no filters. The games in progress come first, then the upcoming games soonest first, then the finished games most recent first.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Every game of the app; an empty list when there are none
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 games:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Game"
 *       401:
 *         description: The token is missing, invalid or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: The user is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get("/games", getAllGames);

export default router;
