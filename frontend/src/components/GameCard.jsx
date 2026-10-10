import { Link } from "react-router-dom";
import { formatTime, formatPlaces, getPlacesClass } from "../services/helpers.js";

// "Sat 10 Oct"
const formatShortDate = (date) => {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

// One game in a list of games
const GameCard = ({ game }) => {
  const placesLeft = game.placesLeft();

  return (
    <div className={`game mb-3 ${game.isFull() ? "is-full" : ""}`}>
      <div className="game-time">
        <small>{formatShortDate(game.startTime)}</small>
        {formatTime(game.startTime)}
        <small>{game.duration} min</small>
      </div>
      <div>
        <h2 className="game-title mb-1">
          {game.sport} in {game.city}
        </h2>
        <p className="game-meta mb-0">
          {game.venue} · organizer {game.organizerName()}
        </p>
      </div>
      <div className="game-side">
        <span className={`places ${getPlacesClass(placesLeft)} d-block mb-2`}>
          {formatPlaces(placesLeft)}
        </span>
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
