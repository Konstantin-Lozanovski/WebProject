import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/app.js";

// A database of its own: node runs the test files at the same time, and
// db.test.js empties every collection of the database it uses
const TEST_MONGO_URI = "mongodb://localhost:27017/pickup-games-games-test";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let server;
let baseUrl;
let markoToken;
let saraToken;

before(async () => {
  await mongoose.connect(TEST_MONGO_URI);
  await mongoose.connection.dropDatabase();
  // Dropping the database also dropped the unique indexes, so they are
  // built again before any test relies on them
  await mongoose.connection.syncIndexes();

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  markoToken = await registerUser("marko_7", "marko@example.com");
  saraToken = await registerUser("sara_b", "sara@example.com");

  await createSearchGames();
});

after(async () => {
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

// token is optional: without it the request is a guest's
const post = (path, body, token) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
};

const get = (path) => {
  return fetch(`${baseUrl}${path}`);
};

const registerUser = async (username, email) => {
  const response = await post("/api/auth/register", {
    username,
    email,
    password: "football1",
  });
  const body = await response.json();
  return body.token;
};

const fromNow = (milliseconds) => {
  return new Date(Date.now() + milliseconds).toISOString();
};

const validGame = (changes) => {
  return {
    sport: "Football",
    city: "Skopje",
    venue: "Sports Center Boris Trajkovski, pitch 2",
    startTime: fromNow(3 * DAY),
    duration: 90,
    maxPlayers: 10,
    notes: "Bring a white and a dark shirt.",
    ...changes,
  };
};

// "2026-11-19": the calendar day that is this many days from now
const dayFromNow = (days) => {
  return fromNow(days * DAY).slice(0, 10);
};

// Far from the games of the other tests, so nothing overlaps
const SEARCH_DAY = dayFromNow(40);
const DAY_BEFORE = dayFromNow(39);
const DAY_AFTER = dayFromNow(41);

// The games the search tests look for. No other test makes a Padel, Tennis
// or Volleyball game, or a game in Bitola or Veles, or one on these days.
// Macedonia is 1 or 2 hours ahead of UTC, so 23:30 UTC is already the next
// day there, and 12:00 UTC is the same day.
const createSearchGames = async () => {
  const token = await registerUser("nina_k", "nina@example.com");
  const games = [
    { sport: "Padel", city: "Bitola", startTime: `${DAY_BEFORE}T23:30:00.000Z`, duration: 60 },
    { sport: "Padel", city: "Skopje", startTime: `${SEARCH_DAY}T12:00:00.000Z` },
    { sport: "Tennis", city: "Bitola", startTime: `${SEARCH_DAY}T23:30:00.000Z`, duration: 60 },
    { sport: "Volleyball", city: "Veles", startTime: `${DAY_AFTER}T12:00:00.000Z` },
  ];

  for (const game of games) {
    const response = await post("/api/games", validGame(game), token);
    assert.equal(response.status, 201);
  }
};

test("a logged-in user creates a game and becomes its organizer and its first player, unassigned", async () => {
  const startTime = fromNow(3 * DAY);
  const response = await post("/api/games", validGame({ startTime }), markoToken);
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.game.sport, "Football");
  assert.equal(body.game.city, "Skopje");
  assert.equal(body.game.venue, "Sports Center Boris Trajkovski, pitch 2");
  assert.equal(body.game.startTime, startTime);
  assert.equal(body.game.duration, 90);
  assert.equal(body.game.maxPlayers, 10);
  assert.equal(body.game.notes, "Bring a white and a dark shirt.");
  assert.equal(body.game.organizer.username, "marko_7");
  assert.equal(body.game.playerCount, 1);

  const gamePage = await get(`/api/games/${body.game._id}`);
  const gamePageBody = await gamePage.json();

  assert.equal(gamePage.status, 200);
  assert.equal(gamePageBody.players.length, 1);
  assert.equal(gamePageBody.players[0].user.username, "marko_7");
  assert.equal(gamePageBody.players[0].team, "unassigned");
});

test("a guest cannot create a game", async () => {
  const response = await post("/api/games", validGame({ startTime: fromNow(4 * DAY) }));

  assert.equal(response.status, 401);
});

