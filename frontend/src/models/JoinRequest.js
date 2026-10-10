// The closed set of states, the same one the server checks
export const STATES = ["pending", "accepted", "declined"];

// Mirrors the join request the API returns: one user's ask to become a
// player in one game
class JoinRequest {
  constructor(data) {
    this._id = data._id;
    // Only the user's _id and username, not a whole user
    this.user = data.user;
    // The id of the game
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
