import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/app.js";

// A database of its own: node runs the test files at the same time, and
// db.test.js empties every collection of the database it uses
const TEST_MONGO_URI = "mongodb://localhost:27017/pickup-games-messages-test";

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

// Makes the user a player the way the app does: they send a join request
// and the organizer (Petar) accepts it. Returns the player.
const joinGameAs = async (game, token, username) => {
  const requestsPath = `/api/games/${game._id}/join-requests`;
  const response = await send("POST", requestsPath, token);
  assert.equal(response.status, 201);
  const joinRequest = (await response.json()).joinRequest;

  const answer = await send(
    "PUT",
    `${requestsPath}/${joinRequest._id}`,
    petarToken,
    { state: "accepted" },
  );
  assert.equal(answer.status, 200);

  const gamePage = await send("GET", `/api/games/${game._id}`);
  const players = (await gamePage.json()).players;
  return players.find((player) => player.user.username === username);
};

const chatPath = (game) => `/api/games/${game._id}/messages`;

const postMessage = (game, text, token) => {
  return send("POST", chatPath(game), token, { text });
};

// Posts a message that must succeed and returns it as the API answered
const postMessageAs = async (game, text, token) => {
  const response = await postMessage(game, text, token);
  assert.equal(response.status, 201);
  return (await response.json()).message;
};

const getChat = (game, token) => {
  return send("GET", chatPath(game), token);
};

// The texts of the game's chat, in the order the API returns them
const getChatTexts = async (game, token) => {
  const response = await getChat(game, token);
  assert.equal(response.status, 200);
  const messages = (await response.json()).messages;
  return messages.map((message) => message.text);
};

const deleteMessage = (game, message, token) => {
  return send("DELETE", `${chatPath(game)}/${message._id}`, token);
};

test("a player posts a message and every player of the game reads the chat, oldest first, with usernames", async () => {
  const game = await createGameAs(petarToken);
  await joinGameAs(game, markoToken, "marko_7");

  const response = await postMessage(game, "Pitch is booked from 18:00.", petarToken);
  const posted = (await response.json()).message;

  assert.equal(response.status, 201);
  assert.equal(posted.text, "Pitch is booked from 18:00.");
  assert.equal(posted.user.username, "petar_v");
  assert.equal(posted.game, game._id);
  assert.ok(posted.createdAt);

  await postMessageAs(game, "I can bring a ball.", markoToken);

  const chat = await getChat(game, markoToken);
  const messages = (await chat.json()).messages;

  assert.equal(chat.status, 200);
  assert.deepEqual(
    messages.map((message) => [message.user.username, message.text]),
    [
      ["petar_v", "Pitch is booked from 18:00."],
      ["marko_7", "I can bring a ball."],
    ],
  );
  assert.equal(messages[0]._id, posted._id);
});

test("a guest gets 401 and a logged-in user who is not a player gets 403, for reading and for posting", async () => {
  const game = await createGameAs(petarToken);
  await postMessageAs(game, "Players only.", petarToken);

  const guestReads = await getChat(game);
  const guestPosts = await postMessage(game, "Hello");
  const userReads = await getChat(game, markoToken);
  const body = await userReads.json();
  const userPosts = await postMessage(game, "Hello", markoToken);

  assert.equal(guestReads.status, 401);
  assert.equal(guestPosts.status, 401);
  assert.equal(userReads.status, 403);
  assert.equal(body.msg, "Only the players of this game can use its chat");
  // The refusal carries no messages
  assert.equal(body.messages, undefined);
  assert.equal(userPosts.status, 403);
  assert.deepEqual(await getChatTexts(game, petarToken), ["Players only."]);
});

test("a pending join request does not open the chat", async () => {
  const game = await createGameAs(petarToken);
  const request = await send("POST", `/api/games/${game._id}/join-requests`, markoToken);
  assert.equal(request.status, 201);

  const reads = await getChat(game, markoToken);
  const posts = await postMessage(game, "Hello", markoToken);

  assert.equal(reads.status, 403);
  assert.equal(posts.status, 403);
});

