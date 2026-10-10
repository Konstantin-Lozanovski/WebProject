import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Mail settings that can never work: nothing listens on port 1, so every
// send fails at once. They are set before the app is loaded, because the
// app reads its settings only once, when it is loaded. That is also why the
// app is loaded with import() further down and not at the top of the file.
process.env.MAIL_HOST = "127.0.0.1";
process.env.MAIL_PORT = "1";
process.env.MAIL_USER = "nobody";
process.env.MAIL_PASS = "nothing";
process.env.MAIL_FROM = "games@example.com";

// A database of its own: node runs the test files at the same time, and
// db.test.js empties every collection of the database it uses
const TEST_MONGO_URI = "mongodb://localhost:27017/pickup-games-failed-send-test";

let server;
let baseUrl;

// A failed send is written to the error log
const errorLog = mock.method(console, "error", () => {});

before(async () => {
  const { default: app } = await import("../src/app.js");

  await mongoose.connect(TEST_MONGO_URI);
  await mongoose.connection.dropDatabase();
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

const wait = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

test("registering still succeeds when the welcome email cannot be sent, and the failure is logged", async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "marko_7",
      email: "marko@example.com",
      password: "football1",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.user.username, "marko_7");

  // The response does not wait for the email, so the failure may be logged
  // a moment after it. Checked every 100 ms, for 5 seconds at most.
  for (let attempt = 0; attempt < 50; attempt++) {
    if (errorLog.mock.callCount() > 0) break;
    await wait(100);
  }

  assert.equal(errorLog.mock.callCount(), 1);
  const message = String(errorLog.mock.calls[0].arguments[0]);
  assert.match(message, /Could not send the email/);
  assert.match(message, /marko@example\.com/);
});