test("a sport, city, duration or max players outside the fixed options is refused with a message for that field", async () => {
  const response = await post(
    "/api/games",
    validGame({ sport: "chess", city: "Paris", duration: 75, maxPlayers: 7 }),
    saraToken,
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(Object.keys(body.fields).sort(), [
    "city",
    "duration",
    "maxPlayers",
    "sport",
  ]);
});

test("max players must be an even number from 2 to 22", async () => {
  const zero = await post("/api/games", validGame({ maxPlayers: 0 }), saraToken);
  const tooMany = await post("/api/games", validGame({ maxPlayers: 24 }), saraToken);
  const odd = await post("/api/games", validGame({ maxPlayers: 11 }), saraToken);

  assert.equal(zero.status, 400);
  assert.equal(tooMany.status, 400);
  assert.equal(odd.status, 400);
});

test("a venue under 3 or over 100 characters, or notes over 300 characters, are refused", async () => {
  const shortVenue = await post("/api/games", validGame({ venue: " ab " }), saraToken);
  const longVenue = await post("/api/games", validGame({ venue: "a".repeat(101) }), saraToken);
  const longNotes = await post("/api/games", validGame({ notes: "a".repeat(301) }), saraToken);
  const body = await longNotes.json();

  assert.equal(shortVenue.status, 400);
  assert.equal(longVenue.status, 400);
  assert.equal(longNotes.status, 400);
  assert.equal(body.fields.notes, "Notes must be at most 300 characters");
});

test("a start less than 2 hours or more than 60 days from now is refused with a message for the start time", async () => {
  const tooSoon = await post("/api/games", validGame({ startTime: fromNow(1 * HOUR) }), saraToken);
  const tooFar = await post("/api/games", validGame({ startTime: fromNow(61 * DAY) }), saraToken);
  const notADate = await post("/api/games", validGame({ startTime: "tomorrow" }), saraToken);
  const body = await tooSoon.json();

  assert.equal(tooSoon.status, 400);
  assert.equal(tooFar.status, 400);
  assert.equal(notADate.status, 400);
  assert.equal(
    body.fields.startTime,
    "Start time must be at least 2 hours and at most 60 days from now",
  );
});

test("an empty body gets a message for every required field, and notes are optional", async () => {
  const empty = await post("/api/games", {}, saraToken);
  const body = await empty.json();

  assert.equal(empty.status, 400);
  assert.deepEqual(Object.keys(body.fields).sort(), [
    "city",
    "duration",
    "maxPlayers",
    "sport",
    "startTime",
    "venue",
  ]);

  const withoutNotes = await post(
    "/api/games",
    validGame({ notes: undefined, startTime: fromNow(10 * DAY) }),
    saraToken,
  );
  const withoutNotesBody = await withoutNotes.json();

  assert.equal(withoutNotes.status, 201);
  assert.equal(withoutNotesBody.game.notes, "");
});

test("creating a game that overlaps another game the user is a player in returns 409 with a clear message", async () => {
  const start = Date.now() + 20 * DAY;
  const first = await post(
    "/api/games",
    validGame({ startTime: new Date(start).toISOString(), duration: 90 }),
    markoToken,
  );
  assert.equal(first.status, 201);

  // Starts an hour in, while the first one is still being played
  const overlapping = await post(
    "/api/games",
    validGame({ startTime: new Date(start + 1 * HOUR).toISOString(), sport: "Tennis" }),
    markoToken,
  );
  const body = await overlapping.json();

  assert.equal(overlapping.status, 409);
  assert.match(body.msg, /overlaps another game you are a player in/);

  // Starts an hour before and lasts two, so it runs into the first one
  const runsInto = await post(
    "/api/games",
    validGame({ startTime: new Date(start - 1 * HOUR).toISOString(), duration: 120 }),
    markoToken,
  );
  assert.equal(runsInto.status, 409);
});

test("a game that starts exactly when the other one ends does not overlap, and another user is not blocked at all", async () => {
  const start = Date.now() + 30 * DAY;
  const first = await post(
    "/api/games",
    validGame({ startTime: new Date(start).toISOString(), duration: 60 }),
    markoToken,
  );
  assert.equal(first.status, 201);

  const backToBack = await post(
    "/api/games",
    validGame({ startTime: new Date(start + 1 * HOUR).toISOString() }),
    markoToken,
  );
  const sameTimeOtherUser = await post(
    "/api/games",
    validGame({ startTime: new Date(start).toISOString(), city: "Ohrid" }),
    saraToken,
  );

  assert.equal(backToBack.status, 201);
  assert.equal(sameTimeOtherUser.status, 201);
});

test("a guest sees the upcoming games soonest first, each with its players counted", async () => {
  const response = await get("/api/games");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(body.games.length >= 2);

  const startTimes = body.games.map((game) => game.startTime);
  assert.deepEqual(startTimes, [...startTimes].sort());

  for (const game of body.games) {
    assert.equal(game.status, "upcoming");
    assert.equal(game.playerCount, 1);
    assert.equal(typeof game.organizer.username, "string");
  }
});

test("a guest narrows the upcoming games by sport", async () => {
  const response = await get("/api/games?sport=Padel");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.games.length, 2);
  for (const game of body.games) {
    assert.equal(game.sport, "Padel");
  }
});