test("a user who left or was removed can no longer read or post, and their earlier messages stay", async () => {
  const game = await createGameAs(petarToken);
  const marko = await joinGameAs(game, markoToken, "marko_7");
  const sara = await joinGameAs(game, saraToken, "sara_b");
  await postMessageAs(game, "From Marko.", markoToken);
  await postMessageAs(game, "From Sara.", saraToken);

  const playersPath = `/api/games/${game._id}/players`;
  // Marko leaves, and Petar removes Sara
  const leave = await send("DELETE", `${playersPath}/${marko._id}`, markoToken);
  const remove = await send("DELETE", `${playersPath}/${sara._id}`, petarToken);
  assert.equal(leave.status, 204);
  assert.equal(remove.status, 204);

  assert.equal((await getChat(game, markoToken)).status, 403);
  assert.equal((await postMessage(game, "Still here?", markoToken)).status, 403);
  assert.equal((await getChat(game, saraToken)).status, 403);
  assert.equal((await postMessage(game, "Still here?", saraToken)).status, 403);

  const chat = await getChat(game, petarToken);
  const messages = (await chat.json()).messages;
  assert.deepEqual(
    messages.map((message) => [message.user.username, message.text]),
    [
      ["marko_7", "From Marko."],
      ["sara_b", "From Sara."],
    ],
  );
});

test("an admin reads every chat, but gets 403 when posting in a game they are not a player in", async () => {
  const game = await createGameAs(petarToken);
  await postMessageAs(game, "Players only.", petarToken);

  const reads = await getChat(game, adminToken);
  const posts = await postMessage(game, "From the admin.", adminToken);
  const body = await posts.json();

  assert.equal(reads.status, 200);
  assert.deepEqual(
    (await reads.json()).messages.map((message) => message.text),
    ["Players only."],
  );
  assert.equal(posts.status, 403);
  assert.equal(body.msg, "Only the players of this game can post in its chat");

  // An admin who is a player posts like any other player
  const adminGame = await createGameAs(adminToken);
  const asPlayer = await postMessage(adminGame, "My own game.", adminToken);
  assert.equal(asPlayer.status, 201);
});

test("a message is plain text of 1 to 500 characters: anything else returns 400 with a message for the text", async () => {
  const game = await createGameAs(petarToken);

  const longest = await postMessage(game, "a".repeat(500), petarToken);
  const tooLong = await postMessage(game, "a".repeat(501), petarToken);
  const body = await tooLong.json();
  const empty = await postMessage(game, "", petarToken);
  const onlySpaces = await postMessage(game, "   ", petarToken);
  const notText = await postMessage(game, 12345, petarToken);
  const missing = await postMessage(game, undefined, petarToken);

  assert.equal(longest.status, 201);
  assert.equal(tooLong.status, 400);
  assert.equal(body.fields.text, "Message must be 1 to 500 characters");
  assert.equal(empty.status, 400);
  assert.equal(onlySpaces.status, 400);
  assert.equal(notText.status, 400);
  assert.equal(missing.status, 400);

  // The spaces around a message are not part of it
  const padded = await postMessageAs(game, "  See you there  ", petarToken);
  assert.equal(padded.text, "See you there");

  assert.deepEqual(await getChatTexts(game, petarToken), [
    "a".repeat(500),
    "See you there",
  ]);
});

test("the chat of a game that does not exist returns 404, and an id that is not an id returns 400", async () => {
  const missingGame = { _id: "66f1c0a4e3b2a1d4c5f6a7b8" };
  const notAnId = { _id: "not-an-id" };

  assert.equal((await getChat(missingGame, petarToken)).status, 404);
  assert.equal((await postMessage(missingGame, "Hello", petarToken)).status, 404);
  assert.equal((await getChat(notAnId, petarToken)).status, 400);
  assert.equal((await postMessage(notAnId, "Hello", petarToken)).status, 400);
});

test("the chat works at any status: players still read and post after the game has finished", async () => {
  const game = await createGameAs(petarToken);
  await joinGameAs(game, markoToken, "marko_7");
  await postMessageAs(game, "See you tomorrow.", petarToken);

  // In progress: it started half an hour ago and lasts 90 minutes
  await moveStartTime(game, -0.5 * HOUR);
  await postMessageAs(game, "Where are you?", markoToken);

  // Finished
  await moveStartTime(game, -3 * HOUR);
  await postMessageAs(game, "Good game!", petarToken);

  assert.deepEqual(await getChatTexts(game, markoToken), [
    "See you tomorrow.",
    "Where are you?",
    "Good game!",
  ]);
});

