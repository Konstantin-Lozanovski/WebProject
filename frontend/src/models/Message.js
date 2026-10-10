// Mirrors the message the API returns: one piece of text a player posted
// in a game's chat
class Message {
  constructor(data) {
    this._id = data._id;
    // Only the user's _id and username, not a whole user
    this.user = data.user;
    // The id of the game
    this.game = data.game;
    this.text = data.text;
    // JSON has no date type, so the API sends the date as text
    this.createdAt = new Date(data.createdAt);
  }

  // The user is missing when their account was deleted
  username() {
    return this.user ? this.user.username : "deleted user";
  }

  // Who gets the Delete button: the user who posted the message, and
  // admins. The server checks the same rule again.
  canBeDeletedBy(user) {
    if (user.isAdmin()) return true;
    if (!this.user) return false;
    return this.user._id === user._id;
  }
}

export default Message;
