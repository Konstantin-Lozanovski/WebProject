import { body } from "express-validator";
import { TEXT_MAX_LENGTH } from "../models/message.model.js";

// The text of a new message. The limit is the schema's own, so the two
// levels can never disagree about how long a message may be.
export const messageRules = [
  body("text", "Message must be 1 to 500 characters")
    // Without this a number would pass: Mongoose would quietly turn it
    // into text
    .isString()
    .bail()
    // Trimmed before it is measured, so spaces alone are not a message
    .trim()
    .isLength({ min: 1, max: TEXT_MAX_LENGTH }),
];
