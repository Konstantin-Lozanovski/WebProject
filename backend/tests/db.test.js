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
  assert.equal(body.counts.users, 7);

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
  // 20 players: the 9 organizers and the users of the 11 accepted join requests
  assert.deepEqual(body.counts, {
    users: 7,
    games: 9,
    joinRequests: 19,
    players: 20,
  });

  const extraLogin = await login("extra@example.com", "football1");
  const adminLogin = await login("admin@example.com", "admin1234");
  assert.equal(extraLogin.status, 401);
  assert.equal(adminLogin.status, 200);
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
