import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/app.js";

// A database of its own: node runs the test files at the same time, and
// db.test.js empties every collection of the database it uses
const TEST_MONGO_URI = "mongodb://localhost:27017/pickup-games-my-games-test";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let server;
let baseUrl;
let markoToken;
let saraToken;
// Never a player and never sends a join request
let ninaToken;

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
  ninaToken = await registerUser("nina_k", "nina@example.com");
});

after(async () => {
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

// token is optional: without it the request is a guest's.
// body is optional too: GET sends none.
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
  const body = await response.json();
  return body.token;
};

// Every game gets its own day, so no two games of these tests overlap
// while they are being created
let nextDay = 3;

// Creates a game through the API and returns it as the API answered
const createGameAs = async (token, sport) => {
  nextDay = nextDay + 1;
  const response = await send("POST", "/api/games", token, {
    sport,
    city: "Skopje",
    venue: "Sports Center Boris Trajkovski, pitch 2",
    startTime: new Date(Date.now() + nextDay * DAY).toISOString(),
    duration: 90,
    maxPlayers: 10,
  });
  assert.equal(response.status, 201);
  return (await response.json()).game;
};

// The API refuses a start in the past, so a game in progress or a finished
// one can only be made by moving its start in the database
const moveStartTime = async (game, startTime) => {
  await mongoose.connection
    .collection("games")
    .updateOne(
      { _id: new mongoose.Types.ObjectId(game._id) },
      { $set: { startTime } },
    );
};

const hoursFromNow = (hours) => new Date(Date.now() + hours * HOUR);

// Sends a join request and returns it as the API answered
const sendRequestAs = async (game, token) => {
  const response = await send("POST", `/api/games/${game._id}/join-requests`, token);
  assert.equal(response.status, 201);
  return (await response.json()).joinRequest;
};

// The organizer's answer: "accepted" or "declined"
const answerRequestAs = async (game, joinRequest, state, token) => {
  const path = `/api/games/${game._id}/join-requests/${joinRequest._id}`;
  const response = await send("PUT", path, token, { state });
  assert.equal(response.status, 200);
};

const getBody = async (path, token) => {
  const response = await send("GET", path, token);
  assert.equal(response.status, 200);
  return response.json();
};

test("a guest is refused on every My games route", async () => {
  for (const path of ["games", "join-requests", "month-counts"]) {
    const response = await send("GET", `/api/me/${path}`);
    assert.equal(response.status, 401, path);
  }
});

test("a user with no games and no join requests gets empty lists", async () => {
  const games = await getBody("/api/me/games", ninaToken);
  const requests = await getBody("/api/me/join-requests", ninaToken);

  assert.deepEqual(games, { currentGames: [], finishedGames: [] });
  assert.deepEqual(requests, { joinRequests: [] });
});

test("a user's games are split into current ones, soonest first, and finished ones, most recent first", async () => {
  // Created in an order that is not the order of their start times
  const padel = await createGameAs(markoToken, "Padel");
  const tennis = await createGameAs(markoToken, "Tennis");
  const volleyball = await createGameAs(markoToken, "Volleyball");
  const football = await createGameAs(markoToken, "Football");
  // Sara's game, which Marko is accepted into
  const basketball = await createGameAs(saraToken, "Basketball");
  const joinRequest = await sendRequestAs(basketball, markoToken);
  await answerRequestAs(basketball, joinRequest, "accepted", saraToken);
  // A game Marko has nothing to do with
  await createGameAs(saraToken, "Football");

  await moveStartTime(padel, hoursFromNow(-100));
  await moveStartTime(tennis, hoursFromNow(-30));
  // Started half an hour ago and lasts 90 minutes: in progress
  await moveStartTime(volleyball, hoursFromNow(-0.5));

  const body = await getBody("/api/me/games", markoToken);

  const currentSports = body.currentGames.map((game) => game.sport);
  const finishedSports = body.finishedGames.map((game) => game.sport);
  assert.deepEqual(currentSports, ["Volleyball", "Football", "Basketball"]);
  assert.deepEqual(finishedSports, ["Tennis", "Padel"]);

  // Each game comes as the game page gives it, so the page can mark the
  // ones the user organizes and show the places left
  const [inProgress, own, joined] = body.currentGames;
  assert.equal(inProgress.status, "in progress");
  assert.equal(own.status, "upcoming");
  assert.equal(own.organizer.username, "marko_7");
  assert.equal(own._id, football._id);
  assert.equal(joined.organizer.username, "sara_b");
  assert.equal(joined.playerCount, 2);
  assert.equal(body.finishedGames[0].status, "finished");
});

test("a user gets their own join requests in every state, each with its game, and nobody else's", async () => {
  const football = await createGameAs(saraToken, "Football");
  const tennis = await createGameAs(saraToken, "Tennis");
  const padel = await createGameAs(saraToken, "Padel");
  const ivanToken = await registerUser("ivan_t", "ivan@example.com");

  const accepted = await sendRequestAs(football, ivanToken);
  const declined = await sendRequestAs(tennis, ivanToken);
  await sendRequestAs(padel, ivanToken);
  await answerRequestAs(football, accepted, "accepted", saraToken);
  await answerRequestAs(tennis, declined, "declined", saraToken);
  // Someone else's join request for the same game
  const elenaToken = await registerUser("elena_k", "elena@example.com");
  await sendRequestAs(padel, elenaToken);

  const body = await getBody("/api/me/join-requests", ivanToken);

  // Newest first
  const summary = body.joinRequests.map((joinRequest) => {
    return `${joinRequest.game.sport}: ${joinRequest.state}`;
  });
  assert.deepEqual(summary, [
    "Padel: pending",
    "Tennis: declined",
    "Football: accepted",
  ]);

  // Enough of the game to name it and link to it
  const first = body.joinRequests[0];
  assert.equal(first.game._id, padel._id);
  assert.equal(first.game.city, "Skopje");
  assert.equal(first.game.startTime, padel.startTime);
  assert.equal(first.user.username, "ivan_t");
});

// Noon on the 15th of the month that was this many months ago. The middle of
// a month is the same month in every time zone.
const midMonth = (monthsAgo) => {
  const now = new Date();
  // Date.UTC accepts a month below 0 and moves into the year before
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 15, 12));
};

