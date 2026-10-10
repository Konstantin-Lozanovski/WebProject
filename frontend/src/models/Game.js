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

// The three statuses, in the order a game goes through them
export const STATUSES = ["upcoming", "in progress", "finished"];

// How each status is shown: its text and the Bootstrap colour of its badge
export const STATUS_BADGES = {
  upcoming: { label: "Upcoming", variant: "primary" },
  "in progress": { label: "In progress", variant: "success" },
  finished: { label: "Finished", variant: "secondary" },
};

// The picture of each sport's ball, from the public folder. Padel is played
// with a ball that looks like the tennis one, and the basketball is the logo.
export const SPORT_BALLS = {
  Football: "/ball-football.svg",
  Basketball: "/favicon.svg",
  Volleyball: "/ball-volleyball.svg",
  Tennis: "/ball-tennis.svg",
  Padel: "/ball-tennis.svg",
};

const HOUR = 60 * 60 * 1000;

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

  // user is the logged-in User, or null for a guest
  isOrganizedBy(user) {
    if (!user || !this.organizer) return false;
    return this.organizer._id === user._id;
  }

  // Who gets the Edit and Cancel buttons and may drag players between the
  // teams: the organizer until the game starts, an admin always. The server
  // checks the same rule again.
  canBeChangedBy(user) {
    if (!user) return false;
    if (user.isAdmin()) return true;
    return this.isOrganizedBy(user) && this.status === "upcoming";
  }

  // Who gets the list of pending join requests: the organizer and admins.
  // The Accept and Decline buttons follow canBeChangedBy, like Edit and Cancel.
  showsJoinRequestsTo(user) {
    if (!user) return false;
    return user.isAdmin() || this.isOrganizedBy(user);
  }

  // Withdrawing a join request, leaving and removing a player are allowed
  // until one hour before the start
  startsInMoreThanAnHour() {
    return this.startTime.getTime() - Date.now() > HOUR;
  }

  // Who gets the Remove buttons: the organizer until one hour before the
  // start, an admin always. The server checks the same rule again.
  playersCanBeRemovedBy(user) {
    if (!user) return false;
    if (user.isAdmin()) return true;
    return this.isOrganizedBy(user) && this.startsInMoreThanAnHour();
  }

  // How many spaces each team has: the max is always even
  teamSize() {
    return this.maxPlayers / 2;
  }

  placesLeft() {
    return this.maxPlayers - this.playerCount;
  }

  isFull() {
    return this.placesLeft() <= 0;
  }
}

export default Game;
