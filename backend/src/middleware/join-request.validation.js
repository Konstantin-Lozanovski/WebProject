import { body } from "express-validator";
import { ANSWERS } from "../models/join-request.model.js";

// The answer to a join request. "pending" is a state too, but not an
// answer: a request cannot be put back to pending.
export const answerRules = [
  body("state", "State must be accepted or declined")
    .isString()
    .bail()
    .isIn(ANSWERS),
];
