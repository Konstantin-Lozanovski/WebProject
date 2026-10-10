import axiosInstance from "./axiosInstance.js";
import User from "../models/User.js";
import Game from "../models/Game.js";
import Player from "../models/Player.js";
import JoinRequest from "../models/JoinRequest.js";
import Message from "../models/Message.js";

// GET /api/status
export const fetchStatus = async () => {
  const response = await axiosInstance.get("/status");
  return response.data;
};

// POST /api/auth/register
export const registerUser = async (username, email, password) => {
  const response = await axiosInstance.post("/auth/register", {
    username,
    email,
    password,
  });
  return { user: new User(response.data.user), token: response.data.token };
};

// POST /api/auth/login
export const loginUser = async (email, password) => {
  const response = await axiosInstance.post("/auth/login", { email, password });
  return { user: new User(response.data.user), token: response.data.token };
};

// GET /api/auth/me
export const fetchCurrentUser = async () => {
  const response = await axiosInstance.get("/auth/me");
  return new User(response.data.user);
};

// DELETE /api/db
export const deleteAllData = async () => {
  await axiosInstance.delete("/db");
};

// POST /api/db/seed
export const seedInitialData = async () => {
  const response = await axiosInstance.post("/db/seed");
  return response.data;
};

// GET /api/games?sport=...&city=...&date=...
// Each filter is text; "" means it was not chosen
export const fetchUpcomingGames = async (sport, city, date) => {
  // Only the chosen filters are sent: the server reads a missing filter as
  // "any", but refuses an empty one
  const params = {};
  if (sport) params.sport = sport;
  if (city) params.city = city;
  if (date) params.date = date;

  // axios writes params after the ? in the address
  const response = await axiosInstance.get("/games", { params });
  return response.data.games.map((game) => new Game(game));
};

// GET /api/games/sport-counts
// Returns a list like [{ sport: "Football", count: 3 }, ...] with every
// sport in it, also the ones without games
export const fetchSportCounts = async () => {
  const response = await axiosInstance.get("/games/sport-counts");
  return response.data.sportCounts;
};

// GET /api/games/:id
export const fetchGame = async (gameId) => {
  const response = await axiosInstance.get(`/games/${gameId}`);
  return {
    game: new Game(response.data.game),
    players: response.data.players.map((player) => new Player(player)),
  };
};

// POST /api/games
export const createGame = async (gameData) => {
  const response = await axiosInstance.post("/games", gameData);
  return new Game(response.data.game);
};

// PUT /api/games/:id
export const updateGame = async (gameId, gameData) => {
  const response = await axiosInstance.put(`/games/${gameId}`, gameData);
  return new Game(response.data.game);
};

// DELETE /api/games/:id
export const deleteGame = async (gameId) => {
  await axiosInstance.delete(`/games/${gameId}`);
};

// GET /api/games/:gameId/join-requests
// Only the game's organizer and admins may ask for this
export const fetchPendingJoinRequests = async (gameId) => {
  const response = await axiosInstance.get(`/games/${gameId}/join-requests`);
  return response.data.joinRequests.map((joinRequest) => {
    return new JoinRequest(joinRequest);
  });
};

// GET /api/games/:gameId/join-requests/mine
// Returns null when the logged-in user has no join request for the game
export const fetchMyJoinRequest = async (gameId) => {
  const response = await axiosInstance.get(`/games/${gameId}/join-requests/mine`);
  const joinRequest = response.data.joinRequest;
  return joinRequest ? new JoinRequest(joinRequest) : null;
};

// POST /api/games/:gameId/join-requests
// No body: the server takes the user from the token and the game from the address
export const sendJoinRequest = async (gameId) => {
  const response = await axiosInstance.post(`/games/${gameId}/join-requests`);
  return new JoinRequest(response.data.joinRequest);
};

// PUT /api/games/:gameId/join-requests/:requestId
// state is the answer: "accepted" or "declined"
export const answerJoinRequest = async (gameId, requestId, state) => {
  const response = await axiosInstance.put(
    `/games/${gameId}/join-requests/${requestId}`,
    { state },
  );
  return new JoinRequest(response.data.joinRequest);
};

// DELETE /api/games/:gameId/join-requests/:requestId
export const withdrawJoinRequest = async (gameId, requestId) => {
  await axiosInstance.delete(`/games/${gameId}/join-requests/${requestId}`);
};

// GET /api/me/games
// The games the logged-in user is a player in, as two lists: the upcoming
// ones and those in progress soonest first, the finished ones most recent first
export const fetchMyGames = async () => {
  const response = await axiosInstance.get("/me/games");
  return {
    currentGames: response.data.currentGames.map((game) => new Game(game)),
    finishedGames: response.data.finishedGames.map((game) => new Game(game)),
  };
};

// GET /api/me/join-requests
// The logged-in user's join requests in every state, newest first
export const fetchMyJoinRequests = async () => {
  const response = await axiosInstance.get("/me/join-requests");
  return response.data.joinRequests.map((joinRequest) => {
    return new JoinRequest(joinRequest);
  });
};

// GET /api/me/month-counts
// Returns a list like [{ month: "2026-05", count: 0 }, ...]: the logged-in
// user's finished games in each of the last six months, oldest first
export const fetchMyMonthCounts = async () => {
  const response = await axiosInstance.get("/me/month-counts");
  return response.data.monthCounts;
};

// PUT /api/games/:gameId/players/:playerId
// team is "A", "B" or "unassigned". The request behind every drop in the
// teams view.
export const updatePlayerTeam = async (gameId, playerId, team) => {
  const response = await axiosInstance.put(
    `/games/${gameId}/players/${playerId}`,
    { team },
  );
  return new Player(response.data.player);
};

// DELETE /api/games/:gameId/players/:playerId
// The one request behind both "Leave game" (the user's own player) and the
// organizer's Remove (someone else's)
export const deletePlayer = async (gameId, playerId) => {
  await axiosInstance.delete(`/games/${gameId}/players/${playerId}`);
};

// GET /api/games/:gameId/messages
// The whole chat, oldest first. Only the game's players and admins may ask
// for this.
export const fetchMessages = async (gameId) => {
  const response = await axiosInstance.get(`/games/${gameId}/messages`);
  return response.data.messages.map((message) => new Message(message));
};

// POST /api/games/:gameId/messages
export const postMessage = async (gameId, text) => {
  const response = await axiosInstance.post(`/games/${gameId}/messages`, {
    text,
  });
  return new Message(response.data.message);
};

// DELETE /api/games/:gameId/messages/:messageId
export const deleteMessage = async (gameId, messageId) => {
  await axiosInstance.delete(`/games/${gameId}/messages/${messageId}`);
};
