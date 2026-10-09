import axiosInstance from "./axiosInstance.js";

// GET /api/status
export const fetchStatus = async () => {
  const response = await axiosInstance.get("/status");
  return response.data;
};
