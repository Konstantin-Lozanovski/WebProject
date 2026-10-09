import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import express from "express";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { JWT_SECRET } from "../src/config/env.js";
import { authenticate, requireRole } from "../src/middleware/auth.js";
import errorHandlerMiddleware from "../src/middleware/error-handler.js";

// A database of its own, so running the tests never touches the real data
const TEST_MONGO_URI = "mongodb://localhost:27017/pickup-games-test";

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

// isFullUrl is for the one test that calls an app other than the real one
const getWithToken = (path, token, isFullUrl) => {
  const url = isFullUrl ? path : `${baseUrl}${path}`;
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

test("registering creates a user with the role user and logs them in", async () => {
  const response = await post("/api/auth/register", {
    username: "marko_7",
    email: "marko@example.com",
    password: "football1",
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.user.username, "marko_7");
  assert.equal(body.user.email, "marko@example.com");
  assert.equal(body.user.role, "user");
  assert.equal(body.user.password, undefined);
  assert.equal(typeof body.token, "string");

  // The token works straight away, which is what "logged in" means
  const me = await getWithToken("/api/auth/me", body.token);
  assert.equal(me.status, 200);
});

const validUser = (changes) => {
  return {
    username: "petar",
    email: "petar@example.com",
    password: "football1",
    ...changes,
  };
};

test("a username with a space or under 3 characters is refused with a message for that field", async () => {
  const tooShort = await post("/api/auth/register", validUser({ username: "ab" }));
  const withSpace = await post("/api/auth/register", validUser({ username: "petar p" }));
  const body = await tooShort.json();

  assert.equal(tooShort.status, 400);
  assert.equal(withSpace.status, 400);
  assert.equal(
    body.fields.username,
    "Username must be 3 to 20 letters, digits or underscores",
  );
  assert.equal(typeof body.msg, "string");
});

test("an invalid email is refused with a message for that field", async () => {
  const response = await post("/api/auth/register", validUser({ email: "petar-at-example" }));
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.fields.email, "Please provide a valid email address");
});

test("an email with two @ signs, two dots in a row or no ending is refused", async () => {
  const twoAts = await post("/api/auth/register", validUser({ email: "a@b@c.de" }));
  const twoDots = await post("/api/auth/register", validUser({ email: "petar@example..com" }));
  const noEnding = await post("/api/auth/register", validUser({ email: "petar@example" }));

  assert.equal(twoAts.status, 400);
  assert.equal(twoDots.status, 400);
  assert.equal(noEnding.status, 400);
});

test("an ordinary email with dots, a plus sign and a subdomain is accepted", async () => {
  const response = await post(
    "/api/auth/register",
    validUser({ username: "ana_k", email: "ana.k+games@mail.example.com" }),
  );

  assert.equal(response.status, 201);
});

test("a password that is too short, or has no digit, or has no letter is refused", async () => {
  const tooShort = await post("/api/auth/register", validUser({ password: "foot1" }));
  const noDigit = await post("/api/auth/register", validUser({ password: "football" }));
  const noLetter = await post("/api/auth/register", validUser({ password: "12345678" }));
  const body = await noDigit.json();

  assert.equal(tooShort.status, 400);
  assert.equal(noDigit.status, 400);
  assert.equal(noLetter.status, 400);
  assert.equal(typeof body.fields.password, "string");
});

test("every invalid field gets its own message in one answer", async () => {
  const response = await post("/api/auth/register", {});
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(Object.keys(body.fields).sort(), ["email", "password", "username"]);
});

test("nobody can register as an admin", async () => {
  const response = await post(
    "/api/auth/register",
    validUser({ username: "sneaky", email: "sneaky@example.com", role: "admin" }),
  );
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.user.role, "user");
});

test("a taken username returns 409 saying the username is taken", async () => {
  const response = await post(
    "/api/auth/register",
    validUser({ username: "marko_7", email: "other@example.com" }),
  );
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.msg, "This username is already taken");
  assert.equal(body.fields.username, "This username is already taken");
});

test("a username that differs only in letter case counts as taken, and the first one keeps its case", async () => {
  const response = await post(
    "/api/auth/register",
    validUser({ username: "MARKO_7", email: "shouting@example.com" }),
  );
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.fields.username, "This username is already taken");

  const mixed = await post(
    "/api/auth/register",
    validUser({ username: "MixedCase", email: "mixed@example.com" }),
  );
  assert.equal((await mixed.json()).user.username, "MixedCase");
});

test("a taken email returns 409 saying the email is taken, whatever the letter case", async () => {
  const response = await post(
    "/api/auth/register",
    validUser({ username: "marko_8", email: "Marko@Example.com" }),
  );
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.msg, "This email is already taken");
  assert.equal(body.fields.email, "This email is already taken");
});

