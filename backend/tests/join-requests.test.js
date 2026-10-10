import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/app.js";

// A database of its own: node runs the test files at the same time, and
// db.test.js empties every collection of the database it uses
const TEST_MONGO_URI = "mongodb://localhost:27017/pickup-games-join-requests-test";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let server;
let baseUrl;
// The organizer of every game in these tests
let petarToken;
let markoToken;
let saraToken;
let ninaToken;
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
  ninaToken = await registerUser("nina_k", "nina@example.com");

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
const createGameAs = async (token, changes) => {
  const game = {
    sport: "Football",
    city: "Skopje",
    venue: "Sports Center Boris Trajkovski, pitch 2",
    startTime: new Date(nextFreeStart()).toISOString(),
    duration: 90,
    maxPlayers: 10,
    ...changes,
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

// Sends a join request and returns it as the API answered
const sendRequestAs = async (game, token) => {
  const response = await sendRequest(game, token);
  assert.equal(response.status, 201);
  return (await response.json()).joinRequest;
};

const answerRequest = (game, joinRequest, state, token) => {
  return send("PUT", `${requestsPath(game)}/${joinRequest._id}`, token, { state });
};

const withdrawRequest = (game, joinRequest, token) => {
  return send("DELETE", `${requestsPath(game)}/${joinRequest._id}`, token);
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

test("a logged-in user sends a join request and sees it as pending", async () => {
  const game = await createGameAs(petarToken);

  assert.equal(await getMyRequest(game, markoToken), null);

  const response = await sendRequest(game, markoToken);
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.joinRequest.state, "pending");
  assert.equal(body.joinRequest.user.username, "marko_7");
  assert.equal(body.joinRequest.game, game._id);

  const mine = await getMyRequest(game, markoToken);
  assert.equal(mine._id, body.joinRequest._id);
  assert.equal(mine.state, "pending");

  // A pending request takes no place in the game
  assert.equal((await getGamePage(game)).game.playerCount, 1);
});

test("a second join request for the same game is refused with 409", async () => {
  const game = await createGameAs(petarToken);
  await sendRequestAs(game, markoToken);

  const again = await sendRequest(game, markoToken);
  const body = await again.json();

  assert.equal(again.status, 409);
  assert.equal(body.msg, "You already have a join request for this game");
});

test("the unique index refuses a second join request for the same user and game", async () => {
  const game = await createGameAs(petarToken);
  const joinRequest = await sendRequestAs(game, markoToken);

  // Written straight to the database, past the check the route does itself
  const insertCopy = mongoose.connection.collection("joinrequests").insertOne({
    user: new mongoose.Types.ObjectId(joinRequest.user._id),
    game: new mongoose.Types.ObjectId(game._id),
    state: "pending",
  });

  await assert.rejects(insertCopy, { code: 11000 });
});

test("a player of the game, its organizer included, cannot send it a join request", async () => {
  const game = await createGameAs(petarToken);

  const response = await sendRequest(game, petarToken);
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.msg, "You are already a player in this game");
});

test("a guest cannot send a join request, and a game that does not exist returns 404", async () => {
  const game = await createGameAs(petarToken);

  const asGuest = await sendRequest(game);
  const missingGame = await sendRequest({ _id: "66f1c0a4e3b2a1d4c5f6a7b8" }, markoToken);
  const notAnId = await sendRequest({ _id: "not-an-id" }, markoToken);

  assert.equal(asGuest.status, 401);
  assert.equal(missingGame.status, 404);
  assert.equal(notAnId.status, 400);
});

test("a join request cannot be sent to a game that has started, except by an admin", async () => {
  const game = await createGameAs(petarToken);
  await moveStartTime(game, -0.5 * HOUR);

  const asUser = await sendRequest(game, markoToken);
  const body = await asUser.json();
  const asAdmin = await sendRequest(game, adminToken);

  assert.equal(asUser.status, 409);
  assert.match(body.msg, /already started/);
  assert.equal(asAdmin.status, 201);
});

// The pending join requests of the game, as the given user gets them
const getPendingRequests = (game, token) => {
  return send("GET", requestsPath(game), token);
};

test("the organizer and an admin see the pending join requests, oldest first; nobody else can read them", async () => {
  const game = await createGameAs(petarToken);
  await sendRequestAs(game, markoToken);
  await sendRequestAs(game, saraToken);

  const asOrganizer = await getPendingRequests(game, petarToken);
  const body = await asOrganizer.json();
  const asAdmin = await getPendingRequests(game, adminToken);
  const asRequester = await getPendingRequests(game, markoToken);
  const asGuest = await getPendingRequests(game);

  assert.equal(asOrganizer.status, 200);
  assert.deepEqual(
    body.joinRequests.map((joinRequest) => joinRequest.user.username),
    ["marko_7", "sara_b"],
  );
  // Nothing private about the account comes along with the username
  assert.equal(body.joinRequests[0].user.email, undefined);
  assert.equal(asAdmin.status, 200);
  assert.equal((await asAdmin.json()).joinRequests.length, 2);
  assert.equal(asRequester.status, 403);
  assert.equal(asGuest.status, 401);
});

test("accepting a join request makes the user an unassigned player and takes one place", async () => {
  const game = await createGameAs(petarToken);
  const joinRequest = await sendRequestAs(game, markoToken);

  const response = await answerRequest(game, joinRequest, "accepted", petarToken);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.joinRequest.state, "accepted");

  const gamePage = await getGamePage(game);
  assert.equal(gamePage.game.playerCount, 2);
  assert.equal(gamePage.players[1].user.username, "marko_7");
  assert.equal(gamePage.players[1].team, "unassigned");

  // Marko sees the answer, and the request left the organizer's list
  assert.equal((await getMyRequest(game, markoToken)).state, "accepted");
  const pending = await getPendingRequests(game, petarToken);
  assert.deepEqual((await pending.json()).joinRequests, []);
});

