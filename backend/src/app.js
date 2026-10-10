import express from "express";
import statusRoutes from "./routes/status.routes.js";
import docsRoutes from "./routes/docs.routes.js";
import authRoutes from "./routes/auth.routes.js";
import dbRoutes from "./routes/db.routes.js";
import gameRoutes from "./routes/game.routes.js";
import joinRequestRoutes from "./routes/join-request.routes.js";
import playerRoutes from "./routes/player.routes.js";
import messageRoutes from "./routes/message.routes.js";
import notFoundMiddleware from "./middleware/not-found.js";
import errorHandlerMiddleware from "./middleware/error-handler.js";

const app = express();

app.use(express.json());

app.use("/api/status", statusRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/db", dbRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/games/:gameId/join-requests", joinRequestRoutes);
app.use("/api/games/:gameId/players", playerRoutes);
app.use("/api/games/:gameId/messages", messageRoutes);
app.use("/api", docsRoutes);

// Order matters: these two come after every route, so they only see
// requests that no route answered and errors that a route threw
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

// The app is exported without calling listen, so the tests can start it
// on their own port. index.js is the file that starts the real server.
export default app;
