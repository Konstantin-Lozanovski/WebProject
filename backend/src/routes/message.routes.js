import express from "express";
import {
  getMessages,
  createMessage,
  deleteMessage,
} from "../controllers/message.controller.js";
import { authenticate } from "../middleware/auth.js";
import { messageRules } from "../middleware/message.validation.js";
import validate from "../middleware/validate.js";

// app.js mounts this router on /api/games/:gameId/messages.
// mergeParams lets the routes here read that :gameId; without it a router
// only sees the parameters of its own paths.
const router = express.Router({ mergeParams: true });

/**
 * @openapi
 * /api/games/{gameId}/messages:
 *   get:
 *     summary: Read a game's chat
 *     description: Every message of the game's chat, oldest first. For the game's players, and for admins. The chat is open at any status, including after the game has finished. The game page asks for this every 5 seconds. A message whose user was deleted has null as its user.
 *     tags: [Messages]
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
 *         description: The messages, oldest first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Message"
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
 *         description: The user is neither a player in the game nor an admin
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
router.get("/", authenticate, getMessages);

/**
 * @openapi
 * /api/games/{gameId}/messages:
 *   post:
 *     summary: Post a message in a game's chat
 *     description: Only for the game's players, at any status. An admin who is not a player in the game cannot post. The user comes from the token. The spaces around the text are removed.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
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
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 example: Pitch is booked from 18:00.
 *     responses:
 *       201:
 *         description: The message was posted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   $ref: "#/components/schemas/Message"
 *       400:
 *         description: The text is not plain text of 1 to 500 characters, or the id is not a valid id
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
 *         description: The user is not a player in the game (an admin too)
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
router.post("/", authenticate, messageRules, validate, createMessage);

/**
 * @openapi
 * /api/games/{gameId}/messages/{messageId}:
 *   delete:
 *     summary: Delete a message
 *     description: A player deletes a message they posted themselves; an admin deletes any message. A user who left or was removed can no longer delete the messages they posted. Messages cannot be edited.
 *     tags: [Messages]
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
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the message
 *     responses:
 *       204:
 *         description: The message was deleted; there is no body
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
 *         description: The message is someone else's, or the user is no longer a player in the game (not for an admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       404:
 *         description: There is no game with this id, or the game has no message with this id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.delete("/:messageId", authenticate, deleteMessage);

export default router;
