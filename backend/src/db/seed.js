import mongoose from "mongoose";
import User from "../models/user.model.js";
import Game from "../models/game.model.js";
import Player from "../models/player.model.js";

// The demo logins. They are known on purpose, so anyone testing the app
// can log in as each role.
const ADMIN_PASSWORD = "admin1234";
const USER_PASSWORD = "football1";

const DEMO_USERS = [
  {
    username: "admin",
    email: "admin@example.com",
    password: ADMIN_PASSWORD,
    role: "admin",
  },
  { username: "marko_p", email: "marko@example.com", password: USER_PASSWORD },
  { username: "sara_b", email: "sara@example.com", password: USER_PASSWORD },
  { username: "ivan_t", email: "ivan@example.com", password: USER_PASSWORD },
  { username: "elena_k", email: "elena@example.com", password: USER_PASSWORD },
  { username: "david_m", email: "david@example.com", password: USER_PASSWORD },
  { username: "ana_s", email: "ana@example.com", password: USER_PASSWORD },
];

const HOUR = 60 * 60 * 1000;

// startsInHours is counted from the moment of seeding (negative means the
// game has already started), so the demo data always has games in every
// status, whenever the seed is run. The organizer is given by username.
// No organizer has two games that overlap.
const DEMO_GAMES = [
  // Finished
  {
    organizer: "marko_p",
    sport: "Football",
    city: "Skopje",
    venue: "Sports Center Boris Trajkovski, pitch 2",
    startsInHours: -72,
    duration: 90,
    maxPlayers: 10,
    notes: "Thanks for coming, same time next week?",
  },
  {
    organizer: "sara_b",
    sport: "Basketball",
    city: "Kumanovo",
    venue: "Court behind the Sports Hall Kumanovo",
    startsInHours: -26,
    duration: 60,
    maxPlayers: 6,
  },
  // In progress: it started less than 90 minutes ago and lasts 120
  {
    organizer: "ivan_t",
    sport: "Volleyball",
    city: "Veles",
    venue: "Sports Hall Gemidzii",
    startsInHours: -0.5,
    duration: 120,
    maxPlayers: 12,
    notes: "Indoor shoes only.",
  },
  // Upcoming
  {
    organizer: "marko_p",
    sport: "Football",
    city: "Skopje",
    venue: "Sports Center Boris Trajkovski, pitch 2",
    startsInHours: 5,
    duration: 90,
    maxPlayers: 10,
    notes: "Bring a white and a dark shirt. We split the pitch fee after the game.",
  },
  {
    organizer: "ana_s",
    sport: "Basketball",
    city: "Bitola",
    venue: "Outdoor court behind the Sports Hall Mladost",
    startsInHours: 24,
    duration: 60,
    maxPlayers: 6,
  },
  {
    organizer: "elena_k",
    sport: "Padel",
    city: "Prilep",
    venue: "Padel Club Prilep, court 1",
    startsInHours: 48,
    duration: 90,
    maxPlayers: 4,
    notes: "Rackets can be rented at the club.",
  },
  {
    organizer: "elena_k",
    sport: "Volleyball",
    city: "Ohrid",
    venue: "Beach court at Gradište",
    startsInHours: 96,
    duration: 120,
    maxPlayers: 12,
  },
  {
    organizer: "david_m",
    sport: "Tennis",
    city: "Tetovo",
    venue: "City tennis courts, court 3",
    startsInHours: 7 * 24,
    duration: 60,
    maxPlayers: 2,
  },
  // Too far ahead for a weather forecast
  {
    organizer: "sara_b",
    sport: "Football",
    city: "Štip",
    venue: "City stadium, small pitch",
    startsInHours: 20 * 24,
    duration: 90,
    maxPlayers: 14,
  },
];

// Empties every collection but keeps the collections themselves, so the
// unique indexes stay in place.
// mongoose.models holds every model the app has loaded, so a model added
// by a later feature is cleared too without changing this function.
export const clearDatabase = async () => {
  for (const model of Object.values(mongoose.models)) {
    await model.deleteMany({});
  }
};

const seedUsers = async () => {
  // create and not insertMany, because create saves the users one by one,
  // and saving is what runs the hook that hashes the password
  return User.create(DEMO_USERS);
};

// The minutes are set to zero, so a game starts at 18:00 and not at 18:23
const hoursFromNow = (hours) => {
  const time = new Date(Date.now() + hours * HOUR);
  time.setMinutes(0, 0, 0);
  return time;
};

const seedGames = async (users) => {
  const games = [];

  for (const demoGame of DEMO_GAMES) {
    const organizer = users.find((user) => user.username === demoGame.organizer);

    const game = new Game({
      organizer: organizer._id,
      sport: demoGame.sport,
      city: demoGame.city,
      venue: demoGame.venue,
      startTime: hoursFromNow(demoGame.startsInHours),
      duration: demoGame.duration,
      maxPlayers: demoGame.maxPlayers,
      notes: demoGame.notes,
    });
    // The rule "at least 2 hours from now" is for games that users create.
    // The seed needs finished games and one in progress, so it skips the
    // check of the start time only; every other rule is still checked.
    await game.validate({ pathsToSkip: ["startTime"] });
    await game.save({ validateBeforeSave: false });
    games.push(game);
  }

  return games;
};

// Every game gets its organizer as its first player, unassigned
const seedOrganizerPlayers = async (games) => {
  const players = games.map((game) => {
    return { user: game.organizer, game: game._id };
  });

  return Player.create(players);
};

// Clears first, so seeding twice gives the same data and not two copies.
// Each feature adds its own seed function above and one step here, in the
// order the documents depend on each other. The answer says how many
// documents each collection got.
export const seedDatabase = async () => {
  await clearDatabase();

  const users = await seedUsers();
  const games = await seedGames(users);
  const players = await seedOrganizerPlayers(games);

  return { users: users.length, games: games.length, players: players.length };
};
