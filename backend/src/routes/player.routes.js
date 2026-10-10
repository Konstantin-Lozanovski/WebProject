import express from "express";
import {
  deletePlayer,
  updatePlayerTeam,
} from "../controllers/player.controller.js";
import { authenticate } from "../middleware/auth.js";
import { teamRules } from "../middleware/player.validation.js";
import validate from "../middleware/validate.js";

// app.js mounts this router on /api/games/:gameId/players.
// mergeParams lets the routes here read that :gameId; without it a router
// only sees the parameters of its own paths.
const router = express.Router({ mergeParams: true });

/**
 * @openapi
 * /api/games/{gameId}/players/{playerId}:
 *   delete:
 *     summary: Leave a game, or remove a player from it
 *     description: A player other than the organizer deletes their own place to leave the game; the game's organizer deletes another player's place to remove them. Both are allowed until one hour before the game starts. An admin can remove any player at any time. The user's join request is deleted with the player, so they can send a new one. The organizer can never leave or be removed; the game is cancelled instead.
 *     tags: [Players]
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
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the player (not of the user)
 *     responses:
 *       204:
 *         description: The player and their join request were deleted; there is no body
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
 *         description: The player is someone else, and the user is neither the game's organizer nor an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       404:
 *         description: There is no game with this id, or the game has no player with this id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: The player is the game's organizer, or the game starts in less than one hour or has already started (not for an admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.delete("/:playerId", authenticate, deletePlayer);

/**
 * @openapi
 * /api/games/{gameId}/players/{playerId}:
 *   put:
 *     summary: Move a player to Team A, to Team B, or back to unassigned
 *     description: For the game's organizer until the game starts, and for an admin at any time. Only the team is stored, not a position inside it. Each team holds at most half the game's max number of players; unassigned has no limit.
 *     tags: [Players]
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
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the player (not of the user)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team]
 *             properties:
 *               team:
 *                 type: string
 *                 enum: [A, B, unassigned]
 *     responses:
 *       200:
 *         description: The player with their new team
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 player:
 *                   $ref: "#/components/schemas/Player"
 *       400:
 *         description: The team is not A, B or unassigned, or an id is not a valid id
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
 *         description: There is no game with this id, or the game has no player with this id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: The team is full, or the game has already started (organizer only)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.put("/:playerId", authenticate, teamRules, validate, updatePlayerTeam);

export default router;