test("logging in with the right email and password returns the user and a token", async () => {
  const response = await post("/api/auth/login", {
    email: "Marko@example.com",
    password: "football1",
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.user.username, "marko_7");
  assert.equal(body.user.password, undefined);

  const me = await getWithToken("/api/auth/me", body.token);
  const meBody = await me.json();
  assert.equal(me.status, 200);
  assert.equal(meBody.user.username, "marko_7");
  assert.equal(meBody.user.role, "user");
  assert.equal(meBody.user.password, undefined);
});

test("a wrong password and an unknown email get the same 401 message", async () => {
  const wrongPassword = await post("/api/auth/login", {
    email: "marko@example.com",
    password: "football2",
  });
  const unknownEmail = await post("/api/auth/login", {
    email: "nobody@example.com",
    password: "football1",
  });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.deepEqual(await wrongPassword.json(), { msg: "Invalid email or password" });
  assert.deepEqual(await unknownEmail.json(), { msg: "Invalid email or password" });
});

test("logging in without an email or password, or with an object in their place, returns 400", async () => {
  const empty = await post("/api/auth/login", {});
  const withObjects = await post("/api/auth/login", {
    email: { $gt: "" },
    password: { $gt: "" },
  });

  assert.equal(empty.status, 400);
  assert.equal(withObjects.status, 400);
});

test("the token holds the user's id and role and lasts 7 days", async () => {
  const response = await post("/api/auth/login", {
    email: "marko@example.com",
    password: "football1",
  });
  const body = await response.json();
  const payload = jwt.decode(body.token);

  assert.equal(payload.id, body.user._id);
  assert.equal(payload.role, "user");
  assert.equal(payload.exp - payload.iat, 7 * 24 * 60 * 60);
});

test("a missing, made-up or expired token returns 401", async () => {
  const missing = await fetch(`${baseUrl}/api/auth/me`);
  const madeUp = await getWithToken("/api/auth/me", "not-a-real-token");

  const login = await post("/api/auth/login", {
    email: "marko@example.com",
    password: "football1",
  });
  const { user } = await login.json();
  const expiredToken = jwt.sign({ id: user._id, role: "user" }, JWT_SECRET, {
    expiresIn: -10,
  });
  const expired = await getWithToken("/api/auth/me", expiredToken);

  assert.equal(missing.status, 401);
  assert.equal(madeUp.status, 401);
  assert.equal(expired.status, 401);
});

test("the role check lets a user into user routes only, and an admin into both", async () => {
  // No route with a role check exists yet, so the check is put on a small
  // app of its own, wired the same way the real routes will be
  const roleApp = express();
  roleApp.get("/user-only", authenticate, requireRole("user"), (req, res) => {
    res.json({ msg: "welcome" });
  });
  roleApp.get("/admin-only", authenticate, requireRole("admin"), (req, res) => {
    res.json({ msg: "welcome" });
  });
  roleApp.use(errorHandlerMiddleware);
  const roleServer = roleApp.listen(0);
  await new Promise((resolve) => roleServer.once("listening", resolve));
  const roleUrl = `http://localhost:${roleServer.address().port}`;

  const userLogin = await post("/api/auth/login", {
    email: "marko@example.com",
    password: "football1",
  });
  const userToken = (await userLogin.json()).token;

  // There is no route for promoting a user yet, so the test sets the
  // role itself
  const adminRegister = await post("/api/auth/register", {
    username: "the_admin",
    email: "admin@example.com",
    password: "football1",
  });
  const adminToken = (await adminRegister.json()).token;
  await mongoose.connection
    .collection("users")
    .updateOne({ username: "the_admin" }, { $set: { role: "admin" } });

  const userOnUser = await getWithToken(`${roleUrl}/user-only`, userToken, true);
  const userOnAdmin = await getWithToken(`${roleUrl}/admin-only`, userToken, true);
  const adminOnUser = await getWithToken(`${roleUrl}/user-only`, adminToken, true);
  const adminOnAdmin = await getWithToken(`${roleUrl}/admin-only`, adminToken, true);
  const guestOnUser = await fetch(`${roleUrl}/user-only`);
  roleServer.close();

  assert.equal(userOnUser.status, 200);
  assert.equal(userOnAdmin.status, 403);
  assert.equal(adminOnUser.status, 200);
  assert.equal(adminOnAdmin.status, 200);
  assert.equal(guestOnUser.status, 401);
});

test("a deleted user's token returns 401", async () => {
  const register = await post("/api/auth/register", {
    username: "leaving",
    email: "leaving@example.com",
    password: "football1",
  });
  const { token } = await register.json();

  // There is no route for deleting a user yet, so the test removes the
  // document itself
  await mongoose.connection.collection("users").deleteOne({ username: "leaving" });

  const response = await getWithToken("/api/auth/me", token);
  assert.equal(response.status, 401);
});
