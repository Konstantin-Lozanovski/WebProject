import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/app.js";

// A database of its own: node runs the test files at the same time, and
// db.test.js empties every collection of the database it uses
const TEST_MONGO_URI = "mongodb://localhost:27017/pickup-games-users-test";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let server;
let baseUrl;
let petarToken;
let adminToken;
// The admin as the API returned them at registration
let admin;

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
  const registered = await registerUser("the_admin", "admin@example.com");
  admin = registered.user;
  adminToken = registered.token;
  await mongoose.connection
    .collection("users")
    .updateOne({ username: "the_admin" }, { $set: { role: "admin" } });

  petarToken = (await registerUser("petar_v", "petar@example.com")).token;
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

// Returns { user, token } as the API answered
const registerUser = async (username, email) => {
  const response = await send("POST", "/api/auth/register", null, {
    username,
    email,
    password: "football1",
  });
  assert.equal(response.status, 201);
  return response.json();
};

// Most tests delete or change a user, so each one registers its own.
// The number keeps the usernames and emails apart.
let userNumber = 0;
const registerNewUser = async () => {
  userNumber = userNumber + 1;
  return registerUser(`user_${userNumber}`, `user${userNumber}@example.com`);
};

const getUsers = (token) => {
  return send("GET", "/api/users", token);
};

// The user with this username as the list of users shows them, or undefined
const findInList = async (username) => {
  const response = await getUsers(adminToken);
  const users = (await response.json()).users;
  return users.find((user) => user.username === username);
};

test("an admin lists all users with username, email and role, and never a password", async () => {
  const response = await getUsers(adminToken);
  const body = await response.json();

  assert.equal(response.status, 200);

  const petar = body.users.find((user) => user.username === "petar_v");
  assert.equal(petar.email, "petar@example.com");
  assert.equal(petar.role, "user");
  assert.equal(petar.password, undefined);
  assert.equal((await findInList("the_admin")).role, "admin");
});

test("the list of users returns 403 to a user who is not an admin and 401 to a guest", async () => {
  const byUser = await getUsers(petarToken);
  const body = await byUser.json();
  const byGuest = await getUsers();

  assert.equal(byUser.status, 403);
  assert.equal(body.users, undefined);
  assert.equal(byGuest.status, 401);
});

const setRole = (user, role, token) => {
  return send("PUT", `/api/users/${user._id}`, token, { role });
};

test("an admin promotes a user to admin and demotes them again, and each change works on that user's next request", async () => {
  const { user, token } = await registerNewUser();
  assert.equal((await getUsers(token)).status, 403);

  const promote = await setRole(user, "admin", adminToken);
  const body = await promote.json();

  assert.equal(promote.status, 200);
  assert.equal(body.user._id, user._id);
  assert.equal(body.user.role, "admin");
  assert.equal(body.user.password, undefined);
  // The same token as before: the role is read from the database, not from it
  assert.equal((await getUsers(token)).status, 200);

  const demote = await setRole(user, "user", adminToken);

  assert.equal(demote.status, 200);
  assert.equal((await demote.json()).user.role, "user");
  assert.equal((await getUsers(token)).status, 403);
  assert.equal((await findInList(user.username)).role, "user");
});

test("an admin changing their own role gets 409 with a message and stays an admin", async () => {
  const response = await setRole(admin, "user", adminToken);
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.msg, "You cannot change your own role");
  assert.equal((await findInList("the_admin")).role, "admin");
});

test("changing a role returns 403 to a user who is not an admin, even for their own role, and 401 to a guest", async () => {
  const { user, token } = await registerNewUser();

  const byThemselves = await setRole(user, "admin", token);
  const byOtherUser = await setRole(user, "admin", petarToken);
  const byGuest = await setRole(user, "admin");

  assert.equal(byThemselves.status, 403);
  assert.equal(byOtherUser.status, 403);
  assert.equal(byGuest.status, 401);
  assert.equal((await findInList(user.username)).role, "user");
});

test("a role that is not user or admin returns 400, a user that does not exist 404", async () => {
  const { user } = await registerNewUser();

  const unknownRole = await setRole(user, "owner", adminToken);
  const body = await unknownRole.json();
  // The set is closed and exact: "Admin" is not "admin"
  const upperCase = await setRole(user, "Admin", adminToken);
  const notText = await setRole(user, 1, adminToken);
  const missing = await setRole(user, undefined, adminToken);
  const missingUser = await setRole({ _id: "66f1c0a4e3b2a1d4c5f6a7b8" }, "admin", adminToken);
  const notAnId = await setRole({ _id: "not-an-id" }, "admin", adminToken);

  assert.equal(unknownRole.status, 400);
  assert.equal(body.fields.role, "Role must be user or admin");
  assert.equal(upperCase.status, 400);
  assert.equal(notText.status, 400);
  assert.equal(missing.status, 400);
  assert.equal(missingUser.status, 404);
  assert.equal(notAnId.status, 400);
  assert.equal((await findInList(user.username)).role, "user");
});

