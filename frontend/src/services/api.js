import axiosInstance from "./axiosInstance.js";
import User from "../models/User.js";
import Game from "../models/Game.js";
import Player from "../models/Player.js";

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
