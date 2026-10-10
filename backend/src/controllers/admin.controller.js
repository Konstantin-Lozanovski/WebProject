import { StatusCodes } from "http-status-codes";
import User from "../models/user.model.js";
import Game, { getStatus } from "../models/game.model.js";
import JoinRequest, { STATES } from "../models/join-request.model.js";
import { toPublicGame, countPlayersByGame } from "./game.controller.js";

// Every route here is for admins only; the router checks that before any
// of these functions runs

// Returns an object like { upcoming: 5, "in progress": 1, finished: 3 }
const countGamesByStatus = async () => {
  const counts = { upcoming: 0, "in progress": 0, finished: 0 };

  // The status is not stored, so it cannot be counted by a query: every
  // game is asked for its status, by the same rule the rest of the app uses
  const games = await Game.find();
  for (const game of games) {
    const status = getStatus(game);
    counts[status] = counts[status] + 1;
  }

  return counts;
};

// Returns an object like { pending: 4, accepted: 44, declined: 2 }
const countJoinRequestsByState = async () => {
  const counts = {};

  // One small count per state instead of one grouped query, so a state
  // without join requests still gets its 0
  for (const state of STATES) {
    counts[state] = await JoinRequest.countDocuments({ state });
  }

  return counts;
};

// GET /api/admin/totals
// Counted from the collections on every request; nothing is logged or stored
export const getTotals = async (req, res) => {
  const totals = {
    users: await User.countDocuments(),
    games: await countGamesByStatus(),
    joinRequests: await countJoinRequestsByState(),
  };

  res.status(StatusCodes.OK).json({ totals });
};

// GET /api/admin/games
// Unlike GET /api/games, which is the search of upcoming games, this is
// every game at every status
export const getAllGames = async (req, res) => {
  const games = await Game.find()
    .sort("startTime")
    .populate("organizer", "username");
  const counts = await countPlayersByGame(games);

  const inProgressGames = [];
  const upcomingGames = [];
  const finishedGames = [];

  for (const game of games) {
    // A game missing from counts has no players, which is 0 and not "unknown"
    const publicGame = toPublicGame(game, counts[game._id] || 0);

    if (publicGame.status === "in progress") {
      inProgressGames.push(publicGame);
    } else if (publicGame.status === "upcoming") {
      upcomingGames.push(publicGame);
    } else {
      finishedGames.push(publicGame);
    }
  }

  // The games came soonest first, which for finished games is the oldest
  // first. A history reads better with the most recent game on top.
  finishedGames.reverse();

  // What is happening now, then what is coming, then the history
  const sortedGames = inProgressGames.concat(upcomingGames, finishedGames);

  res.status(StatusCodes.OK).json({ games: sortedGames });
};
