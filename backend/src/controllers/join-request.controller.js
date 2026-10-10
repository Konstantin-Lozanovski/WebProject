import { StatusCodes } from "http-status-codes";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "../errors/index.js";
import Game, { getStatus, findOverlappingGame } from "../models/game.model.js";
import Player from "../models/player.model.js";
import JoinRequest from "../models/join-request.model.js";

const HOUR = 60 * 60 * 1000;

// The user must be populated before this is called
const toPublicJoinRequest = (joinRequest) => {
  return {
    _id: joinRequest._id,
    user: joinRequest.user,
    game: joinRequest.game,
    state: joinRequest.state,
    createdAt: joinRequest.createdAt,
  };
};

// Every route here is about the join requests of one game, so each one
// starts by finding that game
const findGame = async (gameId) => {
  const game = await Game.findById(gameId);
  if (!game) throw new NotFoundError("Game not found");
  return game;
};

// Looked up with the game too, so a join request cannot be reached through
// the address of another game
const findJoinRequest = async (requestId, game) => {
  const joinRequest = await JoinRequest.findOne({
    _id: requestId,
    game: game._id,
  });
  if (!joinRequest) throw new NotFoundError("Join request not found");
  return joinRequest;
};

// Join requests are sent and answered until the game starts. An admin is
// not held to that.
const checkGameIsUpcoming = (game, user) => {
  if (user.role === "admin") return;

  if (getStatus(game) !== "upcoming")
    throw new ConflictError(
      "This game has already started, so its join requests are closed",
    );
};

// Throws unless the user may read and answer the game's join requests
const checkIsOrganizerOrAdmin = (game, user) => {
  if (user.role === "admin") return;

  // equals compares two ids by value; === would compare the objects
  if (!game.organizer.equals(user._id))
    throw new ForbiddenError(
      "Only the organizer can see and answer the join requests of this game",
    );
};

// The two rules that keep a user out of a game, checked when a join request
// is sent and again when it is accepted. Returns the reason as text, or null
// when the user can become a player. Only players count: a pending join
// request holds no place and no time.
// whoIs starts the overlap reason: "you are" for the user's own request,
// "marko_7 is" when the organizer is the one reading it.
const findReasonCannotJoin = async (game, userId, whoIs) => {
  const playerCount = await Player.countDocuments({ game: game._id });
  if (playerCount >= game.maxPlayers) return "the game is full";

  const overlappingGame = await findOverlappingGame(userId, game);
  if (overlappingGame)
    return `it overlaps another game ${whoIs} a player in (${overlappingGame.sport} in ${overlappingGame.city})`;

  return null;
};

// GET /api/games/:gameId/join-requests
export const getPendingJoinRequests = async (req, res) => {
  const game = await findGame(req.params.gameId);
  checkIsOrganizerOrAdmin(game, req.user);

  // Oldest first, so the organizer answers them in the order they came
  const joinRequests = await JoinRequest.find({
    game: game._id,
    state: "pending",
  })
    .sort("createdAt")
    .populate("user", "username");

  res
    .status(StatusCodes.OK)
    .json({ joinRequests: joinRequests.map(toPublicJoinRequest) });
};

// GET /api/games/:gameId/join-requests/mine
export const getMyJoinRequest = async (req, res) => {
  const game = await findGame(req.params.gameId);

  const joinRequest = await JoinRequest.findOne({
    user: req.user._id,
    game: game._id,
  }).populate("user", "username");

  // No join request is a normal answer and not an error, so it is 200 with null
  res.status(StatusCodes.OK).json({
    joinRequest: joinRequest ? toPublicJoinRequest(joinRequest) : null,
  });
};

// POST /api/games/:gameId/join-requests
export const sendJoinRequest = async (req, res) => {
  const game = await findGame(req.params.gameId);
  checkGameIsUpcoming(game, req.user);

  // What ties a join request or a player to this user and this game
  const userAndGame = { user: req.user._id, game: game._id };

  // The organizer is a player from the start, so this covers them too
  const player = await Player.findOne(userAndGame);
  if (player) throw new ConflictError("You are already a player in this game");

  const existingJoinRequest = await JoinRequest.findOne(userAndGame);
  if (existingJoinRequest) {
    // A decline is final, and the user is told that this is the reason
    if (existingJoinRequest.state === "declined")
      throw new ConflictError(
        "Your join request for this game was declined, so you cannot send another",
      );
    throw new ConflictError("You already have a join request for this game");
  }

  const reason = await findReasonCannotJoin(game, req.user._id, "you are");
  if (reason) throw new ConflictError(`You cannot join this game: ${reason}`);

  // The user comes from the token, never from the body, so nobody can
  // send a join request in someone else's name
  let joinRequest;
  try {
    joinRequest = await JoinRequest.create(userAndGame);
  } catch (error) {
    // 11000 is MongoDB's code for a value that breaks a unique index. It
    // gets here when the button is pressed twice so fast that both presses
    // passed the check above; the index is what stops the second one.
    if (error.code === 11000)
      throw new ConflictError("You already have a join request for this game");
    throw error;
  }
  await joinRequest.populate("user", "username");

  res
    .status(StatusCodes.CREATED)
    .json({ joinRequest: toPublicJoinRequest(joinRequest) });
};

