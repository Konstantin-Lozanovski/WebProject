import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/app.js";

// A database of its own: node runs the test files at the same time, and
// db.test.js empties every collection of the database it uses
const TEST_MONGO_URI = "mongodb://localhost:27017/pickup-games-players-test";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let server;
let baseUrl;
// The organizer of every game in these tests
let petarToken;
let markoToken;
let saraToken;
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

  petarToken = await registerUser("petar_v", "petar@example.com");
  markoToken = await registerUser("marko_7", "marko@example.com");
  saraToken = await registerUser("sara_b", "sara@example.com");

  // Nobody can register as an admin, so the role is set in the database
  adminToken = await registerUser("the_admin", "admin@example.com");
  await mongoose.connection
    .collection("users")
    .updateOne({ username: "the_admin" }, { $set: { role: "admin" } });
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
  const body = await response.json();
  return body.token;
};

// Every test gets its own day, so the games of one test never overlap the
// games of another
let nextDay = 3;
const nextFreeStart = () => {
  nextDay = nextDay + 1;
  return Date.now() + nextDay * DAY;
};

// Creates a game through the API and returns it as the API answered
const createGameAs = async (token) => {
  const game = {
    sport: "Football",
    city: "Skopje",
    venue: "Sports Center Boris Trajkovski, pitch 2",
    startTime: new Date(nextFreeStart()).toISOString(),
    duration: 90,
    maxPlayers: 10,
  };
  const response = await send("POST", "/api/games", token, game);
  assert.equal(response.status, 201);
  return (await response.json()).game;
};

// The API refuses a start in the past or less than 2 hours away, so such a
// game can only be made by moving its start in the database
const moveStartTime = async (game, milliseconds) => {
  await mongoose.connection
    .collection("games")
    .updateOne(
      { _id: new mongoose.Types.ObjectId(game._id) },
      { $set: { startTime: new Date(Date.now() + milliseconds) } },
    );
};

const requestsPath = (game) => `/api/games/${game._id}/join-requests`;

const sendRequest = (game, token) => {
  return send("POST", requestsPath(game), token);
};

// The user's own join request for the game, or null
const getMyRequest = async (game, token) => {
  const response = await send("GET", `${requestsPath(game)}/mine`, token);
  assert.equal(response.status, 200);
  return (await response.json()).joinRequest;
};

const getGamePage = async (game) => {
  const response = await send("GET", `/api/games/${game._id}`);
  return response.json();
};

// The player of the game with this username, as the game page lists them
const getPlayer = async (game, username) => {
  const gamePage = await getGamePage(game);
  return gamePage.players.find((player) => player.user.username === username);
};

// Makes the user a player the way the app does: they send a join request
// and the organizer (Petar) accepts it. Returns the player.
const joinGameAs = async (game, token, username) => {
  const response = await sendRequest(game, token);
  assert.equal(response.status, 201);
  const joinRequest = (await response.json()).joinRequest;

  const answer = await send(
    "PUT",
    `${requestsPath(game)}/${joinRequest._id}`,
    petarToken,
    { state: "accepted" },
  );
  assert.equal(answer.status, 200);

  return getPlayer(game, username);
};

// Leaving and removing are the same request; the token says who asks
const deletePlayer = (game, player, token) => {
  return send("DELETE", `/api/games/${game._id}/players/${player._id}`, token);
};

test("a player leaves a game: the place is freed and they can send a new join request", async () => {
  const game = await createGameAs(petarToken);
  const marko = await joinGameAs(game, markoToken, "marko_7");

  const response = await deletePlayer(game, marko, markoToken);

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");

  const gamePage = await getGamePage(game);
  assert.equal(gamePage.game.playerCount, 1);
  assert.deepEqual(
    gamePage.players.map((player) => player.user.username),
    ["petar_v"],
  );
  // The join request went with the player
  assert.equal(await getMyRequest(game, markoToken), null);

  const again = await sendRequest(game, markoToken);
  assert.equal(again.status, 201);
});

