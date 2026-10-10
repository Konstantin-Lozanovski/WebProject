import express from "express";
import {
  getUsers,
  updateUserRole,
  deleteUser,
} from "../controllers/user.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { roleRules } from "../middleware/user.validation.js";
import validate from "../middleware/validate.js";

const router = express.Router();

// Managing users is for admins only: a guest gets 401 from authenticate,
// and a logged-in user who is not an admin gets 403 from requireRole
router.use(authenticate, requireRole("admin"));

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: List all users, oldest first
 *     description: For admins only. The password is never in the answer.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Every user of the app
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/User"
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
router.get("/", getUsers);

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     summary: Change a user's role
 *     description: For admins only. Promotes a user to admin or demotes an admin to user. The change takes effect on that user's next request, because the role is read from the database every time and not from the token. An admin cannot change their own role, so the app always has an admin.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *     responses:
 *       200:
 *         description: The user with their new role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: "#/components/schemas/User"
 *       400:
 *         description: The role is not user or admin, or the id is not a valid id
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
 *         description: The user is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       404:
 *         description: There is no user with this id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: The admin tried to change their own role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.put("/:id", roleRules, validate, updateUserRole);

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: For admins only. The user's token stops working at once. Deleted with the user are the upcoming games they organize (each with its join requests, players and messages), all their join requests, and their players in upcoming games, which frees those places. Kept are their games that are in progress or finished, their players in those games and their messages; in the answers of the other routes the user of such a document is null, and the app shows "deleted user". An admin cannot delete themselves, so the app always has an admin.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the user
 *     responses:
 *       204:
 *         description: The user was deleted; there is no body
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
 *         description: The user is not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       404:
 *         description: There is no user with this id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: The admin tried to delete themselves
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.delete("/:id", deleteUser);

export default router;