test("declining keeps the join request as declined, and the user cannot send another", async () => {
  const game = await createGameAs(petarToken);
  const joinRequest = await sendRequestAs(game, markoToken);

  const response = await answerRequest(game, joinRequest, "declined", petarToken);

  assert.equal(response.status, 200);
  assert.equal((await response.json()).joinRequest.state, "declined");
  assert.equal((await getMyRequest(game, markoToken)).state, "declined");
  assert.equal((await getGamePage(game)).game.playerCount, 1);

  const again = await sendRequest(game, markoToken);
  assert.equal(again.status, 409);
  assert.match((await again.json()).msg, /was declined/);
});

test("only the organizer or an admin can accept or decline: others get 403 and a guest 401", async () => {
  const game = await createGameAs(petarToken);
  const markoRequest = await sendRequestAs(game, markoToken);
  const saraRequest = await sendRequestAs(game, saraToken);

  const byRequester = await answerRequest(game, markoRequest, "accepted", markoToken);
  const byOtherUser = await answerRequest(game, markoRequest, "declined", ninaToken);
  const byGuest = await answerRequest(game, markoRequest, "accepted");

  assert.equal(byRequester.status, 403);
  assert.equal(byOtherUser.status, 403);
  assert.equal(byGuest.status, 401);
  assert.equal((await getMyRequest(game, markoToken)).state, "pending");

  const acceptByAdmin = await answerRequest(game, markoRequest, "accepted", adminToken);
  const declineByAdmin = await answerRequest(game, saraRequest, "declined", adminToken);

  assert.equal(acceptByAdmin.status, 200);
  assert.equal(declineByAdmin.status, 200);
});

