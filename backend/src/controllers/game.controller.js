import { StatusCodes } from "http-status-codes";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "../errors/index.js";
import Game, {
  SPORTS,
  getStatus,
  findOverlappingGame,
  deleteGameWithItsDocuments,
} from "../models/game.model.js";
import Player from "../models/player.model.js";

// Every city of the app is in Macedonia, so "a day" always means a day there,
// whatever the clock of the server says (in the cloud it is UTC)
export const TIME_ZONE = "Europe/Skopje";

// "+01:00" in winter and "+02:00" in summer: how far Macedonia is ahead of
// UTC at the given moment
const getTimeZoneOffset = (moment) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    timeZoneName: "longOffset",
  });
  // The parts of the formatted date; the one we need holds "GMT+02:00"
  const parts = formatter.formatToParts(moment);
  const zonePart = parts.find((part) => part.type === "timeZoneName");
  return zonePart.value.replace("GMT", "");
};

// day is text like "2026-10-12". Returns the moment that day starts in
// Macedonia.
const getDayStart = (day) => {
  // The clocks change at 01:00 UTC, so the offset at 00:00 UTC is still the
  // one that midnight in Macedonia had
  const offset = getTimeZoneOffset(new Date(`${day}T00:00:00Z`));
  return new Date(`${day}T00:00:00${offset}`);
};

