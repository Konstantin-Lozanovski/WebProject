import mongoose from "mongoose";

// Exported so the request validation checks the same rules as the schema
export const STATES = ["pending", "accepted", "declined"];
// The two states an organizer can answer a join request with
export const ANSWERS = ["accepted", "declined"];

// One user's ask to become a player in one game
const joinRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please provide user"],
    },
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Game",
      required: [true, "Please provide game"],
    },
    state: {
      type: String,
      enum: {
        values: STATES,
        message: "State must be pending, accepted or declined",
      },
      default: "pending",
    },
  },
  { timestamps: true },
);

// A user has at most one join request per game. A declined one stays in the
// collection, which is what stops the user from sending another.
joinRequestSchema.index({ user: 1, game: 1 }, { unique: true });

export default mongoose.model("JoinRequest", joinRequestSchema);