test("an answer must be accepted or declined, for a join request of that game", async () => {
  const game = await createGameAs(petarToken);
  const otherGame = await createGameAs(petarToken);
  const joinRequest = await sendRequestAs(game, markoToken);

  const backToPending = await answerRequest(game, joinRequest, "pending", petarToken);
  const madeUp = await answerRequest(game, joinRequest, "maybe", petarToken);
  const body = await madeUp.json();
  const throughOtherGame = await answerRequest(otherGame, joinRequest, "accepted", petarToken);
  const missing = await answerRequest(game, { _id: "66f1c0a4e3b2a1d4c5f6a7b8" }, "accepted", petarToken);

  assert.equal(backToPending.status, 400);
  assert.equal(madeUp.status, 400);
  assert.equal(body.fields.state, "State must be accepted or declined");
  assert.equal(throughOtherGame.status, 404);
  assert.equal(missing.status, 404);
});

test("a join request is answered once: an accepted or declined one cannot be answered again", async () => {
  const game = await createGameAs(petarToken);
  const markoRequest = await sendRequestAs(game, markoToken);
  const saraRequest = await sendRequestAs(game, saraToken);
  await answerRequest(game, markoRequest, "accepted", petarToken);
  await answerRequest(game, saraRequest, "declined", petarToken);

  const acceptAgain = await answerRequest(game, markoRequest, "accepted", petarToken);
  const declineAccepted = await answerRequest(game, markoRequest, "declined", petarToken);
  const acceptDeclined = await answerRequest(game, saraRequest, "accepted", adminToken);

  assert.equal(acceptAgain.status, 409);
  assert.equal(declineAccepted.status, 409);
  assert.equal(acceptDeclined.status, 409);
  assert.equal((await getGamePage(game)).game.playerCount, 2);
});

test("a join request cannot be answered once the game has started, except by an admin", async () => {
  const game = await createGameAs(petarToken);
  const markoRequest = await sendRequestAs(game, markoToken);
  const saraRequest = await sendRequestAs(game, saraToken);
  await moveStartTime(game, -0.5 * HOUR);

  const accept = await answerRequest(game, markoRequest, "accepted", petarToken);
  const decline = await answerRequest(game, saraRequest, "declined", petarToken);

  assert.equal(accept.status, 409);
  assert.match((await accept.json()).msg, /already started/);
  assert.equal(decline.status, 409);

  const acceptByAdmin = await answerRequest(game, markoRequest, "accepted", adminToken);
  const declineByAdmin = await answerRequest(game, saraRequest, "declined", adminToken);

  assert.equal(acceptByAdmin.status, 200);
  assert.equal(declineByAdmin.status, 200);
});

test("a join request to a full game is refused with 409", async () => {
  // The organizer is one of the two, so one accept fills the game
  const game = await createGameAs(petarToken, { maxPlayers: 2 });
  const markoRequest = await sendRequestAs(game, markoToken);
  await answerRequest(game, markoRequest, "accepted", petarToken);

  const response = await sendRequest(game, saraToken);
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.msg, "You cannot join this game: the game is full");
  assert.equal(await getMyRequest(game, saraToken), null);
});

test("a join request to a game that overlaps another game the user is a player in is refused with 409", async () => {
  const start = nextFreeStart();
  const game = await createGameAs(petarToken, {
    startTime: new Date(start).toISOString(),
  });
  // Marko's own game starts an hour in, while Petar's is still being played
  await createGameAs(markoToken, {
    startTime: new Date(start + 1 * HOUR).toISOString(),
    sport: "Tennis",
    city: "Ohrid",
  });

  const response = await sendRequest(game, markoToken);
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(
    body.msg,
    "You cannot join this game: it overlaps another game you are a player in (Tennis in Ohrid)",
  );
});