test("the organizer removes a player; another user gets 403 and a guest 401", async () => {
  const game = await createGameAs(petarToken);
  const marko = await joinGameAs(game, markoToken, "marko_7");
  await joinGameAs(game, saraToken, "sara_b");

  const byGuest = await deletePlayer(game, marko);
  // Sara is a player too, but only the organizer removes players
  const byOtherPlayer = await deletePlayer(game, marko, saraToken);
  const body = await byOtherPlayer.json();

  assert.equal(byGuest.status, 401);
  assert.equal(byOtherPlayer.status, 403);
  assert.equal(body.msg, "Only the organizer can remove a player from this game");
  assert.equal((await getGamePage(game)).game.playerCount, 3);

  const byOrganizer = await deletePlayer(game, marko, petarToken);

  assert.equal(byOrganizer.status, 204);
  assert.equal(await getPlayer(game, "marko_7"), undefined);
  assert.equal(await getMyRequest(game, markoToken), null);
  assert.equal((await getGamePage(game)).game.playerCount, 2);
});

test("a player is deleted through their own game: a wrong game or player returns 404", async () => {
  const game = await createGameAs(petarToken);
  const otherGame = await createGameAs(petarToken);
  const marko = await joinGameAs(game, markoToken, "marko_7");

  const throughOtherGame = await deletePlayer(otherGame, marko, petarToken);
  const missingPlayer = await deletePlayer(game, { _id: "66f1c0a4e3b2a1d4c5f6a7b8" }, petarToken);
  const missingGame = await deletePlayer({ _id: "66f1c0a4e3b2a1d4c5f6a7b8" }, marko, petarToken);
  const notAnId = await deletePlayer(game, { _id: "not-an-id" }, petarToken);

  assert.equal(throughOtherGame.status, 404);
  assert.equal(missingPlayer.status, 404);
  assert.equal(missingGame.status, 404);
  assert.equal(notAnId.status, 400);
  assert.equal((await getGamePage(game)).game.playerCount, 2);
});

test("the organizer cannot leave or be removed from their own game, not even by an admin", async () => {
  const game = await createGameAs(petarToken);
  await joinGameAs(game, markoToken, "marko_7");
  const petar = await getPlayer(game, "petar_v");

  const leaving = await deletePlayer(game, petar, petarToken);
  const body = await leaving.json();
  const byAdmin = await deletePlayer(game, petar, adminToken);
  // Marko may not remove anyone, which is said before anything about the organizer
  const byPlayer = await deletePlayer(game, petar, markoToken);

  assert.equal(leaving.status, 409);
  assert.equal(
    body.msg,
    "The organizer cannot leave or be removed from their own game. Cancel the game instead.",
  );
  assert.equal(byAdmin.status, 409);
  assert.equal(byPlayer.status, 403);
  assert.equal((await getGamePage(game)).players[0].user.username, "petar_v");
});

test("leaving and removing are refused in the last hour before the start and after it, except for an admin", async () => {
  const game = await createGameAs(petarToken);
  const marko = await joinGameAs(game, markoToken, "marko_7");
  const sara = await joinGameAs(game, saraToken, "sara_b");

  // Just over an hour before the start is still allowed
  await moveStartTime(game, 1 * HOUR + 60 * 1000);
  const inTime = await deletePlayer(game, sara, saraToken);
  assert.equal(inTime.status, 204);

  await moveStartTime(game, 0.5 * HOUR);
  const leaveTooLate = await deletePlayer(game, marko, markoToken);
  const body = await leaveTooLate.json();
  const removeTooLate = await deletePlayer(game, marko, petarToken);

  assert.equal(leaveTooLate.status, 409);
  assert.match(body.msg, /one hour before the game starts/);
  assert.equal(removeTooLate.status, 409);

  await moveStartTime(game, -0.5 * HOUR);
  const leaveAfterStart = await deletePlayer(game, marko, markoToken);
  const removeAfterStart = await deletePlayer(game, marko, petarToken);

  assert.equal(leaveAfterStart.status, 409);
  assert.equal(removeAfterStart.status, 409);
  // Every refusal left Marko a player with his join request
  assert.equal((await getGamePage(game)).game.playerCount, 2);
  assert.equal((await getMyRequest(game, markoToken)).state, "accepted");

  const byAdmin = await deletePlayer(game, marko, adminToken);
  assert.equal(byAdmin.status, 204);
  assert.equal((await getGamePage(game)).game.playerCount, 1);
  assert.equal(await getMyRequest(game, markoToken), null);
});

test("the player route is in the OpenAPI file", async () => {
  const response = await send("GET", "/api/swagger.json");
  const body = await response.json();

  const one = body.paths["/api/games/{gameId}/players/{playerId}"];

  assert.ok(one.delete.responses["204"]);
  assert.ok(one.delete.responses["403"]);
  assert.ok(one.delete.responses["409"]);
});
