import { StatusCodes } from "http-status-codes";
import { UnauthenticatedError } from "../errors/index.js";
import User from "../models/user.model.js";

// The user as the client is allowed to see it: everything but the password
const toPublicUser = (user) => {
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
};

// POST /api/auth/register
export const register = async (req, res) => {
  const { username, email, password } = req.body;

  // The role is left out on purpose, so nobody can register as an admin
  const user = new User({ username, email, password });
  await user.save();

  const token = user.createJWT();

  res.status(StatusCodes.CREATED).json({ user: toPublicUser(user), token });
};

// POST /api/auth/login
export const login = async (req, res) => {
  const { email, password } = req.body;

  // The same message for both cases, so the answer does not reveal
  // whether an email is registered
  const user = await User.findOne({ email });
  if (!user) throw new UnauthenticatedError("Invalid email or password");

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect)
    throw new UnauthenticatedError("Invalid email or password");

  const token = user.createJWT();

  res.status(StatusCodes.OK).json({ user: toPublicUser(user), token });
};

// GET /api/auth/me
export const getCurrentUser = async (req, res) => {
  res.status(StatusCodes.OK).json({ user: toPublicUser(req.user) });
};
