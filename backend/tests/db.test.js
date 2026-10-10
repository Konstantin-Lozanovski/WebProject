import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/app.js";

// Not the database auth.test.js uses: node runs the test files at the same
// time, and these tests empty every collection
const TEST_MONGO_URI = "mongodb://localhost:27017/pickup-games-db-test";

let server;
let baseUrl;

before(async () => {
  await mongoose.connect(TEST_MONGO_URI);
  await mongoose.connection.dropDatabase();
  // Dropping the database also dropped the unique indexes, so they are
  // built again before any test relies on them
  await mongoose.connection.syncIndexes();

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const post = (path, body) => {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
};

const login = (email, password) => {
  return post("/api/auth/login", { email, password });
};

test("a guest can delete all data, and a registered user can no longer log in", async () => {
  await post("/api/auth/register", {
    username: "marko_7",
    email: "marko@example.com",
    password: "football1",
  });

  const response = await fetch(`${baseUrl}/api/db`, { method: "DELETE" });
  const text = await response.text();

  assert.equal(response.status, 204);
  assert.equal(text, "");

  const afterDelete = await login("marko@example.com", "football1");
  assert.equal(afterDelete.status, 401);
});

test("seeding creates an admin and several users who can log in with the demo passwords", async () => {
  const response = await post("/api/db/seed");
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.counts.users, 12);

  const adminLogin = await login("admin@example.com", "admin1234");
  const adminBody = await adminLogin.json();
  assert.equal(adminLogin.status, 200);
  assert.equal(adminBody.user.role, "admin");

  const userLogin = await login("marko@example.com", "football1");
  const userBody = await userLogin.json();
  assert.equal(userLogin.status, 200);
  assert.equal(userBody.user.username, "marko_p");
  assert.equal(userBody.user.role, "user");
});

test("seeding a second time gives the same data, without what was added in between", async () => {
  const register = await post("/api/auth/register", {
    username: "extra_user",
    email: "extra@example.com",
    password: "football1",
  });
  assert.equal(register.status, 201);

  const response = await post("/api/db/seed");
  const body = await response.json();

  assert.equal(response.status, 201);
  // 131 players: the 36 organizers and the users of the 95 accepted join requests
  assert.deepEqual(body.counts, {
    users: 12,
    games: 36,
    joinRequests: 109,
    players: 131,
    messages: 11,
  });

  const extraLogin = await login("extra@example.com", "football1");
  const adminLogin = await login("admin@example.com", "admin1234");
  assert.equal(extraLogin.status, 401);
  assert.equal(adminLogin.status, 200);
});

test("seeding places players on Team A, on Team B and unassigned, and no team over half the max", async () => {
  const seed = await post("/api/db/seed");
  assert.equal(seed.status, 201);

  const list = await fetch(`${baseUrl}/api/games`);
  const games = (await list.json()).games;
  // Every team a player of an upcoming game is on
  const seenTeams = [];

  for (const game of games) {
    const gamePage = await fetch(`${baseUrl}/api/games/${game._id}`);
    const players = (await gamePage.json()).players;
    const teams = players.map((player) => player.team);
    seenTeams.push(...teams);

    for (const team of ["A", "B"]) {
      const teamCount = teams.filter((one) => one === team).length;
      assert.ok(teamCount <= game.maxPlayers / 2, `${game.sport} in ${game.city}`);
    }
  }

  assert.ok(seenTeams.includes("A"));
  assert.ok(seenTeams.includes("B"));
  assert.ok(seenTeams.includes("unassigned"));
});

test("seeding adds messages to a few games, each posted by a player of that game, oldest first", async () => {
  const seed = await post("/api/db/seed");
  assert.equal(seed.status, 201);

  // An admin reads every chat
  const adminLogin = await login("admin@example.com", "admin1234");
  const headers = { Authorization: `Bearer ${(await adminLogin.json()).token}` };

  const list = await fetch(`${baseUrl}/api/games`);
  const games = (await list.json()).games;
  let gamesWithMessages = 0;

  for (const game of games) {
    const gamePage = await fetch(`${baseUrl}/api/games/${game._id}`);
    const players = (await gamePage.json()).players;
    const playerNames = players.map((player) => player.user.username);

    const chat = await fetch(`${baseUrl}/api/games/${game._id}/messages`, { headers });
    assert.equal(chat.status, 200);
    const messages = (await chat.json()).messages;
    if (messages.length > 0) gamesWithMessages = gamesWithMessages + 1;

    for (const message of messages) {
      assert.ok(playerNames.includes(message.user.username), message.text);
      // Posted in the past, so the chat shows "3 hours ago" and not "just now"
      assert.ok(new Date(message.createdAt) < new Date(), message.text);
    }

    const times = messages.map((message) => message.createdAt);
    // ISO dates sort like text, so a sorted copy equal to the list means
    // the list is oldest first
    assert.deepEqual(times, [...times].sort());
  }

  // Only the upcoming games are listed; the finished one and the one in
  // progress have messages too
  assert.equal(gamesWithMessages, 2);
});

test("seeding gives marko_p finished games in several different months", async () => {
  const seed = await post("/api/db/seed");
  assert.equal(seed.status, 201);

  const markoLogin = await login("marko@example.com", "football1");
  const headers = { Authorization: `Bearer ${(await markoLogin.json()).token}` };

  const response = await fetch(`${baseUrl}/api/me/month-counts`, { headers });
  assert.equal(response.status, 200);
  const monthCounts = (await response.json()).monthCounts;

  // Enough for the my-games-per-month chart to show more than one bar
  const monthsWithGames = monthCounts.filter((monthCount) => monthCount.count > 0);
  assert.ok(monthsWithGames.length >= 3);
});

test("deleting all data after a seed leaves no demo account to log in with", async () => {
  const response = await fetch(`${baseUrl}/api/db`, { method: "DELETE" });
  assert.equal(response.status, 204);

  const adminLogin = await login("admin@example.com", "admin1234");
  assert.equal(adminLogin.status, 401);
});

test("both database routes are in the OpenAPI file", async () => {
  const response = await fetch(`${baseUrl}/api/swagger.json`);
  const body = await response.json();

  assert.ok(body.paths["/api/db"].delete);
  assert.ok(body.paths["/api/db/seed"].post);
});
