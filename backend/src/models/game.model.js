import mongoose from "mongoose";
import Player from "./player.model.js";
import JoinRequest from "./join-request.model.js";
import Message from "./message.model.js";

// Exported so the request validation checks the same rules as the schema
export const SPORTS = ["Football", "Basketball", "Volleyball", "Tennis", "Padel"];
export const CITIES = [
  "Skopje",
  "Bitola",
  "Kumanovo",
  "Prilep",
  "Tetovo",
  "Ohrid",
  "Veles",
  "Štip",
];
// Every city of the app is in Macedonia, so "a day" always means a day there,
// whatever the clock of the server says (in the cloud it is UTC)
export const TIME_ZONE = "Europe/Skopje";
// In minutes
export const DURATIONS = [60, 90, 120];
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 22;
export const VENUE_MIN_LENGTH = 3;
export const VENUE_MAX_LENGTH = 100;
export const NOTES_MAX_LENGTH = 300;
// A new game starts at least this many hours and at most this many days from now
export const MIN_HOURS_AHEAD = 2;
export const MAX_DAYS_AHEAD = 60;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Two teams of the same size, so the max has to be a whole, even number
export const isEvenNumber = (value) => {
  return Number.isInteger(value) && value % 2 === 0;
};

export const isStartTimeAllowed = (startTime) => {
  const now = Date.now();
  const earliest = now + MIN_HOURS_AHEAD * HOUR;
  const latest = now + MAX_DAYS_AHEAD * DAY;

  return startTime.getTime() >= earliest && startTime.getTime() <= latest;
};

const gameSchema = new mongoose.Schema(
  {
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please provide organizer"],
    },
    sport: {
      type: String,
      required: [true, "Please provide sport"],
      enum: { values: SPORTS, message: "Sport must be one of the listed sports" },
    },
    city: {
      type: String,
      required: [true, "Please provide city"],
      enum: { values: CITIES, message: "City must be one of the listed cities" },
    },
    venue: {
      type: String,
      required: [true, "Please provide venue"],
      trim: true,
      minlength: [VENUE_MIN_LENGTH, "Venue must be 3 to 100 characters"],
      maxlength: [VENUE_MAX_LENGTH, "Venue must be 3 to 100 characters"],
    },
    // Only the start is stored. The end and the status are calculated from
    // it by the functions below, so they can never disagree with it.
    startTime: {
      type: Date,
      required: [true, "Please provide start time"],
      validate: {
        validator: isStartTimeAllowed,
        message: "Start time must be at least 2 hours and at most 60 days from now",
      },
    },
    duration: {
      type: Number,
      required: [true, "Please provide duration"],
      enum: { values: DURATIONS, message: "Duration must be 60, 90 or 120 minutes" },
    },
    maxPlayers: {
      type: Number,
      required: [true, "Please provide max players"],
      min: [MIN_PLAYERS, "Max players must be an even number from 2 to 22"],
      max: [MAX_PLAYERS, "Max players must be an even number from 2 to 22"],
      validate: {
        validator: isEvenNumber,
        message: "Max players must be an even number from 2 to 22",
      },
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: [NOTES_MAX_LENGTH, "Notes must be at most 300 characters"],
    },
  },
  { timestamps: true },
);

export const getEndTime = (game) => {
  return new Date(game.startTime.getTime() + game.duration * MINUTE);
};

export const getStatus = (game) => {
  const now = new Date();

  if (now < game.startTime) return "upcoming";
  if (now < getEndTime(game)) return "in progress";
  return "finished";
};

// The one overlap check of the app: two games overlap when each starts
// before the other ends. Each argument only needs a startTime and a
// duration, so it also works for a game that is not saved yet.
export const gamesOverlap = (firstGame, secondGame) => {
  return (
    firstGame.startTime < getEndTime(secondGame) &&
    secondGame.startTime < getEndTime(firstGame)
  );
};

// Returns the first game the user is a player in that overlaps the given
// game, or null when there is none
export const findOverlappingGame = async (userId, game) => {
  const players = await Player.find({ user: userId }).populate("game");

  for (const player of players) {
    // populate leaves null when the player's game no longer exists
    if (!player.game) continue;
    // When a game is edited the user is already a player in it, and its
    // old time would always overlap its new one
    if (player.game._id.equals(game._id)) continue;
    if (gamesOverlap(game, player.game)) return player.game;
  }

  return null;
};

const Game = mongoose.model("Game", gameSchema);

// How a game that has players is deleted, whoever asks for it (see
// docs/adr/0001): the game goes together with everything that belongs to it. Each feature
// that adds a collection belonging to a game adds one line here.
export const deleteGameWithItsDocuments = async (game) => {
  // The game goes first: if a later step fails, what is left are players
  // of a game that no longer exists, and never a game without its players
  await Game.deleteOne({ _id: game._id });
  await Player.deleteMany({ game: game._id });
  await JoinRequest.deleteMany({ game: game._id });
  await Message.deleteMany({ game: game._id });
};

export default Game;