test("a player deletes their own message; another player, even the organizer, gets 403 and a guest 401", async () => {
  const game = await createGameAs(petarToken);
  await joinGameAs(game, markoToken, "marko_7");
  await joinGameAs(game, saraToken, "sara_b");
  const message = await postMessageAs(game, "From Marko.", markoToken);
  await postMessageAs(game, "From Petar.", petarToken);

  const byGuest = await deleteMessage(game, message);
  const byOtherPlayer = await deleteMessage(game, message, saraToken);
  const body = await byOtherPlayer.json();
  const byOrganizer = await deleteMessage(game, message, petarToken);

  assert.equal(byGuest.status, 401);
  assert.equal(byOtherPlayer.status, 403);
  assert.equal(body.msg, "You can only delete your own messages");
  assert.equal(byOrganizer.status, 403);
  assert.equal((await getChatTexts(game, petarToken)).length, 2);

  const byAuthor = await deleteMessage(game, message, markoToken);

  assert.equal(byAuthor.status, 204);
  assert.equal(await byAuthor.text(), "");
  assert.deepEqual(await getChatTexts(game, petarToken), ["From Petar."]);
});

test("an admin deletes any message, at any status", async () => {
  const game = await createGameAs(petarToken);
  const message = await postMessageAs(game, "Something rude.", petarToken);
  await moveStartTime(game, -3 * HOUR);

  const response = await deleteMessage(game, message, adminToken);

  assert.equal(response.status, 204);
  assert.deepEqual(await getChatTexts(game, petarToken), []);
});

test("a user who left the game can no longer delete the messages they posted in it", async () => {
  const game = await createGameAs(petarToken);
  const marko = await joinGameAs(game, markoToken, "marko_7");
  const message = await postMessageAs(game, "From Marko.", markoToken);
  const leave = await send(
    "DELETE",
    `/api/games/${game._id}/players/${marko._id}`,
    markoToken,
  );
  assert.equal(leave.status, 204);

  const response = await deleteMessage(game, message, markoToken);

  assert.equal(response.status, 403);
  assert.deepEqual(await getChatTexts(game, petarToken), ["From Marko."]);
});

test("a message is deleted through its own game: a wrong game or message returns 404, and there is no way to edit one", async () => {
  const game = await createGameAs(petarToken);
  const otherGame = await createGameAs(petarToken);
  const message = await postMessageAs(game, "Hello", petarToken);

  const throughOtherGame = await deleteMessage(otherGame, message, petarToken);
  const missingMessage = await deleteMessage(game, { _id: "66f1c0a4e3b2a1d4c5f6a7b8" }, petarToken);
  const missingGame = await deleteMessage({ _id: "66f1c0a4e3b2a1d4c5f6a7b8" }, message, petarToken);
  const notAnId = await deleteMessage(game, { _id: "not-an-id" }, petarToken);
  const edit = await send("PUT", `${chatPath(game)}/${message._id}`, petarToken, {
    text: "Changed",
  });

  assert.equal(throughOtherGame.status, 404);
  assert.equal(missingMessage.status, 404);
  assert.equal(missingGame.status, 404);
  assert.equal(notAnId.status, 400);
  assert.equal(edit.status, 404);
  assert.deepEqual(await getChatTexts(game, petarToken), ["Hello"]);
});

test("the message routes are in the OpenAPI file", async () => {
  const response = await send("GET", "/api/swagger.json");
  const body = await response.json();

  const chat = body.paths["/api/games/{gameId}/messages"];
  const one = body.paths["/api/games/{gameId}/messages/{messageId}"];

  assert.ok(chat.get.responses["200"]);
  assert.ok(chat.get.responses["403"]);

  assert.ok(chat.post.responses["201"]);
  assert.ok(chat.post.responses["400"]);
  assert.ok(chat.post.responses["403"]);

  assert.ok(one.delete.responses["204"]);
  assert.ok(one.delete.responses["403"]);
  assert.ok(one.delete.responses["404"]);

  assert.ok(body.components.schemas.Message.properties.text);
});

test("cancelling a game deletes its messages, and leaves the chats of other games alone", async () => {
  const game = await createGameAs(petarToken);
  const otherGame = await createGameAs(petarToken);
  await joinGameAs(game, markoToken, "marko_7");
  await postMessageAs(game, "From Petar.", petarToken);
  await postMessageAs(game, "From Marko.", markoToken);
  await postMessageAs(otherGame, "Another chat.", petarToken);

  const response = await send("DELETE", `/api/games/${game._id}`, petarToken);

  assert.equal(response.status, 204);
  assert.equal((await getChat(game, petarToken)).status, 404);

  // No route can show the messages of a game that is gone, so the test
  // looks in the database
  const messagesLeft = await mongoose.connection
    .collection("messages")
    .countDocuments({ game: new mongoose.Types.ObjectId(game._id) });
  assert.equal(messagesLeft, 0);
  assert.deepEqual(await getChatTexts(otherGame, petarToken), ["Another chat."]);
});
