import express from "express";
import {
  register,
  login,
  getCurrentUser,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { registerRules, loginRules } from "../middleware/auth.validation.js";
import validate from "../middleware/validate.js";

const router = express.Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user and log them in
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:
 *                 type: string
 *                 description: 3 to 20 letters, digits or underscores
 *                 example: marko_7
 *               email:
 *                 type: string
 *                 example: marko@example.com
 *               password:
 *                 type: string
 *                 description: At least 8 characters, with at least one letter and one digit
 *                 example: football1
 *     responses:
 *       201:
 *         description: The user was created; the token logs them in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/AuthResponse"
 *       400:
 *         description: A field breaks the rules; fields holds one message per field
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: The username or the email is already taken; the message says which
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post("/register", registerRules, validate, register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: marko@example.com
 *               password:
 *                 type: string
 *                 example: football1
 *     responses:
 *       200:
 *         description: Logged in; the token lasts 7 days
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/AuthResponse"
 *       400:
 *         description: The email or the password is missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       401:
 *         description: Wrong email or password (one message for both)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post("/login", loginRules, validate, login);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get the user the token belongs to
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: "#/components/schemas/User"
 *       401:
 *         description: The token is missing, invalid or expired, or the user was deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get("/me", authenticate, getCurrentUser);

export default router;
