import { StatusCodes } from "http-status-codes";
import { NotFoundError, ConflictError } from "../errors/index.js";
import User from "../models/user.model.js";
import Game, { deleteGameWithItsDocuments } from "../models/game.model.js";
import Player from "../models/player.model.js";
import JoinRequest from "../models/join-request.model.js";
import { toPublicUser } from "./auth.controller.js";

// Every route here is for admins only; the router checks that before any
// of these functions runs

const findUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("User not found");
  return user;
};

// GET /api/users
export const getUsers = async (req, res) => {
  // Oldest first, so the list keeps its order when a role is changed
  const users = await User.find().sort("createdAt");

  res.status(StatusCodes.OK).json({ users: users.map(toPublicUser) });
};

// PUT /api/users/:id
// The body holds the user's new role: { role: "admin" } or { role: "user" }
export const updateUserRole = async (req, res) => {
  const user = await findUser(req.params.id);

  // An admin who could demote themselves could leave the app without an
  // admin. equals compares two ids by value; === would compare the objects.
  if (user._id.equals(req.user._id))
    throw new ConflictError("You cannot change your own role");

  user.role = req.body.role;
  await user.save();

  res.status(StatusCodes.OK).json({ user: toPublicUser(user) });
};

// A game cannot go on without its organizer, so the upcoming games of the
// user are cancelled. The ones that already started stay as history.
const deleteUpcomingGamesOrganizedBy = async (user) => {
  // Upcoming means "has not started yet", the same rule getStatus uses
  const games = await Game.find({
    organizer: user._id,
    startTime: { $gt: new Date() },
  });

  for (const game of games) {
    await deleteGameWithItsDocuments(game);
  }
};

// Frees the places the user holds in upcoming games. Their players in games
// that already started stay, so those games keep their teams as they were.
const deleteUpcomingPlayersOf = async (user) => {
  const players = await Player.find({ user: user._id });
  const gameIds = players.map((player) => player.game);

  const upcomingGames = await Game.find({
    _id: { $in: gameIds },
    startTime: { $gt: new Date() },
  });
  const upcomingGameIds = upcomingGames.map((game) => game._id);

  await Player.deleteMany({ user: user._id, game: { $in: upcomingGameIds } });
};

// DELETE /api/users/:id
export const deleteUser = async (req, res) => {
  const user = await findUser(req.params.id);

  // An admin who could delete themselves could leave the app without an admin
  if (user._id.equals(req.user._id))
    throw new ConflictError("You cannot delete your own account");

  // The steps are not one transaction, so the user goes last: if a step
  // fails, the user is still in the list and deleting them again finishes
  // the job. The other order could leave an upcoming game without an
  // organizer and nobody to delete.
  await deleteUpcomingGamesOrganizedBy(user);
  // All of them, whatever their state and the status of their game: a join
  // request is only ever shown to the user who sent it and to the organizer
  // who answers it
  await JoinRequest.deleteMany({ user: user._id });
  await deleteUpcomingPlayersOf(user);
  // The messages are not touched: they stay in the chats of the other players
  await User.deleteOne({ _id: user._id });

  res.status(StatusCodes.NO_CONTENT).send();
};
