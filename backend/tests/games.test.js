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
// The organizer of the games that the edit and cancel tests change
let petarToken;
let adminToken;

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
  petarToken = await registerUser("petar_v", "petar@example.com");

  // Nobody can register as an admin, so the role is set in the database
  adminToken = await registerUser("the_admin", "admin@example.com");
  await mongoose.connection
    .collection("users")
    .updateOne({ username: "the_admin" }, { $set: { role: "admin" } });

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

const put = (path, body, token) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${baseUrl}${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
};

const del = (path, token) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${baseUrl}${path}`, { method: "DELETE", headers });
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

// Creates a game through the API and returns it as the API answered
const createGameAs = async (token, changes) => {
  const response = await post("/api/games", validGame(changes), token);
  assert.equal(response.status, 201);
  return (await response.json()).game;
};

// The API refuses a start in the past, so a game that already started can
// only be made by moving its start in the database
const moveStartTime = async (game, startTime) => {
  await mongoose.connection
    .collection("games")
    .updateOne(
      { _id: new mongoose.Types.ObjectId(game._id) },
      { $set: { startTime: new Date(startTime) } },
    );
};

// Join requests are not built yet, so a second player can only get into a
// game by being written to the database. team is optional.
const addPlayer = async (game, username, team = "unassigned") => {
  const user = await mongoose.connection.collection("users").findOne({ username });
  await mongoose.connection.collection("players").insertOne({
    user: user._id,
    game: new mongoose.Types.ObjectId(game._id),
    team,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
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

test("the organizer edits every detail of their upcoming game", async () => {
  const game = await createGameAs(petarToken, { startTime: fromNow(12 * DAY) });
  const newStartTime = fromNow(13 * DAY);

  const response = await put(
    `/api/games/${game._id}`,
    {
      sport: "Basketball",
      city: "Ohrid",
      venue: "  Court by the lake  ",
      startTime: newStartTime,
      duration: 60,
      maxPlayers: 6,
      notes: "Changed plans.",
    },
    petarToken,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.game.organizer.username, "petar_v");
  assert.equal(body.game.playerCount, 1);

  const gamePage = await get(`/api/games/${game._id}`);
  const saved = (await gamePage.json()).game;

  assert.equal(saved.sport, "Basketball");
  assert.equal(saved.city, "Ohrid");
  assert.equal(saved.venue, "Court by the lake");
  assert.equal(saved.startTime, newStartTime);
  assert.equal(saved.duration, 60);
  assert.equal(saved.maxPlayers, 6);
  assert.equal(saved.notes, "Changed plans.");
});

test("only the organizer or an admin can edit a game: another user gets 403 and a guest gets 401", async () => {
  const game = await createGameAs(petarToken, { startTime: fromNow(15 * DAY) });
  const changes = validGame({ startTime: game.startTime, venue: "Changed venue" });

  const asGuest = await put(`/api/games/${game._id}`, changes);
  const asOtherUser = await put(`/api/games/${game._id}`, changes, saraToken);
  const asAdmin = await put(`/api/games/${game._id}`, changes, adminToken);

  assert.equal(asGuest.status, 401);
  assert.equal(asOtherUser.status, 403);
  assert.equal(asAdmin.status, 200);

  // The admin's edit did not make the admin the organizer
  assert.equal((await asAdmin.json()).game.organizer.username, "petar_v");
});

test("editing a game that does not exist returns 404", async () => {
  const response = await put(
    "/api/games/66f1c0a4e3b2a1d4c5f6a7b8",
    validGame(),
    petarToken,
  );

  assert.equal(response.status, 404);
});

test("the organizer cannot edit a game that has started, but an admin can edit it at any status", async () => {
  const inProgress = await createGameAs(petarToken, { startTime: fromNow(17 * DAY) });
  const finished = await createGameAs(petarToken, { startTime: fromNow(19 * DAY) });
  const startedHalfAnHourAgo = fromNow(-0.5 * HOUR);
  const startedThreeDaysAgo = fromNow(-3 * DAY);
  await moveStartTime(inProgress, startedHalfAnHourAgo);
  await moveStartTime(finished, startedThreeDaysAgo);

  // Only the notes change; the start time is sent back as it was
  const inProgressChanges = validGame({ startTime: startedHalfAnHourAgo, notes: "Fixed." });
  const finishedChanges = validGame({ startTime: startedThreeDaysAgo, notes: "Fixed." });

  const organizerInProgress = await put(`/api/games/${inProgress._id}`, inProgressChanges, petarToken);
  const organizerFinished = await put(`/api/games/${finished._id}`, finishedChanges, petarToken);
  const body = await organizerInProgress.json();

  assert.equal(organizerInProgress.status, 409);
  assert.equal(organizerFinished.status, 409);
  assert.match(body.msg, /already started/);

  const adminInProgress = await put(`/api/games/${inProgress._id}`, inProgressChanges, adminToken);
  const adminFinished = await put(`/api/games/${finished._id}`, finishedChanges, adminToken);

  assert.equal(adminInProgress.status, 200);
  assert.equal(adminFinished.status, 200);
  assert.equal((await adminFinished.json()).game.notes, "Fixed.");
});

test("an edit follows the same field rules as creating a game", async () => {
  const game = await createGameAs(petarToken, { startTime: fromNow(21 * DAY) });

  const closedSets = await put(
    `/api/games/${game._id}`,
    validGame({ startTime: game.startTime, sport: "chess", city: "Paris", duration: 75, maxPlayers: 7 }),
    petarToken,
  );
  const texts = await put(
    `/api/games/${game._id}`,
    validGame({ startTime: game.startTime, venue: "ab", notes: "a".repeat(301) }),
    petarToken,
  );
  const empty = await put(`/api/games/${game._id}`, {}, petarToken);

  assert.equal(closedSets.status, 400);
  assert.deepEqual(Object.keys((await closedSets.json()).fields).sort(), [
    "city",
    "duration",
    "maxPlayers",
    "sport",
  ]);
  assert.equal(texts.status, 400);
  assert.deepEqual(Object.keys((await texts.json()).fields).sort(), ["notes", "venue"]);
  assert.equal(empty.status, 400);
  assert.deepEqual(Object.keys((await empty.json()).fields).sort(), [
    "city",
    "duration",
    "maxPlayers",
    "sport",
    "startTime",
    "venue",
  ]);
});

test("a start time changed to less than 2 hours or more than 60 days from now is refused, for an admin too", async () => {
  const game = await createGameAs(petarToken, { startTime: fromNow(23 * DAY) });

  const tooSoon = await put(
    `/api/games/${game._id}`,
    validGame({ startTime: fromNow(1 * HOUR) }),
    petarToken,
  );
  const tooFar = await put(
    `/api/games/${game._id}`,
    validGame({ startTime: fromNow(61 * DAY) }),
    adminToken,
  );
  const notADate = await put(
    `/api/games/${game._id}`,
    validGame({ startTime: "tomorrow" }),
    petarToken,
  );
  const body = await tooSoon.json();

  assert.equal(tooSoon.status, 400);
  assert.equal(
    body.fields.startTime,
    "Start time must be at least 2 hours and at most 60 days from now",
  );
  assert.equal(tooFar.status, 400);
  assert.equal(notADate.status, 400);

  // Nothing of the refused edits was saved
  const gamePage = await get(`/api/games/${game._id}`);
  assert.equal((await gamePage.json()).game.startTime, game.startTime);
});

test("lowering the max below the current number of players returns 409 with a clear message", async () => {
  const game = await createGameAs(petarToken, { startTime: fromNow(25 * DAY), maxPlayers: 10 });
  await addPlayer(game, "sara_b");
  await addPlayer(game, "nina_k");
  const changes = (maxPlayers) => validGame({ startTime: game.startTime, maxPlayers });

  const belowCount = await put(`/api/games/${game._id}`, changes(2), petarToken);
  const body = await belowCount.json();
  const asAdmin = await put(`/api/games/${game._id}`, changes(2), adminToken);

  assert.equal(belowCount.status, 409);
  assert.equal(body.msg, "This game has 3 players, so the max cannot be lower than that");
  assert.equal(asAdmin.status, 409);

  // 4 is the lowest even number that still holds the 3 players
  const enough = await put(`/api/games/${game._id}`, changes(4), petarToken);
  assert.equal(enough.status, 200);
  assert.equal((await enough.json()).game.playerCount, 3);
});

test("lowering the max so far that a team no longer fits in its half returns 409", async () => {
  const game = await createGameAs(petarToken, { startTime: fromNow(43 * DAY), maxPlayers: 10 });
  await addPlayer(game, "sara_b", "A");
  await addPlayer(game, "nina_k", "A");
  await addPlayer(game, "marko_7", "A");
  const changes = (maxPlayers) => validGame({ startTime: game.startTime, maxPlayers });

  // 4 players fit in a max of 4, but Team A would have 2 spaces for its 3 players
  const tooLow = await put(`/api/games/${game._id}`, changes(4), petarToken);
  const body = await tooLow.json();
  const asAdmin = await put(`/api/games/${game._id}`, changes(4), adminToken);

  assert.equal(tooLow.status, 409);
  assert.equal(body.msg, "Team A has 3 players, so the max cannot be lower than 6");
  assert.equal(asAdmin.status, 409);

  const gamePage = await get(`/api/games/${game._id}`);
  assert.equal((await gamePage.json()).game.maxPlayers, 10);

  const enough = await put(`/api/games/${game._id}`, changes(6), petarToken);
  assert.equal(enough.status, 200);
});

test("moving a game onto another game of one of its players returns 409 and names the player", async () => {
  const start = Date.now() + 27 * DAY;
  const game = await createGameAs(petarToken, {
    startTime: new Date(start).toISOString(),
    duration: 60,
  });
  await addPlayer(game, "sara_b");
  // Sara's own game starts 3 hours after this one
  await createGameAs(saraToken, {
    startTime: new Date(start + 3 * HOUR).toISOString(),
    duration: 60,
    sport: "Tennis",
    city: "Ohrid",
  });

  const movedOnto = await put(
    `/api/games/${game._id}`,
    validGame({ startTime: new Date(start + 2.5 * HOUR).toISOString(), duration: 60 }),
    petarToken,
  );
  const body = await movedOnto.json();

  assert.equal(movedOnto.status, 409);
  assert.equal(
    body.msg,
    "This change makes the game overlap another game sara_b is a player in (Tennis in Ohrid)",
  );

  // Two hours later it ends exactly when Sara's game starts, which is allowed
  const backToBack = await put(
    `/api/games/${game._id}`,
    validGame({ startTime: new Date(start + 2 * HOUR).toISOString(), duration: 60 }),
    petarToken,
  );
  assert.equal(backToBack.status, 200);

  // The time stays, but a longer duration runs into Sara's game
  const longer = await put(
    `/api/games/${game._id}`,
    validGame({ startTime: new Date(start + 2 * HOUR).toISOString(), duration: 90 }),
    adminToken,
  );
  assert.equal(longer.status, 409);
});

test("a game does not overlap itself: a small move of the start time is allowed", async () => {
  const start = Date.now() + 29 * DAY;
  const game = await createGameAs(petarToken, { startTime: new Date(start).toISOString() });

  const response = await put(
    `/api/games/${game._id}`,
    validGame({ startTime: new Date(start + 0.5 * HOUR).toISOString() }),
    petarToken,
  );

  assert.equal(response.status, 200);
});

test("the organizer cancels their game: it is gone from the list and from its own address, with its players", async () => {
  const startTime = fromNow(31 * DAY);
  const game = await createGameAs(petarToken, { startTime, city: "Kumanovo" });
  await addPlayer(game, "sara_b");

  const response = await del(`/api/games/${game._id}`, petarToken);

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");

  const gamePage = await get(`/api/games/${game._id}`);
  const list = await get("/api/games?city=Kumanovo");

  assert.equal(gamePage.status, 404);
  assert.deepEqual((await list.json()).games, []);

  // No route can show the players of a game that is gone, so the test
  // looks in the database
  const playersLeft = await mongoose.connection
    .collection("players")
    .countDocuments({ game: new mongoose.Types.ObjectId(game._id) });
  assert.equal(playersLeft, 0);

  // The time is free again for the organizer
  await createGameAs(petarToken, { startTime });
});

test("only the organizer or an admin can cancel a game: another user gets 403 and a guest gets 401", async () => {
  const game = await createGameAs(petarToken, { startTime: fromNow(33 * DAY) });

  const asGuest = await del(`/api/games/${game._id}`);
  const asOtherUser = await del(`/api/games/${game._id}`, saraToken);

  assert.equal(asGuest.status, 401);
  assert.equal(asOtherUser.status, 403);
  assert.equal((await get(`/api/games/${game._id}`)).status, 200);

  const asAdmin = await del(`/api/games/${game._id}`, adminToken);
  const again = await del(`/api/games/${game._id}`, adminToken);

  assert.equal(asAdmin.status, 204);
  assert.equal(again.status, 404);
});

test("the organizer cannot cancel a game that has started, but an admin can delete it at any status", async () => {
  const inProgress = await createGameAs(petarToken, { startTime: fromNow(35 * DAY) });
  const finished = await createGameAs(petarToken, { startTime: fromNow(37 * DAY) });
  await moveStartTime(inProgress, fromNow(-0.5 * HOUR));
  await moveStartTime(finished, fromNow(-3 * DAY));

  const organizerInProgress = await del(`/api/games/${inProgress._id}`, petarToken);
  const organizerFinished = await del(`/api/games/${finished._id}`, petarToken);
  const body = await organizerInProgress.json();

  assert.equal(organizerInProgress.status, 409);
  assert.equal(organizerFinished.status, 409);
  assert.match(body.msg, /already started/);

  const adminInProgress = await del(`/api/games/${inProgress._id}`, adminToken);
  const adminFinished = await del(`/api/games/${finished._id}`, adminToken);

  assert.equal(adminInProgress.status, 204);
  assert.equal(adminFinished.status, 204);
});

test("the edit and delete routes are in the OpenAPI file", async () => {
  const response = await get("/api/swagger.json");
  const body = await response.json();

  assert.ok(body.paths["/api/games/{id}"].put);
  assert.ok(body.paths["/api/games/{id}"].delete);
  assert.ok(body.paths["/api/games/{id}"].put.responses["409"]);
  assert.ok(body.paths["/api/games/{id}"].delete.responses["204"]);
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

test("seeded games cover every status, sport and city, each with its organizer as its first player", async () => {
  // The seed empties the database, so this test stays the last one
  const seed = await post("/api/db/seed");

  assert.equal(seed.status, 201);

  // The list only shows upcoming games, and no route lists the others yet,
  // so the test reads the ids itself and opens every game through the API
  const ids = await mongoose.connection.collection("games").distinct("_id");
  const games = [];
  for (const id of ids) {
    const response = await get(`/api/games/${id}`);
    const body = await response.json();
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
