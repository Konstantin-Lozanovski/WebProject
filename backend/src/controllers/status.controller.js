import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";

// GET /api/status
export const getStatus = async (req, res) => {
  // readyState 1 is the value Mongoose uses for "connected"
  const isConnected = mongoose.connection.readyState === 1;

  res.status(StatusCodes.OK).json({
    msg: "API is running",
    database: isConnected ? "connected" : "disconnected",
  });
};