// "2026-10"
const monthOf = (monthsAgo) => midMonth(monthsAgo).toISOString().slice(0, 7);

test("a user gets their finished games per month for the last six months, with the empty months too", async () => {
  const davidToken = await registerUser("david_m", "david@example.com");

  const first = await createGameAs(davidToken, "Football");
  const second = await createGameAs(davidToken, "Tennis");
  const third = await createGameAs(davidToken, "Padel");
  const tooOld = await createGameAs(davidToken, "Football");
  // Stays upcoming, so it is not history yet
  await createGameAs(davidToken, "Volleyball");
  // Finished last month, but David is not a player in it
  const sarasGame = await createGameAs(saraToken, "Basketball");

  await moveStartTime(first, midMonth(3));
  // The same month as the first, a day later
  await moveStartTime(second, new Date(midMonth(3).getTime() + DAY));
  await moveStartTime(third, midMonth(1));
  await moveStartTime(tooOld, midMonth(7));
  await moveStartTime(sarasGame, midMonth(1));

  const body = await getBody("/api/me/month-counts", davidToken);

  // Oldest month first, this month last
  assert.deepEqual(body.monthCounts, [
    { month: monthOf(5), count: 0 },
    { month: monthOf(4), count: 0 },
    { month: monthOf(3), count: 2 },
    { month: monthOf(2), count: 0 },
    { month: monthOf(1), count: 1 },
    { month: monthOf(0), count: 0 },
  ]);
});

test("the three My games routes are in the OpenAPI file", async () => {
  const body = await getBody("/api/swagger.json");

  assert.ok(body.paths["/api/me/games"].get);
  assert.ok(body.paths["/api/me/join-requests"].get);
  assert.ok(body.paths["/api/me/month-counts"].get);
});
