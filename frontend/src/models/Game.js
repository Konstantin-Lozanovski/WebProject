// The closed sets of a game, the same ones the server checks.
// They fill the select inputs, so only allowed values can be chosen.
export const SPORTS = ["Football", "Basketball", "Volleyball", "Tennis", "Padel"];
export const CITIES = [
  "Skopje",
  "Bitola",
  "Kumanovo",
  "Prilep",
  "Tetovo",
  "Ohrid",
  "Veles",
  "Štip",
];
// In minutes
export const DURATIONS = [60, 90, 120];
// Even numbers only, because the players are split into two equal teams
export const MAX_PLAYERS_OPTIONS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

// Mirrors the game the API returns
class Game {
  constructor(data) {
    this._id = data._id;
    // Only the organizer's _id and username, not a whole user
    this.organizer = data.organizer;
    this.sport = data.sport;
    this.city = data.city;
    this.venue = data.venue;
    // JSON has no date type, so the API sends the dates as text
    this.startTime = new Date(data.startTime);
    this.duration = data.duration;
    this.maxPlayers = data.maxPlayers;
    this.notes = data.notes;
    // The last two are not stored in the document: the server works them
    // out for every answer
    this.status = data.status;
    this.playerCount = data.playerCount;
    this.createdAt = new Date(data.createdAt);
  }

  // The organizer is missing when their account was deleted
  organizerName() {
    return this.organizer ? this.organizer.username : "deleted user";
  }

  placesLeft() {
    return this.maxPlayers - this.playerCount;
  }

  isFull() {
    return this.placesLeft() <= 0;
  }
}

export default Game;
