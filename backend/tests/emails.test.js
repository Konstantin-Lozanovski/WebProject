import { test, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/app.js";

// A database of its own: node runs the test files at the same time, and
// db.test.js empties every collection of the database it uses
const TEST_MONGO_URI = "mongodb://localhost:27017/pickup-games-emails-test";

const DAY = 24 * 60 * 60 * 1000;

let server;
let baseUrl;
// The organizer of every game in these tests
let petarToken;
let markoToken;
let saraToken;
let adminToken;

// The tests run with no mail settings, so every email is written to the
// server log. Replacing console.log is how a test reads what was "sent".
const log = mock.method(console, "log", () => {});

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

// Every test starts with an empty log, so it only sees its own emails
beforeEach(() => {
  log.mock.resetCalls();
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

// Creates a game through the API and returns it as the API answered.
// It starts at 16:30 UTC, which the clocks in Macedonia show as 18:30 in
// summer and 17:30 in winter.
const createGameAs = async (token) => {
  nextDay = nextDay + 1;
  // toISOString gives "2026-10-13T09:15:00.000Z"; the first 10 characters
  // are the day
  const day = new Date(Date.now() + nextDay * DAY).toISOString().slice(0, 10);

  const game = {
    sport: "Football",
    city: "Bitola",
    venue: "Sports Hall Mladost, pitch 2",
    startTime: `${day}T16:30:00Z`,
    duration: 90,
    maxPlayers: 10,
  };
  const response = await send("POST", "/api/games", token, game);
  assert.equal(response.status, 201);
  return (await response.json()).game;
};

// Sends a join request and returns it as the API answered
const sendRequest = async (game, token) => {
  const response = await send("POST", `/api/games/${game._id}/join-requests`, token);
  assert.equal(response.status, 201);
  return (await response.json()).joinRequest;
};

const answerRequest = (game, joinRequest, token, state) => {
  const path = `/api/games/${game._id}/join-requests/${joinRequest._id}`;
  return send("PUT", path, token, { state });
};

// The text of every email written to the log for the given address
const emailsTo = (address) => {
  const texts = log.mock.calls.map((call) => String(call.arguments[0]));
  return texts.filter((text) => text.includes(`To: ${address}\n`));
};

// Throws unless the text names the game created by createGameAs
const assertNamesTheGame = (text) => {
  assert.match(text, /Football/);
  assert.match(text, /Bitola/);
  assert.match(text, /Sports Hall Mladost, pitch 2/);
  // The time in Macedonia, never the 16:30 of the server's UTC clock
  assert.match(text, /at (17|18):30/);
};

test("registering writes a welcome email for the new user to the log", async () => {
  const response = await send("POST", "/api/auth/register", null, {
    username: "nina_k",
    email: "nina@example.com",
    password: "football1",
  });

  assert.equal(response.status, 201);
  const emails = emailsTo("nina@example.com");
  assert.equal(emails.length, 1);
  assert.match(emails[0], /Subject: Welcome to Pickup Game Organizer/);
  assert.match(emails[0], /nina_k/);
});

test("sending a join request writes an email for the organizer that names the user and the game", async () => {
  const game = await createGameAs(petarToken);
  log.mock.resetCalls();

  await sendRequest(game, markoToken);

  const emails = emailsTo("petar@example.com");
  assert.equal(emails.length, 1);
  assert.match(emails[0], /Subject: marko_7 wants to join your game/);
  assertNamesTheGame(emails[0]);
  // Only the organizer is told
  assert.equal(emailsTo("marko@example.com").length, 0);
});

test("accepting a join request writes a you're in email for the accepted user", async () => {
  const game = await createGameAs(petarToken);
  const joinRequest = await sendRequest(game, markoToken);
  log.mock.resetCalls();

  const response = await answerRequest(game, joinRequest, petarToken, "accepted");

  assert.equal(response.status, 200);
  const emails = emailsTo("marko@example.com");
  assert.equal(emails.length, 1);
  assert.match(emails[0], /Subject: You're in/);
  assertNamesTheGame(emails[0]);
  // The answer still shows the user without their email
  const body = await response.json();
  assert.equal(body.joinRequest.user.email, undefined);
});

test("declining a join request writes no email", async () => {
  const game = await createGameAs(petarToken);
  const joinRequest = await sendRequest(game, markoToken);
  log.mock.resetCalls();

  const response = await answerRequest(game, joinRequest, petarToken, "declined");

  assert.equal(response.status, 200);
  assert.equal(emailsTo("marko@example.com").length, 0);
});

// Makes the user a player in the game: a join request, accepted by the organizer
const addPlayer = async (game, organizerToken, token) => {
  const joinRequest = await sendRequest(game, token);
  const response = await answerRequest(game, joinRequest, organizerToken, "accepted");
  assert.equal(response.status, 200);
};

test("cancelling a game writes an email for each of its players except the organizer who cancelled it", async () => {
  const game = await createGameAs(petarToken);
  await addPlayer(game, petarToken, markoToken);
  await addPlayer(game, petarToken, saraToken);
  log.mock.resetCalls();

  const response = await send("DELETE", `/api/games/${game._id}`, petarToken);

  assert.equal(response.status, 204);
  const markoEmails = emailsTo("marko@example.com");
  assert.equal(markoEmails.length, 1);
  assert.match(markoEmails[0], /Subject: Your game was cancelled/);
  assertNamesTheGame(markoEmails[0]);
  assert.equal(emailsTo("sara@example.com").length, 1);
  assert.equal(emailsTo("petar@example.com").length, 0);
});

test("a user with only a pending join request gets no email when the game is cancelled", async () => {
  const game = await createGameAs(petarToken);
  await sendRequest(game, markoToken);
  log.mock.resetCalls();

  const response = await send("DELETE", `/api/games/${game._id}`, petarToken);

  assert.equal(response.status, 204);
  assert.equal(emailsTo("marko@example.com").length, 0);
});

test("an admin deleting a game writes an email for its organizer and its other players, not for the admin", async () => {
  const game = await createGameAs(petarToken);
  await addPlayer(game, petarToken, markoToken);
  log.mock.resetCalls();

  const response = await send("DELETE", `/api/games/${game._id}`, adminToken);

  assert.equal(response.status, 204);
  assert.equal(emailsTo("petar@example.com").length, 1);
  assert.equal(emailsTo("marko@example.com").length, 1);
  assert.equal(emailsTo("admin@example.com").length, 0);
});

test("deleting an organizer writes a cancelled email for the players of their upcoming game, not for the deleted user", async () => {
  const leavingToken = await registerUser("leaving_org", "leaving@example.com");
  const game = await createGameAs(leavingToken);
  await addPlayer(game, leavingToken, markoToken);
  const me = await send("GET", "/api/auth/me", leavingToken);
  const leavingId = (await me.json()).user._id;
  log.mock.resetCalls();

  const response = await send("DELETE", `/api/users/${leavingId}`, adminToken);

  assert.equal(response.status, 204);
  const emails = emailsTo("marko@example.com");
  assert.equal(emails.length, 1);
  assert.match(emails[0], /Subject: Your game was cancelled/);
  assertNamesTheGame(emails[0]);
  assert.equal(emailsTo("leaving@example.com").length, 0);
  assert.equal(emailsTo("admin@example.com").length, 0);
});

test("an admin deleting a game that already started writes no email", async () => {
  const game = await createGameAs(petarToken);
  await addPlayer(game, petarToken, markoToken);
  // The API refuses a start in the past, so it is moved in the database
  await mongoose.connection
    .collection("games")
    .updateOne(
      { _id: new mongoose.Types.ObjectId(game._id) },
      { $set: { startTime: new Date(Date.now() - 3 * DAY) } },
    );
  log.mock.resetCalls();

  const response = await send("DELETE", `/api/games/${game._id}`, adminToken);

  assert.equal(response.status, 204);
  assert.equal(emailsTo("petar@example.com").length, 0);
  assert.equal(emailsTo("marko@example.com").length, 0);
});
