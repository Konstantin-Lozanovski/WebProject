import mongoose from "mongoose";

export const TEAMS = ["A", "B", "unassigned"];

// One user's place in one game (see docs/adr/0002)
const playerSchema = new mongoose.Schema(
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
    team: {
      type: String,
      enum: TEAMS,
      default: "unassigned",
    },
  },
  { timestamps: true },
);

// A user can be a player in the same game only once
playerSchema.index({ user: 1, game: 1 }, { unique: true });

export default mongoose.model("Player", playerSchema);
