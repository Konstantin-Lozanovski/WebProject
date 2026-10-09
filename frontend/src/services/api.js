import axiosInstance from "./axiosInstance.js";
import User from "../models/User.js";

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
