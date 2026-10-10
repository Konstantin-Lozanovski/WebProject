import express from "express";
import {
  getMyGames,
  getMyJoinRequests,
  getMyMonthCounts,
} from "../controllers/me.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// "me" is the logged-in user, so a guest has nothing to ask for here
router.use(authenticate);

/**
 * @openapi
 * /api/me/games:
 *   get:
 *     summary: List the games the logged-in user is a player in
 *     description: The user's schedule and history. The user comes from the token, so nobody can ask for another user's games. The games the user organizes are in the lists too, because an organizer is a player.
 *     tags: [My games]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Two lists, each empty when the user has no such games
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 currentGames:
 *                   type: array
 *                   description: Upcoming games and games in progress, soonest first
 *                   items:
 *                     $ref: "#/components/schemas/Game"
 *                 finishedGames:
 *                   type: array
 *                   description: Finished games, most recent first
 *                   items:
 *                     $ref: "#/components/schemas/Game"
 *       401:
 *         description: The token is missing, invalid or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get("/games", getMyGames);

/**
 * @openapi
 * /api/me/join-requests:
 *   get:
 *     summary: List the logged-in user's join requests, newest first
 *     description: Join requests in every state. The user comes from the token, so nobody can ask for another user's join requests. Unlike in the other answers, the game is not only an id here, so a list can name the game and link to it.
 *     tags: [My games]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The user's join requests; an empty list when there are none
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 joinRequests:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 66f1c0a4e3b2a1d4c5f6a7bb
 *                       user:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: 66f1c0a4e3b2a1d4c5f6a7b8
 *                           username:
 *                             type: string
 *                             example: marko_7
 *                       game:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: 66f1c0a4e3b2a1d4c5f6a7b9
 *                           sport:
 *                             type: string
 *                             enum: [Football, Basketball, Volleyball, Tennis, Padel]
 *                           city:
 *                             type: string
 *                             example: Skopje
 *                           startTime:
 *                             type: string
 *                             format: date-time
 *                       state:
 *                         type: string
 *                         enum: [pending, accepted, declined]
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: The token is missing, invalid or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get("/join-requests", getMyJoinRequests);

/**
 * @openapi
 * /api/me/month-counts:
 *   get:
 *     summary: Count the logged-in user's finished games per month
 *     description: The last six months, this month included, oldest first. All six are always in the answer, and a month without finished games has a count of 0. A game counts for the month it started in, by the calendar in Macedonia. The user comes from the token, so nobody can ask for another user's counts.
 *     tags: [My games]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: One entry per month
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 monthCounts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: string
 *                         description: The year and the month, written as YYYY-MM
 *                         example: 2026-10
 *                       count:
 *                         type: integer
 *                         example: 3
 *       401:
 *         description: The token is missing, invalid or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get("/month-counts", getMyMonthCounts);

export default router;
