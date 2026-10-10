import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/app.js";

// A database of its own: node runs the test files at the same time, and the
// totals here are only right when no other test adds a document
const TEST_MONGO_URI = "mongodb://localhost:27017/pickup-games-admin-test";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let server;
let baseUrl;
let adminToken;
let markoToken;
let petarToken;

before(async () => {
  await mongoose.connect(TEST_MONGO_URI);
  await mongoose.connection.dropDatabase();
  // Dropping the database also dropped the unique indexes, so they are
  // built again before any test relies on them
  await mongoose.connection.syncIndexes();

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  // Nobody can register as an admin, so the role is set in the database
  adminToken = await registerUser("the_admin", "admin@example.com");
  await mongoose.connection
    .collection("users")
    .updateOne({ username: "the_admin" }, { $set: { role: "admin" } });

  markoToken = await registerUser("marko_7", "marko@example.com");
  petarToken = await registerUser("petar_v", "petar@example.com");
});

after(async () => {
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

// token is optional: without it the request is a guest's.
// body is optional too: GET and DELETE send none.
const send = (method, path, token, body) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  return fetch(`${baseUrl}${path}`, options);
};

const registerUser = async (username, email) => {
  const response = await send("POST", "/api/auth/register", null, {
    username,
    email,
    password: "football1",
  });
  assert.equal(response.status, 201);
  return (await response.json()).token;
};

test("the admin routes return 403 to a user who is not an admin and 401 to a guest", async () => {
  for (const path of ["/api/admin/totals", "/api/admin/games"]) {
    const byAdmin = await send("GET", path, adminToken);
    const byUser = await send("GET", path, markoToken);
    const body = await byUser.json();
    const byGuest = await send("GET", path);

    assert.equal(byAdmin.status, 200);
    assert.equal(byUser.status, 403);
    assert.equal(body.totals, undefined);
    assert.equal(body.games, undefined);
    assert.equal(byGuest.status, 401);
  }
});

const getTotals = async () => {
  const response = await send("GET", "/api/admin/totals", adminToken);
  assert.equal(response.status, 200);
  return (await response.json()).totals;
};

test("with no games, the totals count the users and show zero for every status and state", async () => {
  assert.deepEqual(await getTotals(), {
    users: 3,
    games: { upcoming: 0, "in progress": 0, finished: 0 },
    joinRequests: { pending: 0, accepted: 0, declined: 0 },
  });
});

// Creates a game that starts this many days from now and returns it as the
// API answered. Each game is on a day of its own, so nothing overlaps.
const createGameAs = async (token, days) => {
  const response = await send("POST", "/api/games", token, {
    sport: "Football",
    city: "Skopje",
    venue: "Sports Center Boris Trajkovski, pitch 2",
    startTime: new Date(Date.now() + days * DAY).toISOString(),
    duration: 90,
    maxPlayers: 10,
  });
  assert.equal(response.status, 201);
  return (await response.json()).game;
};

// The API refuses a start in the past, so a game that already started can
// only be made by moving its start in the database
const moveStartTime = async (game, milliseconds) => {
  await mongoose.connection
    .collection("games")
    .updateOne(
      { _id: new mongoose.Types.ObjectId(game._id) },
      { $set: { startTime: new Date(Date.now() + milliseconds) } },
    );
};

// Sends a join request as the user of token. With an answer ("accepted" or
// "declined") the game's organizer then answers it; without one it stays
// pending.
const sendRequestAs = async (game, token, organizerToken, answer) => {
  const path = `/api/games/${game._id}/join-requests`;
  const response = await send("POST", path, token);
  assert.equal(response.status, 201);
  if (!answer) return;

  const joinRequest = (await response.json()).joinRequest;
  const answered = await send("PUT", `${path}/${joinRequest._id}`, organizerToken, {
    state: answer,
  });
  assert.equal(answered.status, 200);
};

// The games of the tests below, filled in by the first of them
let upcomingFirst;
let upcomingSecond;
let upcomingThird;
let inProgress;
let finished;
let finishedLongAgo;

test("the totals count the games by status and the join requests by state", async () => {
  upcomingFirst = await createGameAs(markoToken, 3);
  upcomingSecond = await createGameAs(markoToken, 4);
  inProgress = await createGameAs(markoToken, 5);
  finished = await createGameAs(markoToken, 6);
  upcomingThird = await createGameAs(petarToken, 7);
  finishedLongAgo = await createGameAs(petarToken, 8);

  await sendRequestAs(upcomingFirst, petarToken, markoToken, "accepted");
  await sendRequestAs(upcomingFirst, adminToken);
  await sendRequestAs(upcomingSecond, petarToken, markoToken, "declined");
  await sendRequestAs(inProgress, petarToken);
  await sendRequestAs(upcomingThird, markoToken, petarToken, "accepted");

  // Started less than its 90 minutes ago
  await moveStartTime(inProgress, -0.5 * HOUR);
  await moveStartTime(finished, -5 * HOUR);
  await moveStartTime(finishedLongAgo, -30 * HOUR);

  assert.deepEqual(await getTotals(), {
    users: 3,
    games: { upcoming: 3, "in progress": 1, finished: 2 },
    joinRequests: { pending: 2, accepted: 2, declined: 1 },
  });
});

const getAllGames = async () => {
  const response = await send("GET", "/api/admin/games", adminToken);
  assert.equal(response.status, 200);
  return (await response.json()).games;
};

test("an admin lists the games at every status: in progress first, then upcoming soonest first, then finished most recent first", async () => {
  const games = await getAllGames();

  assert.deepEqual(
    games.map((game) => [game._id, game.status]),
    [
      [inProgress._id, "in progress"],
      [upcomingFirst._id, "upcoming"],
      [upcomingSecond._id, "upcoming"],
      [upcomingThird._id, "upcoming"],
      [finished._id, "finished"],
      [finishedLongAgo._id, "finished"],
    ],
  );
});

test("each game in the admin's list has its organizer and its number of players", async () => {
  const games = await getAllGames();
  // Marko's game, which Petar was accepted into
  const game = games.find((game) => game._id === upcomingFirst._id);

  assert.equal(game.organizer.username, "marko_7");
  assert.equal(game.playerCount, 2);
  assert.equal(game.sport, "Football");
  assert.equal(game.maxPlayers, 10);
  // Nobody joined this one, so its only player is its organizer
  assert.equal(games.find((game) => game._id === upcomingSecond._id).playerCount, 1);
});

test("a game an admin deleted is gone from the list and from the totals, with its join requests", async () => {
  const response = await send("DELETE", `/api/games/${upcomingFirst._id}`, adminToken);
  assert.equal(response.status, 204);

  const games = await getAllGames();
  assert.equal(games.length, 5);
  assert.equal(games.find((game) => game._id === upcomingFirst._id), undefined);
  // The game had one accepted and one pending join request
  assert.deepEqual(await getTotals(), {
    users: 3,
    games: { upcoming: 2, "in progress": 1, finished: 2 },
    joinRequests: { pending: 1, accepted: 1, declined: 1 },
  });
});

test("the admin routes are in the OpenAPI file", async () => {
  const response = await send("GET", "/api/swagger.json");
  const body = await response.json();

  const totals = body.paths["/api/admin/totals"];
  const games = body.paths["/api/admin/games"];

  assert.ok(totals.get.responses["200"]);
  assert.ok(totals.get.responses["401"]);
  assert.ok(totals.get.responses["403"]);

  assert.ok(games.get.responses["200"]);
  assert.ok(games.get.responses["401"]);
  assert.ok(games.get.responses["403"]);
});
