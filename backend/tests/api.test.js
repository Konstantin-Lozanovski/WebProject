import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";

let server;
let baseUrl;

// Port 0 lets the system pick any free port, so the tests never clash
// with a backend that is already running on port 5000
before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => {
  server.close();
});

test("GET /api/status says the API is running", async () => {
  const response = await fetch(`${baseUrl}/api/status`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.msg, "API is running");
});

test("an unknown API route returns 404 with a readable message", async () => {
  const response = await fetch(`${baseUrl}/api/no-such-route`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.msg, "Route GET /api/no-such-route does not exist");
});

test("a request with a broken JSON body gets a JSON error, not an HTML page", async () => {
  const response = await fetch(`${baseUrl}/api/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ this is not json",
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(typeof body.msg, "string");
  assert.notEqual(body.msg, "");
});

test("GET /api/swagger.json returns the OpenAPI file with the status route in it", async () => {
  const response = await fetch(`${baseUrl}/api/swagger.json`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.openapi, "3.0.0");
  assert.ok(body.paths["/api/status"].get);
});

test("GET /api/docs/ shows the Swagger UI page", async () => {
  const response = await fetch(`${baseUrl}/api/docs/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /swagger-ui/);
});
