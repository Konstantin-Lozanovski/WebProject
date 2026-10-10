import express from "express";
import {
  getUpcomingGames,
  getGame,
  createGame,
  updateGame,
  deleteGame,
} from "../controllers/game.controller.js";
import { authenticate } from "../middleware/auth.js";
import {
  gameRules,
  gameEditRules,
  gameSearchRules,
} from "../middleware/game.validation.js";
import validate from "../middleware/validate.js";

const router = express.Router();

/**
 * @openapi
 * /api/games:
 *   get:
 *     summary: List the upcoming games, soonest first
 *     description: Open to everyone, no token needed. Games in progress and finished games are not in the list. The three filters are optional and combine, so a game must match every filter that is given.
 *     tags: [Games]
 *     parameters:
 *       - in: query
 *         name: sport
 *         schema:
 *           type: string
 *           enum: [Football, Basketball, Volleyball, Tennis, Padel]
 *         description: Only games of this sport
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *           enum: [Skopje, Bitola, Kumanovo, Prilep, Tetovo, Ohrid, Veles, Štip]
 *         description: Only games in this city
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Only games starting on this calendar day in Macedonia, written as YYYY-MM-DD
 *         example: 2026-10-12
 *     responses:
 *       200:
 *         description: The matching upcoming games; an empty list when there are none
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 games:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Game"
 *       400:
 *         description: A filter is not a listed sport, a listed city or a real day; fields holds one message per filter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get("/", gameSearchRules, validate, getUpcomingGames);

/**
 * @openapi
 * /api/games/{id}:
 *   get:
 *     summary: Get one game with its players
 *     description: Open to everyone, no token needed.
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the game
 *     responses:
 *       200:
 *         description: The game and its players, the organizer first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 game:
 *                   $ref: "#/components/schemas/Game"
 *                 players:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Player"
 *       400:
 *         description: The id is not a valid id
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
router.get("/:id", getGame);

/**
 * @openapi
 * /api/games:
 *   post:
 *     summary: Create a game
 *     description: The logged-in user becomes the game's organizer and its first player, unassigned.
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sport, city, venue, startTime, duration, maxPlayers]
 *             properties:
 *               sport:
 *                 type: string
 *                 enum: [Football, Basketball, Volleyball, Tennis, Padel]
 *               city:
 *                 type: string
 *                 enum: [Skopje, Bitola, Kumanovo, Prilep, Tetovo, Ohrid, Veles, Štip]
 *               venue:
 *                 type: string
 *                 description: 3 to 100 characters
 *                 example: Sports Center Boris Trajkovski, pitch 2
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: At least 2 hours and at most 60 days from now
 *               duration:
 *                 type: integer
 *                 enum: [60, 90, 120]
 *                 description: In minutes
 *               maxPlayers:
 *                 type: integer
 *                 description: An even number from 2 to 22; the organizer counts as one
 *                 example: 10
 *               notes:
 *                 type: string
 *                 description: Optional, up to 300 characters
 *                 example: Bring a white and a dark shirt.
 *     responses:
 *       201:
 *         description: The game was created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 game:
 *                   $ref: "#/components/schemas/Game"
 *       400:
 *         description: A field breaks the rules; fields holds one message per field
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
 *       409:
 *         description: The game overlaps another game the user is a player in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post("/", authenticate, gameRules, validate, createGame);

/**
 * @openapi
 * /api/games/{id}:
 *   put:
 *     summary: Edit a game
 *     description: For the game's organizer until the game starts, and for an admin at any time. Every field is sent again, changed or not. The organizer of the game never changes.
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the game
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sport, city, venue, startTime, duration, maxPlayers]
 *             properties:
 *               sport:
 *                 type: string
 *                 enum: [Football, Basketball, Volleyball, Tennis, Padel]
 *               city:
 *                 type: string
 *                 enum: [Skopje, Bitola, Kumanovo, Prilep, Tetovo, Ohrid, Veles, Štip]
 *               venue:
 *                 type: string
 *                 description: 3 to 100 characters
 *                 example: Sports Center Boris Trajkovski, pitch 2
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: When it is changed, at least 2 hours and at most 60 days from now. A start time sent back as it was is always accepted.
 *               duration:
 *                 type: integer
 *                 enum: [60, 90, 120]
 *                 description: In minutes
 *               maxPlayers:
 *                 type: integer
 *                 description: An even number from 2 to 22, and not below the number of players the game already has
 *                 example: 10
 *               notes:
 *                 type: string
 *                 description: Optional, up to 300 characters
 *                 example: Bring a white and a dark shirt.
 *     responses:
 *       200:
 *         description: The game after the edit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 game:
 *                   $ref: "#/components/schemas/Game"
 *       400:
 *         description: A field breaks the rules, or the id is not a valid id; fields holds one message per field
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
 *       409:
 *         description: The game has already started (organizer only), the max is below the number of players, or the new time overlaps another game of one of the players
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.put("/:id", authenticate, gameEditRules, validate, updateGame);

/**
 * @openapi
 * /api/games/{id}:
 *   delete:
 *     summary: Cancel (delete) a game
 *     description: For the game's organizer until the game starts, and for an admin at any time. The game is deleted together with its join requests, players and messages.
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the game
 *     responses:
 *       204:
 *         description: The game was deleted; there is no body
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
 *       409:
 *         description: The game has already started, so its organizer can no longer cancel it
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.delete("/:id", authenticate, deleteGame);

export default router;