// Marks the join request accepted and makes its user a player. The full and
// overlap checks run again here, because the game and the user's other
// games may have changed while the request was pending.
const acceptJoinRequest = async (joinRequest, game) => {
  const userAndGame = { user: joinRequest.user._id, game: game._id };

  // Not a check of the state: a request can be marked accepted and still
  // have no player, when an earlier accept failed halfway. Accepting it
  // again is how that gets repaired.
  const player = await Player.findOne(userAndGame);
  if (player)
    throw new ConflictError("This join request has already been accepted");

  const whoIs = `${joinRequest.user.username} is`;
  const reason = await findReasonCannotJoin(game, joinRequest.user._id, whoIs);
  if (reason)
    throw new ConflictError(`This join request cannot be accepted: ${reason}`);

  // The request first and the player second (see docs/adr/0002): if the
  // second step fails, what is left is an accepted request without a
  // player, which a second accept repairs. The other order could leave a
  // player whose request still says pending.
  joinRequest.state = "accepted";
  await joinRequest.save();
  // The team is left out, so the player starts unassigned
  await Player.create(userAndGame);
};

const declineJoinRequest = async (joinRequest) => {
  if (joinRequest.state !== "pending")
    throw new ConflictError("This join request has already been answered");

  joinRequest.state = "declined";
  await joinRequest.save();
};

// PUT /api/games/:gameId/join-requests/:requestId
// The body holds the answer: { state: "accepted" } or { state: "declined" }
export const answerJoinRequest = async (req, res) => {
  const game = await findGame(req.params.gameId);
  checkIsOrganizerOrAdmin(game, req.user);
  checkGameIsUpcoming(game, req.user);

  const joinRequest = await findJoinRequest(req.params.requestId, game);
  await joinRequest.populate("user", "username");

  // A decline is final, whichever answer comes after it
  if (joinRequest.state === "declined")
    throw new ConflictError("This join request has already been declined");

  if (req.body.state === "accepted") {
    await acceptJoinRequest(joinRequest, game);
  } else {
    await declineJoinRequest(joinRequest);
  }

  res
    .status(StatusCodes.OK)
    .json({ joinRequest: toPublicJoinRequest(joinRequest) });
};

// The one way a user gets out of a game. Withdrawing a join request, leaving
// and removing a player all end here; each does its own permission check
// first, and that check is the only thing that differs between them.
// userId is the user who gets out, actingUser the one who asked for it.
export const takeUserOutOfGame = async (game, userId, actingUser) => {
  // One hour before the start is the cutoff, so a team is never left short
  // at the last minute. An admin is not held to it.
  const cutoff = game.startTime.getTime() - HOUR;
  if (actingUser.role !== "admin" && Date.now() > cutoff)
    throw new ConflictError(
      "Too late: withdrawing a join request, leaving a game and removing a player are allowed until one hour before the game starts",
    );

  const userAndGame = { user: userId, game: game._id };

  // The two deletes are not one transaction, so the order decides what a
  // failure halfway leaves behind. The request first and the player second
  // leaves a player without a join request, who can simply leave or be
  // removed again. The other order would leave an accepted request without
  // a player: the user could neither withdraw it nor send a new one.
  // After a withdraw there is no player, and deleting nothing is not an error.
  await JoinRequest.deleteOne(userAndGame);
  await Player.deleteOne(userAndGame);
};

// Throws unless the user may withdraw the join request: the user who sent
// it, or an admin
const checkCanWithdraw = (joinRequest, user) => {
  if (user.role === "admin") return;

  if (!joinRequest.user.equals(user._id))
    throw new ForbiddenError("You can only withdraw your own join request");
};

// DELETE /api/games/:gameId/join-requests/:requestId
// Withdrawing deletes the join request, so the user can send a new one later
export const withdrawJoinRequest = async (req, res) => {
  const game = await findGame(req.params.gameId);

  const joinRequest = await findJoinRequest(req.params.requestId, game);
  checkCanWithdraw(joinRequest, req.user);

  // A declined request has to stay, or the user could send another one.
  // An accepted one belongs to a player, and a player leaves the game.
  if (joinRequest.state !== "pending")
    throw new ConflictError("Only a pending join request can be withdrawn");

  await takeUserOutOfGame(game, joinRequest.user, req.user);

  res.status(StatusCodes.NO_CONTENT).send();
};
