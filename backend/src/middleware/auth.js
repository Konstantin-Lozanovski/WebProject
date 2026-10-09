import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { UnauthenticatedError, ForbiddenError } from "../errors/index.js";
import User from "../models/user.model.js";

const SESSION_ENDED_MESSAGE = "Your session has ended, please log in again";

// Put in front of every route that needs a logged-in user.
// It leaves the user document in req.user for the controller.
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    throw new UnauthenticatedError("Please log in");

  const token = authHeader.split(" ")[1];

  let payload;
  try {
    // verify throws when the token is changed, made up or expired
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new UnauthenticatedError(SESSION_ENDED_MESSAGE);
  }

  // The user is read from the database every time, and the role in the
  // token is not trusted, so a deleted or demoted user loses access at once
  const user = await User.findById(payload.id);
  if (!user)
    throw new UnauthenticatedError(SESSION_ENDED_MESSAGE);

  req.user = user;
  next();
};

// Goes after authenticate, for example: requireRole("admin").
// It returns the middleware, so the same function works for any role.
// An admin passes every role check, because an admin can do everything
// a user can.
export const requireRole = (role) => {
  return (req, res, next) => {
    const hasRole = req.user.role === role;
    const isAdmin = req.user.role === "admin";

    if (!hasRole && !isAdmin)
      throw new ForbiddenError("You are not allowed to do this");

    next();
  };
};
