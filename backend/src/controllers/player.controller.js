import { StatusCodes } from "http-status-codes";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "../errors/index.js";
import Game, { getStatus } from "../models/game.model.js";
import Player from "../models/player.model.js";
import { toPublicPlayer } from "./game.controller.js";
import { takeUserOutOfGame } from "./join-request.controller.js";

// Both routes here are about one player of one game, so each one starts by
// finding the two
const findGame = async (gameId) => {
  const game = await Game.findById(gameId);
  if (!game) throw new NotFoundError("Game not found");
  return game;
};

// Looked up with the game too, so a player cannot be reached through the
// address of another game
const findPlayer = async (playerId, game) => {
  const player = await Player.findOne({ _id: playerId, game: game._id });
  if (!player) throw new NotFoundError("Player not found");
  return player;
};

// Throws unless the user may delete this player: the player themselves
// (leaving), the game's organizer (removing), or an admin
const checkCanDeletePlayer = (player, game, user) => {
  if (user.role === "admin") return;

  // equals compares two ids by value; === would compare the objects
  if (player.user.equals(user._id)) return;
  if (game.organizer.equals(user._id)) return;

  throw new ForbiddenError(
    "Only the organizer can remove a player from this game",
  );
};

// DELETE /api/games/:gameId/players/:playerId
// Leaving and removing are the same request: a player who deletes their own
// place leaves, and an organizer who deletes someone else's removes them
export const deletePlayer = async (req, res) => {
  const game = await findGame(req.params.gameId);
  const player = await findPlayer(req.params.playerId, game);
  checkCanDeletePlayer(player, game, req.user);

  // A game never exists without its organizer as a player, so this holds
  // for an admin too
  if (player.user.equals(game.organizer))
    throw new ConflictError(
      "The organizer cannot leave or be removed from their own game. Cancel the game instead.",
    );

  await takeUserOutOfGame(game, player.user, req.user);

  res.status(StatusCodes.NO_CONTENT).send();
};

// Throws unless the user may move the game's players between the teams:
// its organizer until it starts, or an admin at any time
const checkCanArrangeTeams = (game, user) => {
  if (user.role === "admin") return;

  if (!game.organizer.equals(user._id))
    throw new ForbiddenError(
      "Only the organizer can arrange the teams of this game",
    );

  if (getStatus(game) !== "upcoming")
    throw new ConflictError(
      "This game has already started, so its teams can no longer be changed",
    );
};

// PUT /api/games/:gameId/players/:playerId
// The body holds the player's new team: { team: "A" }, "B" or "unassigned"
export const updatePlayerTeam = async (req, res) => {
  const game = await findGame(req.params.gameId);
  checkCanArrangeTeams(game, req.user);
  const player = await findPlayer(req.params.playerId, game);

  const { team } = req.body;

  // Unassigned has no limit, and a player dropped back on their own team
  // takes no new space
  if (team !== "unassigned" && team !== player.team) {
    const teamCount = await Player.countDocuments({ game: game._id, team });
    if (teamCount >= game.maxPlayers / 2)
      throw new ConflictError(`Team ${team} is full`);
  }

  player.team = team;
  await player.save();
  await player.populate("user", "username");

  res.status(StatusCodes.OK).json({ player: toPublicPlayer(player) });
};
