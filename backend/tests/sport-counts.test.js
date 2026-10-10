import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/app.js";

// A database of its own: node runs the test files at the same time, and the
// counts here are only right when no other test adds a game
const TEST_MONGO_URI = "mongodb://localhost:27017/pickup-games-sport-counts-test";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let server;
let baseUrl;
let markoToken;

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
});

after(async () => {
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

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

// Creates a game of the sport that starts this many days from now, and
// returns it as the API answered. Each game is on a day of its own, so
// nothing overlaps.
const createGame = async (sport, days) => {
  const response = await post(
    "/api/games",
    {
      sport,
      city: "Skopje",
      venue: "Sports Center Boris Trajkovski, pitch 2",
      startTime: new Date(Date.now() + days * DAY).toISOString(),
      duration: 90,
      maxPlayers: 10,
    },
    markoToken,
  );
  assert.equal(response.status, 201);
  return (await response.json()).game;
};

test("with no games, a guest gets all five sports with a count of zero", async () => {
  const response = await get("/api/games/sport-counts");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.sportCounts, [
    { sport: "Football", count: 0 },
    { sport: "Basketball", count: 0 },
    { sport: "Volleyball", count: 0 },
    { sport: "Tennis", count: 0 },
    { sport: "Padel", count: 0 },
  ]);
});

test("every game is counted under its sport, whatever its status", async () => {
  await createGame("Football", 3);
  await createGame("Football", 4);
  await createGame("Padel", 5);

  // The API refuses a start in the past, so a finished game can only be
  // made by moving its start in the database
  const finishedGame = await createGame("Tennis", 6);
  await mongoose.connection
    .collection("games")
    .updateOne(
      { _id: new mongoose.Types.ObjectId(finishedGame._id) },
      { $set: { startTime: new Date(Date.now() - 5 * HOUR) } },
    );

  const response = await get("/api/games/sport-counts");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.sportCounts, [
    { sport: "Football", count: 2 },
    { sport: "Basketball", count: 0 },
    { sport: "Volleyball", count: 0 },
    { sport: "Tennis", count: 1 },
    { sport: "Padel", count: 1 },
  ]);
});
