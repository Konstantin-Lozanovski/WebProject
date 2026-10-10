import { StatusCodes } from "http-status-codes";
import { NotFoundError, ForbiddenError } from "../errors/index.js";
import Game from "../models/game.model.js";
import Player from "../models/player.model.js";
import Message from "../models/message.model.js";

// Every route here is about the chat of one game, so each one starts by
// finding it
const findGame = async (gameId) => {
  const game = await Game.findById(gameId);
  if (!game) throw new NotFoundError("Game not found");
  return game;
};

// Asked again on every request and never remembered, so a user who left or
// was removed loses the chat at once
const isPlayerOf = async (game, user) => {
  const player = await Player.findOne({ game: game._id, user: user._id });
  return player !== null;
};

// Throws unless the user may read the game's chat: its players, and admins
const checkCanReadChat = async (game, user) => {
  if (user.role === "admin") return;

  const isPlayer = await isPlayerOf(game, user);
  if (!isPlayer)
    throw new ForbiddenError("Only the players of this game can use its chat");
};

// The message as the client sees it.
// The user must be populated before this is called.
const toPublicMessage = (message) => {
  return {
    _id: message._id,
    user: message.user,
    game: message.game,
    text: message.text,
    createdAt: message.createdAt,
  };
};

// GET /api/games/:gameId/messages
export const getMessages = async (req, res) => {
  const game = await findGame(req.params.gameId);
  await checkCanReadChat(game, req.user);

  // Oldest first, the order a chat is read in
  const messages = await Message.find({ game: game._id })
    .sort("createdAt")
    .populate("user", "username");

  res.status(StatusCodes.OK).json({ messages: messages.map(toPublicMessage) });
};

// POST /api/games/:gameId/messages
export const createMessage = async (req, res) => {
  const game = await findGame(req.params.gameId);

  // No exception for an admin: an admin reads every chat, but only speaks
  // in the games they play in
  const isPlayer = await isPlayerOf(game, req.user);
  if (!isPlayer)
    throw new ForbiddenError(
      "Only the players of this game can post in its chat",
    );

  // The user comes from the token and the game from the address, never from
  // the body, so nobody can post in someone else's name
  const message = await Message.create({
    user: req.user._id,
    game: game._id,
    text: req.body.text,
  });
  await message.populate("user", "username");

  res.status(StatusCodes.CREATED).json({ message: toPublicMessage(message) });
};

// Throws unless the user may delete the message: an admin, or the player
// who posted it
const checkCanDeleteMessage = async (message, game, user) => {
  if (user.role === "admin") return;

  // equals compares two ids by value; === would compare the objects
  if (!message.user.equals(user._id))
    throw new ForbiddenError("You can only delete your own messages");

  // Their messages stay behind when a user leaves or is removed, but they
  // are part of a chat that user can no longer open
  const isPlayer = await isPlayerOf(game, user);
  if (!isPlayer)
    throw new ForbiddenError("Only the players of this game can use its chat");
};

// DELETE /api/games/:gameId/messages/:messageId
export const deleteMessage = async (req, res) => {
  const game = await findGame(req.params.gameId);

  // Looked up with the game too, so a message cannot be reached through the
  // address of another game
  const message = await Message.findOne({
    _id: req.params.messageId,
    game: game._id,
  });
  if (!message) throw new NotFoundError("Message not found");
  await checkCanDeleteMessage(message, game, req.user);

  await message.deleteOne();

  res.status(StatusCodes.NO_CONTENT).send();
};