test("pending join requests to overlapping games are allowed, but only one of them can be accepted", async () => {
  const start = nextFreeStart();
  const game = await createGameAs(petarToken, {
    startTime: new Date(start).toISOString(),
  });
  const overlappingGame = await createGameAs(saraToken, {
    startTime: new Date(start + 1 * HOUR).toISOString(),
    sport: "Basketball",
    city: "Bitola",
  });

  const first = await sendRequestAs(game, markoToken);
  const second = await sendRequestAs(overlappingGame, markoToken);

  const acceptSecond = await answerRequest(overlappingGame, second, "accepted", saraToken);
  assert.equal(acceptSecond.status, 200);

  // Nothing overlapped when Marko sent this one; now he is a player in Sara's game
  const acceptFirst = await answerRequest(game, first, "accepted", petarToken);
  const body = await acceptFirst.json();

  assert.equal(acceptFirst.status, 409);
  assert.equal(
    body.msg,
    "This join request cannot be accepted: it overlaps another game marko_7 is a player in (Basketball in Bitola)",
  );
  // The refused accept changed nothing, and an admin is refused the same way
  assert.equal((await getMyRequest(game, markoToken)).state, "pending");
  assert.equal((await getGamePage(game)).game.playerCount, 1);
  const acceptByAdmin = await answerRequest(game, first, "accepted", adminToken);
  assert.equal(acceptByAdmin.status, 409);
});

test("accepting is refused with 409 when the game became full while the join request was pending", async () => {
  const game = await createGameAs(petarToken, { maxPlayers: 2 });
  const markoRequest = await sendRequestAs(game, markoToken);
  const saraRequest = await sendRequestAs(game, saraToken);
  await answerRequest(game, markoRequest, "accepted", petarToken);

  const response = await answerRequest(game, saraRequest, "accepted", petarToken);
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.msg, "This join request cannot be accepted: the game is full");
  assert.equal((await getMyRequest(game, saraToken)).state, "pending");
  assert.equal((await getGamePage(game)).game.playerCount, 2);

  // It can still be declined
  const decline = await answerRequest(game, saraRequest, "declined", petarToken);
  assert.equal(decline.status, 200);
});

test("the user withdraws a pending join request: it is deleted, and they can send a new one", async () => {
  const game = await createGameAs(petarToken);
  const joinRequest = await sendRequestAs(game, markoToken);

  const response = await withdrawRequest(game, joinRequest, markoToken);

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(await getMyRequest(game, markoToken), null);
  const pending = await getPendingRequests(game, petarToken);
  assert.deepEqual((await pending.json()).joinRequests, []);

  const again = await sendRequest(game, markoToken);
  assert.equal(again.status, 201);
});

test("only the user who sent a join request, or an admin, can withdraw it", async () => {
  const game = await createGameAs(petarToken);
  const joinRequest = await sendRequestAs(game, markoToken);

  const byGuest = await withdrawRequest(game, joinRequest);
  const byOtherUser = await withdrawRequest(game, joinRequest, saraToken);
  const byOrganizer = await withdrawRequest(game, joinRequest, petarToken);
  const missing = await withdrawRequest(game, { _id: "66f1c0a4e3b2a1d4c5f6a7b8" }, markoToken);

  assert.equal(byGuest.status, 401);
  assert.equal(byOtherUser.status, 403);
  assert.equal(byOrganizer.status, 403);
  assert.equal(missing.status, 404);
  assert.equal((await getMyRequest(game, markoToken)).state, "pending");

  const byAdmin = await withdrawRequest(game, joinRequest, adminToken);
  assert.equal(byAdmin.status, 204);
});

test("withdrawing is refused in the last hour before the start, except for an admin", async () => {
  const game = await createGameAs(petarToken);
  const markoRequest = await sendRequestAs(game, markoToken);
  const saraRequest = await sendRequestAs(game, saraToken);

  // Just over an hour before the start is still allowed
  await moveStartTime(game, 1 * HOUR + 60 * 1000);
  const intime = await withdrawRequest(game, saraRequest, saraToken);
  assert.equal(intime.status, 204);

  await moveStartTime(game, 0.5 * HOUR);
  const tooLate = await withdrawRequest(game, markoRequest, markoToken);
  const body = await tooLate.json();

  assert.equal(tooLate.status, 409);
  assert.match(body.msg, /one hour before/);
  assert.equal((await getMyRequest(game, markoToken)).state, "pending");

  const byAdmin = await withdrawRequest(game, markoRequest, adminToken);
  assert.equal(byAdmin.status, 204);
});

