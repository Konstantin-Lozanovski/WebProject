import mongoose from "mongoose";
import User from "../models/user.model.js";
import Game from "../models/game.model.js";
import Player from "../models/player.model.js";
import JoinRequest from "../models/join-request.model.js";
import Message from "../models/message.model.js";

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

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// startsInHours is counted from the moment of seeding (negative means the
// game has already started), so the demo data always has games in every
// status, whenever the seed is run. The organizer is given by username.
// joinRequests are the join requests the game starts with: who sent each one
// and its state. An accepted one also makes that user a player.
// organizerTeam and the team of an accepted join request say which team
// that player is on: "A" or "B". Without one the player is unassigned.
// messages are the game's chat, oldest first: which player posted each one
// and how many minutes before the moment of seeding. A game without them
// starts with an empty chat.
// No user is a player in two games that overlap.
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
    organizerTeam: "A",
    joinRequests: [
      { user: "sara_b", state: "accepted", team: "B" },
      { user: "ivan_t", state: "accepted", team: "A" },
    ],
    messages: [
      // The game started between 72 and 73 hours ago: the second message is
      // from just before that, the last one from after the game ended
      { user: "marko_p", minutesAgo: 80 * 60, text: "Pitch 2 is booked, please be on time." },
      { user: "ivan_t", minutesAgo: 73 * 60 + 10, text: "I am a few minutes late, start without me." },
      { user: "sara_b", minutesAgo: 70 * 60, text: "Good game everyone!" },
    ],
  },
  {
    organizer: "sara_b",
    sport: "Basketball",
    city: "Kumanovo",
    venue: "Court behind the Sports Hall Kumanovo",
    startsInHours: -26,
    duration: 60,
    maxPlayers: 6,
    organizerTeam: "A",
    joinRequests: [{ user: "ana_s", state: "accepted", team: "B" }],
  },
  // Finished long ago: the history of marko_p, for the my-games-per-month
  // chart. They are 35 days or more apart from each other and from his
  // finished game above, and no month is that long, so each one falls in a
  // month of its own, whenever the seed is run.
  {
    organizer: "marko_p",
    sport: "Football",
    city: "Skopje",
    venue: "Sports Center Boris Trajkovski, pitch 2",
    startsInHours: -40 * 24,
    duration: 90,
    maxPlayers: 10,
    organizerTeam: "A",
    joinRequests: [
      { user: "ivan_t", state: "accepted", team: "B" },
      { user: "elena_k", state: "accepted", team: "B" },
    ],
  },
  {
    organizer: "david_m",
    sport: "Tennis",
    city: "Veles",
    venue: "Tennis Club Veles, court 2",
    startsInHours: -75 * 24,
    duration: 60,
    maxPlayers: 2,
    organizerTeam: "A",
    joinRequests: [{ user: "marko_p", state: "accepted", team: "B" }],
  },
  {
    organizer: "marko_p",
    sport: "Padel",
    city: "Skopje",
    venue: "Padel Club Vodno, court 1",
    startsInHours: -110 * 24,
    duration: 90,
    maxPlayers: 4,
    organizerTeam: "A",
    joinRequests: [
      { user: "sara_b", state: "accepted", team: "A" },
      { user: "ana_s", state: "accepted", team: "B" },
    ],
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
    organizerTeam: "A",
    joinRequests: [
      { user: "elena_k", state: "accepted", team: "B" },
      { user: "david_m", state: "accepted" },
    ],
    messages: [
      { user: "ivan_t", minutesAgo: 120, text: "The hall opens half an hour before we start." },
      { user: "david_m", minutesAgo: 20, text: "Stuck in traffic, I will be there in 10 minutes." },
    ],
  },
  // Upcoming. The first one has players on Team A, on Team B and unassigned.
  {
    organizer: "marko_p",
    sport: "Football",
    city: "Skopje",
    venue: "Sports Center Boris Trajkovski, pitch 2",
    startsInHours: 5,
    duration: 90,
    maxPlayers: 10,
    notes: "Bring a white and a dark shirt. We split the pitch fee after the game.",
    organizerTeam: "A",
    joinRequests: [
      { user: "ivan_t", state: "accepted", team: "A" },
      { user: "sara_b", state: "accepted", team: "B" },
      { user: "elena_k", state: "accepted" },
      { user: "ana_s", state: "pending" },
      { user: "david_m", state: "pending" },
    ],
    messages: [
      { user: "marko_p", minutesAgo: 180, text: "Pitch is booked from 18:00. Please be there 10 minutes early." },
      { user: "ivan_t", minutesAgo: 120, text: "I can bring a ball and a pump." },
      { user: "sara_b", minutesAgo: 40, text: "Is there parking next to the pitch?" },
      { user: "marko_p", minutesAgo: 35, text: "Yes, the big one in front of the main entrance is free." },
    ],
  },
  {
    organizer: "ana_s",
    sport: "Basketball",
    city: "Bitola",
    venue: "Outdoor court behind the Sports Hall Mladost",
    startsInHours: 24,
    duration: 60,
    maxPlayers: 6,
    joinRequests: [
      { user: "marko_p", state: "accepted" },
      { user: "ivan_t", state: "declined" },
      { user: "elena_k", state: "pending" },
    ],
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
    organizerTeam: "A",
    joinRequests: [
      { user: "david_m", state: "accepted", team: "B" },
      { user: "sara_b", state: "pending" },
    ],
    messages: [
      { user: "elena_k", minutesAgo: 26 * 60, text: "We still need two more players, tell your friends." },
      { user: "david_m", minutesAgo: 5, text: "I asked a colleague, he will send a join request." },
    ],
  },
  {
    organizer: "elena_k",
    sport: "Volleyball",
    city: "Ohrid",
    venue: "Beach court at Gradište",
    startsInHours: 96,
    duration: 120,
    maxPlayers: 12,
    joinRequests: [
      { user: "marko_p", state: "declined" },
      { user: "ana_s", state: "pending" },
    ],
  },
  // The full game: the organizer and one accepted player fill both places,
  // one on each team. The pending join request was sent before that, so
  // accepting it now is refused.
  {
    organizer: "david_m",
    sport: "Tennis",
    city: "Tetovo",
    venue: "City tennis courts, court 3",
    startsInHours: 7 * 24,
    duration: 60,
    maxPlayers: 2,
    organizerTeam: "A",
    joinRequests: [
      { user: "ana_s", state: "accepted", team: "B" },
      { user: "marko_p", state: "pending" },
    ],
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
    joinRequests: [],
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

// games holds the saved games in the order of DEMO_GAMES, so the game at
// one position belongs to the demo game at the same position
const seedJoinRequests = async (users, games) => {
  const joinRequests = [];

  for (let i = 0; i < games.length; i++) {
    for (const demoJoinRequest of DEMO_GAMES[i].joinRequests) {
      const user = users.find((user) => user.username === demoJoinRequest.user);

      joinRequests.push({
        user: user._id,
        game: games[i]._id,
        state: demoJoinRequest.state,
      });
    }
  }

  return JoinRequest.create(joinRequests);
};

// Every game gets its organizer as its first player, and then the user of
// each accepted join request. The teams come from DEMO_GAMES and not from
// the saved join requests, because a join request does not store a team.
// A team that is left out there is undefined here, and the schema's default
// makes that player unassigned.
const seedPlayers = async (users, games) => {
  const players = [];

  for (let i = 0; i < games.length; i++) {
    const demoGame = DEMO_GAMES[i];
    players.push({
      user: games[i].organizer,
      game: games[i]._id,
      team: demoGame.organizerTeam,
    });

    for (const demoJoinRequest of demoGame.joinRequests) {
      if (demoJoinRequest.state !== "accepted") continue;
      const user = users.find((user) => user.username === demoJoinRequest.user);

      players.push({
        user: user._id,
        game: games[i]._id,
        team: demoJoinRequest.team,
      });
    }
  }

  // ordered makes create save them one after another, so the organizer of
  // a game is also its oldest player and stays first in the list
  return Player.create(players, { ordered: true });
};

// The chat of each game that has one in DEMO_GAMES
const seedMessages = async (users, games) => {
  const messages = [];

  for (let i = 0; i < games.length; i++) {
    // A demo game without messages has no such field at all
    const demoMessages = DEMO_GAMES[i].messages || [];

    for (const demoMessage of demoMessages) {
      const user = users.find((user) => user.username === demoMessage.user);

      messages.push({
        user: user._id,
        game: games[i]._id,
        text: demoMessage.text,
        // Mongoose only fills in createdAt when it is missing, so a message
        // can be given a time in the past
        createdAt: new Date(Date.now() - demoMessage.minutesAgo * MINUTE),
      });
    }
  }

  return Message.create(messages);
};

// Clears first, so seeding twice gives the same data and not two copies.
// Each feature adds its own seed function above and one step here, in the
// order the documents depend on each other. The answer says how many
// documents each collection got.
export const seedDatabase = async () => {
  await clearDatabase();

  const users = await seedUsers();
  const games = await seedGames(users);
  const joinRequests = await seedJoinRequests(users, games);
  const players = await seedPlayers(users, games);
  const messages = await seedMessages(users, games);

  return {
    users: users.length,
    games: games.length,
    joinRequests: joinRequests.length,
    players: players.length,
    messages: messages.length,
  };
};
