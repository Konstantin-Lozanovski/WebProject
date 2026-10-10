import { StatusCodes } from "http-status-codes";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "../errors/index.js";
import Game from "../models/game.model.js";
import Player from "../models/player.model.js";
import { takeUserOutOfGame } from "./join-request.controller.js";

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
  const game = await Game.findById(req.params.gameId);
  if (!game) throw new NotFoundError("Game not found");

  // Looked up with the game too, so a player cannot be reached through the
  // address of another game
  const player = await Player.findOne({
    _id: req.params.playerId,
    game: game._id,
  });
  if (!player) throw new NotFoundError("Player not found");
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