const deleteUser = (user, token) => {
  return send("DELETE", `/api/users/${user._id}`, token);
};

test("an admin deletes a user: they are gone from the list and their token stops working at once", async () => {
  const { user, token } = await registerNewUser();
  assert.equal((await send("GET", "/api/auth/me", token)).status, 200);

  const response = await deleteUser(user, adminToken);

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(await findInList(user.username), undefined);
  assert.equal((await send("GET", "/api/auth/me", token)).status, 401);
  // Deleted once, so there is nothing left to delete
  assert.equal((await deleteUser(user, adminToken)).status, 404);
});

test("an admin deleting themselves gets 409 with a message and keeps their account", async () => {
  const response = await deleteUser(admin, adminToken);
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.msg, "You cannot delete your own account");
  assert.equal((await send("GET", "/api/auth/me", adminToken)).status, 200);
});

test("deleting a user returns 403 to a user who is not an admin, even for their own account, and 401 to a guest", async () => {
  const { user, token } = await registerNewUser();

  const byThemselves = await deleteUser(user, token);
  const byOtherUser = await deleteUser(user, petarToken);
  const byGuest = await deleteUser(user);
  const notAnId = await deleteUser({ _id: "not-an-id" }, adminToken);

  assert.equal(byThemselves.status, 403);
  assert.equal(byOtherUser.status, 403);
  assert.equal(byGuest.status, 401);
  assert.equal(notAnId.status, 400);
  assert.equal((await send("GET", "/api/auth/me", token)).status, 200);
});

// Every game gets its own day, so no two games of these tests overlap
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

const requestsPath = (game) => `/api/games/${game._id}/join-requests`;

// Sends a join request that must succeed and returns it as the API answered
const sendRequestAs = async (game, token) => {
  const response = await send("POST", requestsPath(game), token);
  assert.equal(response.status, 201);
  return (await response.json()).joinRequest;
};

// Makes the user a player the way the app does: they send a join request
// and the game's organizer accepts it
const joinGameAs = async (game, token, organizerToken) => {
  const joinRequest = await sendRequestAs(game, token);
  const answer = await send(
    "PUT",
    `${requestsPath(game)}/${joinRequest._id}`,
    organizerToken,
    { state: "accepted" },
  );
  assert.equal(answer.status, 200);
};

const postMessageAs = async (game, text, token) => {
  const response = await send("POST", `/api/games/${game._id}/messages`, token, {
    text,
  });
  assert.equal(response.status, 201);
};

const getGamePage = async (game) => {
  const response = await send("GET", `/api/games/${game._id}`);
  assert.equal(response.status, 200);
  return response.json();
};

const getMessages = async (game, token) => {
  const response = await send("GET", `/api/games/${game._id}/messages`, token);
  assert.equal(response.status, 200);
  return (await response.json()).messages;
};

// No route can show what belonged to a game that is gone, so this looks in
// the database
const countDocumentsOfGame = (collection, game) => {
  return mongoose.connection
    .collection(collection)
    .countDocuments({ game: new mongoose.Types.ObjectId(game._id) });
};

test("deleting a user deletes the upcoming games they organize, with everything belonging to those games", async () => {
  const organizer = await registerNewUser();
  const game = await createGameAs(organizer.token);
  const otherGame = await createGameAs(petarToken);
  await joinGameAs(game, petarToken, organizer.token);
  await sendRequestAs(game, adminToken);
  await postMessageAs(game, "See you there.", petarToken);

  const response = await deleteUser(organizer.user, adminToken);

  assert.equal(response.status, 204);
  assert.equal((await send("GET", `/api/games/${game._id}`)).status, 404);
  assert.equal(await countDocumentsOfGame("players", game), 0);
  assert.equal(await countDocumentsOfGame("joinrequests", game), 0);
  assert.equal(await countDocumentsOfGame("messages", game), 0);
  // The games of other users are left alone
  assert.equal((await getGamePage(otherGame)).game.playerCount, 1);
});