test("only a pending join request can be withdrawn: a declined one stays on record", async () => {
  const game = await createGameAs(petarToken);
  const markoRequest = await sendRequestAs(game, markoToken);
  const saraRequest = await sendRequestAs(game, saraToken);
  await answerRequest(game, markoRequest, "declined", petarToken);
  await answerRequest(game, saraRequest, "accepted", petarToken);

  const declined = await withdrawRequest(game, markoRequest, markoToken);
  const accepted = await withdrawRequest(game, saraRequest, saraToken);

  assert.equal(declined.status, 409);
  assert.equal(accepted.status, 409);
  assert.equal((await getMyRequest(game, markoToken)).state, "declined");
  assert.equal((await getGamePage(game)).game.playerCount, 2);
});

test("cancelling a game deletes its join requests", async () => {
  const game = await createGameAs(petarToken);
  await sendRequestAs(game, markoToken);
  const declined = await sendRequestAs(game, saraToken);
  await answerRequest(game, declined, "declined", petarToken);

  const response = await send("DELETE", `/api/games/${game._id}`, petarToken);
  assert.equal(response.status, 204);

  // No route can show the join requests of a game that is gone, so the
  // test looks in the database
  const requestsLeft = await mongoose.connection
    .collection("joinrequests")
    .countDocuments({ game: new mongoose.Types.ObjectId(game._id) });
  assert.equal(requestsLeft, 0);
});

test("the join request routes are in the OpenAPI file", async () => {
  const response = await send("GET", "/api/swagger.json");
  const body = await response.json();

  const list = body.paths["/api/games/{gameId}/join-requests"];
  const one = body.paths["/api/games/{gameId}/join-requests/{requestId}"];

  assert.ok(list.get);
  assert.ok(list.post.responses["409"]);
  assert.ok(body.paths["/api/games/{gameId}/join-requests/mine"].get);
  assert.ok(one.put.responses["409"]);
  assert.ok(one.delete.responses["204"]);
  assert.ok(body.components.schemas.JoinRequest);
});

const loginAs = async (email, password) => {
  const response = await send("POST", "/api/auth/login", null, { email, password });
  return (await response.json()).token;
};

test("the seed adds join requests in all three states, a player for every accepted one, and one full game", async () => {
  // The seed empties the database, so this test stays the last one
  const seed = await send("POST", "/api/db/seed");
  assert.equal(seed.status, 201);

  // No route lists every game yet, so the test reads the ids itself and
  // opens every game through the API
  const ids = await mongoose.connection.collection("games").distinct("_id");
  const gamePages = [];
  for (const id of ids) {
    gamePages.push(await getGamePage({ _id: id }));
  }

  const emails = ["marko", "sara", "ivan", "elena", "david", "ana"];
  const states = new Set();
  for (const name of emails) {
    const token = await loginAs(`${name}@example.com`, "football1");

    for (const gamePage of gamePages) {
      const joinRequest = await getMyRequest(gamePage.game, token);
      if (!joinRequest) continue;
      states.add(joinRequest.state);

      const isPlayer = gamePage.players.some((player) => {
        return player.user._id === joinRequest.user._id;
      });
      // Accepted means being a player, and the other two states mean not being one
      assert.equal(isPlayer, joinRequest.state === "accepted");
    }
  }
  assert.deepEqual([...states].sort(), ["accepted", "declined", "pending"]);

  const fullUpcomingGames = gamePages.filter((gamePage) => {
    const game = gamePage.game;
    return game.status === "upcoming" && game.playerCount === game.maxPlayers;
  });
  assert.equal(fullUpcomingGames.length, 1);

  // Nobody is over the max, and every game still starts with its organizer
  for (const gamePage of gamePages) {
    assert.ok(gamePage.game.playerCount <= gamePage.game.maxPlayers);
    assert.equal(gamePage.players[0].user.username, gamePage.game.organizer.username);
  }

  // The organizer of the full game has a pending join request to try to accept
  const seededAdminToken = await loginAs("admin@example.com", "admin1234");
  const pending = await getPendingRequests(fullUpcomingGames[0].game, seededAdminToken);
  assert.ok((await pending.json()).joinRequests.length >= 1);
});
