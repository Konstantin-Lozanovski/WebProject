import { body } from "express-validator";
import {
  USERNAME_REGEX,
  EMAIL_REGEX,
  PASSWORD_MIN_LENGTH,
  LETTER_REGEX,
  DIGIT_REGEX,
} from "../models/user.model.js";

// The second argument of body() is the message for every check in that chain.
// isString comes first and bail() stops the chain there, so a value that is
// missing or is an object never reaches the other checks or the database.

export const registerRules = [
  body("username", "Username must be 3 to 20 letters, digits or underscores")
    .isString()
    .bail()
    .trim()
    .matches(USERNAME_REGEX),
  body("email", "Please provide a valid email address")
    .isString()
    .bail()
    .trim()
    .toLowerCase()
    .matches(EMAIL_REGEX),
  // The password is not trimmed: spaces are allowed to be part of it
  body(
    "password",
    "Password must be at least 8 characters, with at least one letter and one digit",
  )
    .isString()
    .bail()
    .isLength({ min: PASSWORD_MIN_LENGTH })
    .matches(LETTER_REGEX)
    .matches(DIGIT_REGEX),
];

// Login only checks that both values are there. Telling a user their
// password is "too short" on login would give away the rules for no reason.
export const loginRules = [
  body("email", "Please provide your email")
    .isString()
    .bail()
    .trim()
    .toLowerCase()
    .notEmpty(),
  body("password", "Please provide your password")
    .isString()
    .bail()
    .notEmpty(),
];
