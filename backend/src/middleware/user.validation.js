import { body } from "express-validator";
import { ROLES } from "../models/user.model.js";

// The role a user is changed to. The set is the schema's own, so the two
// levels can never disagree about what a role is.
export const roleRules = [
  body("role", "Role must be user or admin")
    .isString()
    .bail()
    .isIn(ROLES),
];
