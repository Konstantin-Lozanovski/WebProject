import { body, query } from "express-validator";
import {
  SPORTS,
  CITIES,
  DURATIONS,
  MIN_PLAYERS,
  MAX_PLAYERS,
  VENUE_MIN_LENGTH,
  VENUE_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  isEvenNumber,
  isStartTimeAllowed,
} from "../models/game.model.js";

// body() checks a field of the request body, query() checks a parameter
// after the ? in the address.
// The second argument of both is the message for every check in that chain.
// bail() stops a chain at the first failed check, so the later checks can
// rely on the earlier ones (for example custom() always gets a real date).

// The filters of the games list. Each one is optional: leaving it out means
// "any".
export const gameSearchRules = [
  query("sport", "Sport must be one of the listed sports")
    .optional()
    .isString()
    .bail()
    .isIn(SPORTS),
  query("city", "City must be one of the listed cities")
    .optional()
    .isString()
    .bail()
    .isIn(CITIES),
  // strictMode refuses anything that is not exactly YYYY-MM-DD, and isDate
  // itself refuses days that do not exist, like 2026-02-30
  query("date", "Date must be a real day written as YYYY-MM-DD")
    .optional()
    .isString()
    .bail()
    .isDate({ format: "YYYY-MM-DD", strictMode: true }),
];

export const gameRules = [
  body("sport", "Sport must be one of the listed sports")
    .isString()
    .bail()
    .isIn(SPORTS),
  body("city", "City must be one of the listed cities")
    .isString()
    .bail()
    .isIn(CITIES),
  body("venue", "Venue must be 3 to 100 characters")
    .isString()
    .bail()
    .trim()
    .isLength({ min: VENUE_MIN_LENGTH, max: VENUE_MAX_LENGTH }),
  // toDate turns the text into a Date, which is what isStartTimeAllowed expects
  body(
    "startTime",
    "Start time must be at least 2 hours and at most 60 days from now",
  )
    .isISO8601()
    .bail()
    .toDate()
    .custom(isStartTimeAllowed),
  body("duration", "Duration must be 60, 90 or 120 minutes")
    .isIn(DURATIONS)
    .bail()
    .toInt(),
  body("maxPlayers", "Max players must be an even number from 2 to 22")
    .isInt({ min: MIN_PLAYERS, max: MAX_PLAYERS })
    .bail()
    .toInt()
    .custom(isEvenNumber),
  // optional() skips the checks when notes is left out
  body("notes", "Notes must be at most 300 characters")
    .optional()
    .isString()
    .bail()
    .trim()
    .isLength({ max: NOTES_MAX_LENGTH }),
];
