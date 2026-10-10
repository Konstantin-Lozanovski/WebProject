// The closed set of states, the same one the server checks
export const STATES = ["pending", "accepted", "declined"];

// How each state is shown: its text and the Bootstrap colour of its badge
export const STATE_BADGES = {
  pending: { label: "Pending", variant: "warning" },
  accepted: { label: "Accepted", variant: "success" },
  declined: { label: "Declined", variant: "secondary" },
};

// Mirrors the join request the API returns: one user's ask to become a
// player in one game
class JoinRequest {
  constructor(data) {
    this._id = data._id;
    // Only the user's _id and username, not a whole user
    this.user = data.user;
    // The id of the game. Only in the list of the user's own join requests
    // it is an object with the game's _id, sport, city and startTime, so
    // the list can name the game.
    this.game = data.game;
    // One of STATES
    this.state = data.state;
    // JSON has no date type, so the API sends the date as text
    this.createdAt = new Date(data.createdAt);
  }

  // The user is missing when their account was deleted
  username() {
    return this.user ? this.user.username : "deleted user";
  }

  isPending() {
    return this.state === "pending";
  }
}

export default JoinRequest;
