// Mirrors the player the API returns: one user's place in one game
class Player {
  constructor(data) {
    this._id = data._id;
    // Only the user's _id and username, not a whole user
    this.user = data.user;
    // The id of the game
    this.game = data.game;
    // "A", "B" or "unassigned"
    this.team = data.team;
    this.createdAt = new Date(data.createdAt);
  }

  // The user is missing when their account was deleted
  username() {
    return this.user ? this.user.username : "deleted user";
  }

  // A copy of this player on another team. A copy and not a change to this
  // one, because React only draws the page again for a new object in state.
  onTeam(team) {
    return new Player({
      _id: this._id,
      user: this.user,
      game: this.game,
      team,
      createdAt: this.createdAt,
    });
  }
}

export default Player;
