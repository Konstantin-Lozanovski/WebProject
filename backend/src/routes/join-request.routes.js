import express from "express";
import {
  getPendingJoinRequests,
  getMyJoinRequest,
  sendJoinRequest,
  answerJoinRequest,
  withdrawJoinRequest,
} from "../controllers/join-request.controller.js";
import { authenticate } from "../middleware/auth.js";
import { answerRules } from "../middleware/join-request.validation.js";
import validate from "../middleware/validate.js";

// app.js mounts this router on /api/games/:gameId/join-requests.
// mergeParams lets the routes here read that :gameId; without it a router
// only sees the parameters of its own paths.
const router = express.Router({ mergeParams: true });

// A guest has no join requests and can do nothing with them, so every
// route needs a logged-in user
router.use(authenticate);

/**
 * @openapi
 * /api/games/{gameId}/join-requests:
 *   get:
 *     summary: List a game's pending join requests, oldest first
 *     description: Only for the game's organizer and for admins. Accepted and declined join requests are not in the list.
 *     tags: [Join requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the game
 *     responses:
 *       200:
 *         description: The pending join requests; an empty list when there are none
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 joinRequests:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/JoinRequest"
 *       400:
 *         description: The id is not a valid id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       401:
 *         description: The token is missing, invalid or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: The user is neither the game's organizer nor an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       404:
 *         description: There is no game with this id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get("/", getPendingJoinRequests);

/**
 * @openapi
 * /api/games/{gameId}/join-requests/mine:
 *   get:
 *     summary: Get the logged-in user's own join request for a game
 *     description: Shows the user whether their join request is pending, accepted or declined.
 *     tags: [Join requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the game
 *     responses:
 *       200:
 *         description: The user's join request, or null when they have none for this game
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 joinRequest:
 *                   nullable: true
 *                   allOf:
 *                     - $ref: "#/components/schemas/JoinRequest"
 *       400:
 *         description: The id is not a valid id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       401:
 *         description: The token is missing, invalid or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       404:
 *         description: There is no game with this id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get("/mine", getMyJoinRequest);

/**
 * @openapi
 * /api/games/{gameId}/join-requests:
 *   post:
 *     summary: Send a join request to a game
 *     description: The logged-in user asks to become a player. The join request starts as pending and holds no place in the game. There is no body, because the user comes from the token and the game from the address. Allowed until the game starts; an admin is not held to that.
 *     tags: [Join requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the game
 *     responses:
 *       201:
 *         description: The join request was created as pending
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 joinRequest:
 *                   $ref: "#/components/schemas/JoinRequest"
 *       400:
 *         description: The id is not a valid id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       401:
 *         description: The token is missing, invalid or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       404:
 *         description: There is no game with this id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: The game is full, it overlaps another game the user is a player in, the user is already a player in it, the user already has a join request for it (pending or declined), or the game has already started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post("/", sendJoinRequest);

/**
 * @openapi
 * /api/games/{gameId}/join-requests/{requestId}:
 *   put:
 *     summary: Accept or decline a join request
 *     description: For the game's organizer until the game starts, and for an admin at any time. Accepting makes the user an unassigned player; the full and overlap rules are checked again first. Declining is final.
 *     tags: [Join requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the game
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the join request
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [state]
 *             properties:
 *               state:
 *                 type: string
 *                 enum: [accepted, declined]
 *     responses:
 *       200:
 *         description: The join request with its new state
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 joinRequest:
 *                   $ref: "#/components/schemas/JoinRequest"
 *       400:
 *         description: The state is not accepted or declined, or an id is not a valid id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       401:
 *         description: The token is missing, invalid or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: The user is neither the game's organizer nor an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       404:
 *         description: There is no game with this id, or the game has no join request with this id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: The join request was already answered, the game has already started (organizer only), or on accept the game is full or overlaps another game the user is a player in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.put("/:requestId", answerRules, validate, answerJoinRequest);

/**
 * @openapi
 * /api/games/{gameId}/join-requests/{requestId}:
 *   delete:
 *     summary: Withdraw a pending join request
 *     description: For the user who sent it until one hour before the game starts, and for an admin at any time. The join request is deleted, so the user can send a new one.
 *     tags: [Join requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the game
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the join request
 *     responses:
 *       204:
 *         description: The join request was deleted; there is no body
 *       400:
 *         description: An id is not a valid id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       401:
 *         description: The token is missing, invalid or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       403:
 *         description: The join request belongs to another user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       404:
 *         description: There is no game with this id, or the game has no join request with this id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: The join request is no longer pending, or the game starts in less than one hour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.delete("/:requestId", withdrawJoinRequest);

export default router;