test("the sport and city filters combine: only games matching both come back", async () => {
  const byCity = await get("/api/games?city=Bitola");
  const byCityBody = await byCity.json();
  const byBoth = await get("/api/games?sport=Padel&city=Bitola");
  const byBothBody = await byBoth.json();

  assert.deepEqual(
    byCityBody.games.map((game) => game.sport),
    ["Padel", "Tennis"],
  );
  assert.equal(byBothBody.games.length, 1);
  assert.equal(byBothBody.games[0].sport, "Padel");
  assert.equal(byBothBody.games[0].city, "Bitola");
});

test("the date filter returns the games starting on that calendar day in Macedonia", async () => {
  const response = await get(`/api/games?date=${SEARCH_DAY}`);
  const body = await response.json();

  // The first one starts late on the day before by the UTC clock, but after
  // midnight in Macedonia. The Tennis game is the other way round: after
  // midnight in Macedonia, so it belongs to the next day.
  assert.equal(response.status, 200);
  assert.deepEqual(
    body.games.map((game) => game.startTime),
    [`${DAY_BEFORE}T23:30:00.000Z`, `${SEARCH_DAY}T12:00:00.000Z`],
  );

  const nextDay = await get(`/api/games?date=${DAY_AFTER}`);
  const nextDayBody = await nextDay.json();

  assert.deepEqual(
    nextDayBody.games.map((game) => game.sport),
    ["Tennis", "Volleyball"],
  );
});

test("all three filters combine", async () => {
  const response = await get(`/api/games?sport=Padel&city=Bitola&date=${SEARCH_DAY}`);
  const body = await response.json();
  const noMatch = await get(`/api/games?sport=Tennis&city=Veles&date=${SEARCH_DAY}`);
  const noMatchBody = await noMatch.json();

  assert.equal(body.games.length, 1);
  assert.equal(body.games[0].startTime, `${DAY_BEFORE}T23:30:00.000Z`);
  // No match is an empty list, not an error
  assert.equal(noMatch.status, 200);
  assert.deepEqual(noMatchBody.games, []);
});

test("an invalid sport, city or date is refused with a message for that filter", async () => {
  const response = await get("/api/games?sport=chess&city=Paris&date=tomorrow");
  const body = await response.json();
  const noSuchDay = await get("/api/games?date=2026-02-30");

  assert.equal(response.status, 400);
  assert.deepEqual(body.fields, {
    sport: "Sport must be one of the listed sports",
    city: "City must be one of the listed cities",
    date: "Date must be a real day written as YYYY-MM-DD",
  });
  assert.equal(noSuchDay.status, 400);
});

test("a guest opens a game and sees its details, its status and its players by username", async () => {
  const list = await get("/api/games");
  const firstGame = (await list.json()).games[0];

  const response = await get(`/api/games/${firstGame._id}`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.game._id, firstGame._id);
  assert.equal(body.game.status, "upcoming");
  assert.equal(body.game.maxPlayers, 10);
  assert.equal(body.players[0].user.username, body.game.organizer.username);
  // Nothing private about the account comes along with the username
  assert.equal(body.players[0].user.email, undefined);
  assert.equal(body.players[0].user.password, undefined);
});

test("a game that does not exist returns 404, and an id that is not an id returns 400", async () => {
  const missing = await get("/api/games/66f1c0a4e3b2a1d4c5f6a7b8");
  const body = await missing.json();
  const notAnId = await get("/api/games/not-an-id");

  assert.equal(missing.status, 404);
  assert.equal(body.msg, "Game not found");
  assert.equal(notAnId.status, 400);
});

test("the three game routes are in the OpenAPI file", async () => {
  const response = await get("/api/swagger.json");
  const body = await response.json();

  assert.ok(body.paths["/api/games"].get);
  assert.deepEqual(
    body.paths["/api/games"].get.parameters.map((parameter) => parameter.name),
    ["sport", "city", "date"],
  );
  assert.ok(body.paths["/api/games"].post);
  assert.ok(body.paths["/api/games/{id}"].get);
});

test("seeded games cover every status, sport and city, each with its organizer as a player", async () => {
  // The seed empties the database, so this test stays the last one
  const seed = await post("/api/db/seed");
  const seedBody = await seed.json();

  assert.equal(seed.status, 201);
  assert.equal(seedBody.counts.players, seedBody.counts.games);

  // The list only shows upcoming games, and no route lists the others yet,
  // so the test reads the ids itself and opens every game through the API
  const ids = await mongoose.connection.collection("games").distinct("_id");
  const games = [];
  for (const id of ids) {
    const response = await get(`/api/games/${id}`);
    const body = await response.json();
    assert.equal(body.players.length, 1);
    assert.equal(body.players[0].user.username, body.game.organizer.username);
    games.push(body.game);
  }

  const statuses = new Set(games.map((game) => game.status));
  const sports = new Set(games.map((game) => game.sport));
  const cities = new Set(games.map((game) => game.city));

  assert.deepEqual([...statuses].sort(), ["finished", "in progress", "upcoming"]);
  assert.equal(sports.size, 5);
  assert.equal(cities.size, 8);
});
