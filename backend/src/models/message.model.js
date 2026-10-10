import mongoose from "mongoose";

// Exported so the request validation checks the same rules as the schema
export const TEXT_MAX_LENGTH = 500;

// One piece of text a player posted in a game's chat
const messageSchema = new mongoose.Schema(
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
    // trim runs before the other rules, so a message of only spaces is
    // empty and fails required
    text: {
      type: String,
      required: [true, "Message must be 1 to 500 characters"],
      trim: true,
      maxlength: [TEXT_MAX_LENGTH, "Message must be 1 to 500 characters"],
    },
  },
  { timestamps: true },
);

export default mongoose.model("Message", messageSchema);
