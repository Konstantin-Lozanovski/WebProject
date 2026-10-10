import { Link } from "react-router-dom";
import { SPORT_BALLS, STATUS_BADGES } from "../models/Game.js";
import {
  formatTime,
  formatShortDate,
  formatPlaces,
  getPlacesClass,
} from "../services/helpers.js";

// One game in a list of games.
// user is the logged-in user, so the card can mark the games they organize.
// It is left out where that does not matter, and is null for a guest.
const GameCard = ({ game, user = null }) => {
  // What stands above the button: the places left while the game can still
  // be joined, and the badge of its status once it has started
  const renderSide = () => {
    if (game.status !== "upcoming") {
      const badge = STATUS_BADGES[game.status];
      // The div puts the badge on a line of its own, above the button
      return (
        <div className="mb-2">
          <span className={`badge text-bg-${badge.variant}`}>{badge.label}</span>
        </div>
      );
    }

    const placesLeft = game.placesLeft();
    return (
      <span className={`places ${getPlacesClass(placesLeft)} d-block mb-2`}>
        {formatPlaces(placesLeft)}
      </span>
    );
  };

  return (
    <div className={`game mb-3 ${game.isFull() ? "is-full" : ""}`}>
      <div className="game-time">
        <small>{formatShortDate(game.startTime)}</small>
        {formatTime(game.startTime)}
        <small>{game.duration} min</small>
      </div>
      <div>
        <h2 className="game-title mb-1">
          {/* Empty alt: the title next to it already names the sport */}
          <img className="game-ball" src={SPORT_BALLS[game.sport]} alt="" />
          {game.sport} in {game.city}
          {game.isOrganizedBy(user) && (
            <span className="badge text-bg-dark">Organizer</span>
          )}
        </h2>
        <p className="game-meta mb-0">
          {game.venue} · organizer {game.organizerName()}
        </p>
      </div>
      <div className="game-side">
        {renderSide()}
        <Link
          className="btn btn-outline-secondary btn-sm"
          to={`/games/${game._id}`}
        >
          View game
        </Link>
      </div>
    </div>
  );
};

export default GameCard;