// The start of the next day, which is where the given day ends. Not simply
// 24 hours later: the day the clocks change is 23 or 25 hours long.
const getDayEnd = (day) => {
  const nextDay = new Date(`${day}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  // toISOString gives "2026-10-13T00:00:00.000Z"; the first 10 characters
  // are the day
  return getDayStart(nextDay.toISOString().slice(0, 10));
};

// The game as the client sees it. The status and the number of players are
// not fields of the document: they are worked out here for every answer.
// The organizer must be populated before this is called.
export const toPublicGame = (game, playerCount) => {
  return {
    _id: game._id,
    organizer: game.organizer,
    sport: game.sport,
    city: game.city,
    venue: game.venue,
    startTime: game.startTime,
    duration: game.duration,
    maxPlayers: game.maxPlayers,
    notes: game.notes,
    status: getStatus(game),
    playerCount,
    createdAt: game.createdAt,
  };
};

// The user must be populated before this is called
export const toPublicPlayer = (player) => {
  return {
    _id: player._id,
    user: player.user,
    game: player.game,
    team: player.team,
    createdAt: player.createdAt,
  };
};

// Returns an object like { gameId: 3 }, so the list needs one query for
// all its games and not one query per game
export const countPlayersByGame = async (games) => {
  const gameIds = games.map((game) => game._id);
  const players = await Player.find({ game: { $in: gameIds } });

  const counts = {};
  for (const player of players) {
    counts[player.game] = (counts[player.game] || 0) + 1;
  }
  return counts;
};

// Throws unless the user may edit or cancel the game: its organizer until
// it starts, or an admin at any time
const checkCanChangeGame = (game, user) => {
  if (user.role === "admin") return;

  // equals compares two ids by value; === would compare the objects
  if (!game.organizer.equals(user._id))
    throw new ForbiddenError("Only the organizer can change this game");

  if (getStatus(game) !== "upcoming")
    throw new ConflictError(
      "This game has already started, so it can no longer be changed",
    );
};

// Throws when the game, with its new time, overlaps another game of any of
// its players. The user of every player must be populated.
const checkNoPlayerOverlaps = async (game, players) => {
  for (const player of players) {
    // The user is missing when their account was deleted
    if (!player.user) continue;

    const overlappingGame = await findOverlappingGame(player.user._id, game);
    if (overlappingGame)
      throw new ConflictError(
        `This change makes the game overlap another game ${player.user.username} is a player in (${overlappingGame.sport} in ${overlappingGame.city})`,
      );
  }
};

// Throws when Team A or Team B has more players than half the new max. The
// number of players alone does not show it: 4 players fit in a max of 4, but
// not when 3 of them are on the same team.
const checkTeamsFit = (maxPlayers, players) => {
  for (const team of ["A", "B"]) {
    const teamPlayers = players.filter((player) => player.team === team);

    if (teamPlayers.length > maxPlayers / 2)
      throw new ConflictError(
        `Team ${team} has ${teamPlayers.length} players, so the max cannot be lower than ${teamPlayers.length * 2}`,
      );
  }
};

// GET /api/games
export const getUpcomingGames = async (req, res) => {
  const { sport, city, date } = req.query;

  // Upcoming means "has not started yet", which is the same rule getStatus uses
  const filter = { startTime: { $gt: new Date() } };
  // A filter that was not chosen is left out, so it matches every game
  if (sport) filter.sport = sport;
  if (city) filter.city = city;
  // Added to the "not started yet" rule, so a search for today still leaves
  // out the games that already started
  if (date) {
    filter.startTime.$gte = getDayStart(date);
    filter.startTime.$lt = getDayEnd(date);
  }

  const games = await Game.find(filter)
    .sort("startTime")
    .populate("organizer", "username");

  const counts = await countPlayersByGame(games);
  // A game missing from counts has no players, which is 0 and not "unknown"
  const publicGames = games.map((game) => {
    return toPublicGame(game, counts[game._id] || 0);
  });

  res.status(StatusCodes.OK).json({ games: publicGames });
};

// GET /api/games/sport-counts
export const getSportCounts = async (req, res) => {
  const sportCounts = [];

  // One small count per sport instead of one grouped query: a sport that has
  // no games still gets its 0, and the answer keeps the order of SPORTS
  for (const sport of SPORTS) {
    const count = await Game.countDocuments({ sport });
    sportCounts.push({ sport, count });
  }

  res.status(StatusCodes.OK).json({ sportCounts });
};

// GET /api/games/:id
export const getGame = async (req, res) => {
  const game = await Game.findById(req.params.id).populate(
    "organizer",
    "username",
  );
  if (!game) throw new NotFoundError("Game not found");

  // Oldest first, so the organizer is always the first player in the list
  const players = await Player.find({ game: game._id })
    .sort("createdAt")
    .populate("user", "username");

  res.status(StatusCodes.OK).json({
    game: toPublicGame(game, players.length),
    players: players.map(toPublicPlayer),
  });
};

// POST /api/games
export const createGame = async (req, res) => {
  const { sport, city, venue, startTime, duration, maxPlayers, notes } = req.body;

  // The organizer comes from the token, never from the body, so nobody
  // can create a game in someone else's name
  const game = new Game({
    organizer: req.user._id,
    sport,
    city,
    venue,
    startTime,
    duration,
    maxPlayers,
    notes,
  });
  // Validated by hand before the overlap check, because the check needs a
  // real start time and duration to compare
  await game.validate();

  const overlappingGame = await findOverlappingGame(req.user._id, game);
  if (overlappingGame)
    throw new ConflictError(
      `This game overlaps another game you are a player in (${overlappingGame.sport} in ${overlappingGame.city})`,
    );

  await game.save();

  try {
    await Player.create({ user: req.user._id, game: game._id });
  } catch (error) {
    // A game must never exist without its organizer as a player
    await Game.deleteOne({ _id: game._id });
    throw error;
  }

  await game.populate("organizer", "username");

  res.status(StatusCodes.CREATED).json({ game: toPublicGame(game, 1) });
};

// PUT /api/games/:id
export const updateGame = async (req, res) => {
  const { sport, city, venue, startTime, duration, maxPlayers, notes } = req.body;

  const game = await Game.findById(req.params.id);
  if (!game) throw new NotFoundError("Game not found");
  checkCanChangeGame(game, req.user);

  // The organizer is not in this list, so an edit can never change whose
  // game it is
  game.set({ sport, city, venue, startTime, duration, maxPlayers, notes });

  // "At least 2 hours from now" is a rule for a start time that is being
  // chosen. One that stays as it was may be closer than that by now, or in
  // the past when an admin edits a finished game, so it is not checked
  // again. Every other rule of the schema is.
  const pathsToSkip = game.isModified("startTime") ? [] : ["startTime"];
  await game.validate({ pathsToSkip });

  const players = await Player.find({ game: game._id }).populate(
    "user",
    "username",
  );
  if (maxPlayers < players.length)
    throw new ConflictError(
      `This game has ${players.length} players, so the max cannot be lower than that`,
    );
  checkTeamsFit(maxPlayers, players);

  // With the same start time and duration nothing new can overlap
  if (game.isModified("startTime") || game.isModified("duration")) {
    await checkNoPlayerOverlaps(game, players);
  }

  // Already validated just above
  await game.save({ validateBeforeSave: false });

  await game.populate("organizer", "username");

  res.status(StatusCodes.OK).json({ game: toPublicGame(game, players.length) });
};

// DELETE /api/games/:id
// For the organizer this is cancelling the game; for an admin, deleting it
export const deleteGame = async (req, res) => {
  const game = await Game.findById(req.params.id);
  if (!game) throw new NotFoundError("Game not found");
  checkCanChangeGame(game, req.user);

  await deleteGameWithItsDocuments(game);

  res.status(StatusCodes.NO_CONTENT).send();
};
