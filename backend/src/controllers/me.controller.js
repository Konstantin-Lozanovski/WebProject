import { StatusCodes } from "http-status-codes";
import Game, { TIME_ZONE, getStatus } from "../models/game.model.js";
import Player from "../models/player.model.js";
import JoinRequest from "../models/join-request.model.js";
import { toPublicGame, countPlayersByGame } from "./game.controller.js";
import { toPublicJoinRequest } from "./join-request.controller.js";

// How many months the my-games-per-month chart goes back, this month included
const MONTHS_SHOWN = 6;

// Every route here answers with the data of the logged-in user. The user
// always comes from the token and never from the address or the body, so
// nobody can ask for someone else's games or join requests.

// The games the user is a player in, soonest first, each with its organizer
const findGamesOfUser = async (userId) => {
  const players = await Player.find({ user: userId });
  const gameIds = players.map((player) => player.game);

  return Game.find({ _id: { $in: gameIds } })
    .sort("startTime")
    .populate("organizer", "username");
};

// GET /api/me/games
export const getMyGames = async (req, res) => {
  const games = await findGamesOfUser(req.user._id);
  const counts = await countPlayersByGame(games);

  // Upcoming games and the ones in progress
  const currentGames = [];
  const finishedGames = [];

  for (const game of games) {
    const publicGame = toPublicGame(game, counts[game._id] || 0);

    if (publicGame.status === "finished") {
      finishedGames.push(publicGame);
    } else {
      currentGames.push(publicGame);
    }
  }

  // The games came soonest first, which for finished games is the oldest
  // first. A history reads better with the most recent game on top.
  finishedGames.reverse();

  res.status(StatusCodes.OK).json({ currentGames, finishedGames });
};

// GET /api/me/join-requests
export const getMyJoinRequests = async (req, res) => {
  // Newest first. The game is populated with only what a list needs to
  // name it and link to it.
  const joinRequests = await JoinRequest.find({ user: req.user._id })
    .sort("-createdAt")
    .populate("user", "username")
    .populate("game", "sport city startTime");

  // populate leaves null when the join request's game no longer exists
  const withGame = joinRequests.filter((joinRequest) => joinRequest.game);

  res
    .status(StatusCodes.OK)
    .json({ joinRequests: withGame.map(toPublicJoinRequest) });
};

// "2026-10": the month the moment falls in, in Macedonia. Not the month of
// the server's clock, so a game at 00:30 on the 1st counts for the month the
// players saw on their calendar.
const getMonth = (moment) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(moment);
  const year = parts.find((part) => part.type === "year").value;
  const month = parts.find((part) => part.type === "month").value;
  return `${year}-${month}`;
};

// The months the chart shows, oldest first, this month last
const getLastMonths = () => {
  // "2026-10": the first 4 characters are the year, the last 2 the month
  const thisMonth = getMonth(new Date());
  const year = Number(thisMonth.slice(0, 4));
  const month = Number(thisMonth.slice(5));
  const months = [];

  for (let monthsAgo = MONTHS_SHOWN - 1; monthsAgo >= 0; monthsAgo--) {
    // Months count from 0 here, so this month is month - 1. Date.UTC accepts
    // a month below 0 and moves into the year before.
    const firstDay = new Date(Date.UTC(year, month - 1 - monthsAgo, 1));
    // toISOString gives "2026-10-01T00:00:00.000Z"; the first 7 characters
    // are the month
    months.push(firstDay.toISOString().slice(0, 7));
  }

  return months;
};

// GET /api/me/month-counts
export const getMyMonthCounts = async (req, res) => {
  const games = await findGamesOfUser(req.user._id);

  // Starts as { "2026-05": 0, ..., "2026-10": 0 }, so a month without
  // games still gets its 0
  const counts = {};
  for (const month of getLastMonths()) {
    counts[month] = 0;
  }

  for (const game of games) {
    if (getStatus(game) !== "finished") continue;

    const month = getMonth(game.startTime);
    // A month missing from counts is older than the chart shows
    if (counts[month] !== undefined) counts[month] = counts[month] + 1;
  }

  const monthCounts = Object.keys(counts).map((month) => {
    return { month, count: counts[month] };
  });

  res.status(StatusCodes.OK).json({ monthCounts });
};
