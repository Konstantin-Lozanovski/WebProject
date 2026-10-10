import { body } from "express-validator";
import { TEAMS } from "../models/player.model.js";

// The team a player is moved to. The set is the schema's own, so the two
// levels can never disagree about what a team is.
export const teamRules = [
  body("team", "Team must be A, B or unassigned")
    .isString()
    .bail()
    .isIn(TEAMS),
];