test("deleting a user frees their place in upcoming games and deletes their join requests", async () => {
  const marko = await registerNewUser();
  const joinedGame = await createGameAs(petarToken);
  const requestedGame = await createGameAs(petarToken);
  await joinGameAs(joinedGame, marko.token, petarToken);
  await sendRequestAs(requestedGame, marko.token);
  assert.equal((await getGamePage(joinedGame)).game.playerCount, 2);

  const response = await deleteUser(marko.user, adminToken);

  assert.equal(response.status, 204);

  const gamePage = await getGamePage(joinedGame);
  assert.equal(gamePage.game.playerCount, 1);
  assert.deepEqual(
    gamePage.players.map((player) => player.user.username),
    ["petar_v"],
  );

  const pending = await send("GET", requestsPath(requestedGame), petarToken);
  assert.deepEqual((await pending.json()).joinRequests, []);
  assert.equal(await countDocumentsOfGame("joinrequests", joinedGame), 0);
});

test("a deleted user's finished games, their players in finished games and their messages are kept, with no user", async () => {
  const marko = await registerNewUser();
  // One finished game Marko organized and one he was only a player in
  const organized = await createGameAs(marko.token);
  const joined = await createGameAs(petarToken);
  await joinGameAs(organized, petarToken, marko.token);
  await joinGameAs(joined, marko.token, petarToken);
  await postMessageAs(organized, "My pitch, my rules.", marko.token);
  await postMessageAs(joined, "Good game!", marko.token);
  await moveStartTime(organized, -3 * HOUR);
  await moveStartTime(joined, -5 * HOUR);

  const response = await deleteUser(marko.user, adminToken);

  assert.equal(response.status, 204);

  const organizedPage = await getGamePage(organized);
  assert.equal(organizedPage.game.status, "finished");
  assert.equal(organizedPage.game.organizer, null);
  assert.equal(organizedPage.game.playerCount, 2);
  // Oldest first: the organizer, who is gone, and then Petar
  assert.equal(organizedPage.players[0].user, null);
  assert.equal(organizedPage.players[1].user.username, "petar_v");

  const joinedPage = await getGamePage(joined);
  assert.equal(joinedPage.game.playerCount, 2);
  assert.equal(joinedPage.players[0].user.username, "petar_v");
  assert.equal(joinedPage.players[1].user, null);

  // Petar still reads both chats, with the messages of the deleted user in them
  const organizedChat = await getMessages(organized, petarToken);
  const joinedChat = await getMessages(joined, petarToken);
  assert.deepEqual(
    organizedChat.map((message) => [message.user, message.text]),
    [[null, "My pitch, my rules."]],
  );
  assert.deepEqual(
    joinedChat.map((message) => [message.user, message.text]),
    [[null, "Good game!"]],
  );
});

test("a game in progress is not upcoming: it is kept when its organizer or one of its players is deleted", async () => {
  const marko = await registerNewUser();
  const organized = await createGameAs(marko.token);
  const joined = await createGameAs(petarToken);
  await joinGameAs(joined, marko.token, petarToken);
  // Both started less than their 90 minutes ago
  await moveStartTime(organized, -0.5 * HOUR);
  await moveStartTime(joined, -1 * HOUR);

  const response = await deleteUser(marko.user, adminToken);

  assert.equal(response.status, 204);

  const organizedPage = await getGamePage(organized);
  assert.equal(organizedPage.game.status, "in progress");
  assert.equal(organizedPage.game.organizer, null);
  assert.equal((await getGamePage(joined)).game.playerCount, 2);
});

test("an admin can still edit and delete a kept game whose organizer was deleted", async () => {
  const marko = await registerNewUser();
  const game = await createGameAs(marko.token);
  await joinGameAs(game, petarToken, marko.token);
  await moveStartTime(game, -3 * HOUR);
  await deleteUser(marko.user, adminToken);
  const kept = (await getGamePage(game)).game;

  const edit = await send("PUT", `/api/games/${game._id}`, adminToken, {
    sport: kept.sport,
    city: kept.city,
    venue: "Another pitch",
    startTime: kept.startTime,
    duration: kept.duration,
    maxPlayers: kept.maxPlayers,
  });
  const body = await edit.json();

  assert.equal(edit.status, 200);
  assert.equal(body.game.venue, "Another pitch");
  assert.equal(body.game.organizer, null);

  const remove = await send("DELETE", `/api/games/${game._id}`, adminToken);
  assert.equal(remove.status, 204);
});

test("the user routes are in the OpenAPI file", async () => {
  const response = await send("GET", "/api/swagger.json");
  const body = await response.json();

  const all = body.paths["/api/users"];
  const one = body.paths["/api/users/{id}"];

  assert.ok(all.get.responses["200"]);
  assert.ok(all.get.responses["401"]);
  assert.ok(all.get.responses["403"]);

  assert.ok(one.put.responses["200"]);
  assert.ok(one.put.responses["400"]);
  assert.ok(one.put.responses["409"]);

  assert.ok(one.delete.responses["204"]);
  assert.ok(one.delete.responses["404"]);
  assert.ok(one.delete.responses["409"]);
});
