import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchGame } from "../services/api.js";
import { formatTime, formatPlaces } from "../services/helpers.js";

// How each status is shown: its text and the Bootstrap colour of its badge
const STATUS_BADGES = {
  upcoming: { label: "Upcoming", variant: "primary" },
  "in progress": { label: "In progress", variant: "success" },
  finished: { label: "Finished", variant: "secondary" },
};

// "Sat, 10 Oct 2026, 18:00"
const formatDateTime = (date) => {
  const day = date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${day}, ${formatTime(date)}`;
};

const GamePage = () => {
  // The id is the ":id" part of the address /games/:id
  const { id } = useParams();

  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  // Empty when the game loaded; otherwise what to tell the user
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const getGame = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const data = await fetchGame(id);
        setGame(data.game);
        setPlayers(data.players);
      } catch (error) {
        console.error("Error fetching the game:", error);
        const status = error.response ? error.response.status : null;
        // 404 is a game that does not exist (any more); 400 is an address
        // whose id could never be a game's id. Both mean the same to a user.
        if (status === 404 || status === 400) {
          setLoadError("Game not found. It may have been cancelled.");
        } else {
          setLoadError("The game could not be loaded. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    };

    getGame();
    // Runs again when the id changes, so moving from one game's address
    // to another's loads the other game
  }, [id]);

  if (loading) return <p className="text-center py-5">Loading...</p>;

  if (loadError) {
    return (
      <div className="container text-center py-5">
        <h1 className="h2 mb-3">{loadError}</h1>
        <Link className="btn btn-primary" to="/">
          Back to Home
        </Link>
      </div>
    );
  }

  const badge = STATUS_BADGES[game.status];

  // Either side can be missing when that account was deleted
  const isOrganizer = (player) => {
    if (!game.organizer || !player.user) return false;
    return player.user._id === game.organizer._id;
  };

  return (
    <div className="container py-4">
      <div className="mb-4">
        <h1 className="h2 mb-1">
          {game.sport} in {game.city}{" "}
          <span className={`badge text-bg-${badge.variant} fs-6 align-middle`}>
            {badge.label}
          </span>
        </h1>
        <p className="text-muted mb-0">Organizer: {game.organizerName()}</p>
      </div>

      <div className="row g-4">
        <div className="col-12 col-md-7">
          <div className="card h-100">
            <div className="card-header">Details</div>
            <div className="card-body">
              <dl className="row mb-0">
                <dt className="col-5 col-sm-4">Sport</dt>
                <dd className="col-7 col-sm-8">{game.sport}</dd>
                <dt className="col-5 col-sm-4">City</dt>
                <dd className="col-7 col-sm-8">{game.city}</dd>
                <dt className="col-5 col-sm-4">Venue</dt>
                <dd className="col-7 col-sm-8">{game.venue}</dd>
                <dt className="col-5 col-sm-4">Start time</dt>
                <dd className="col-7 col-sm-8">
                  {formatDateTime(game.startTime)}
                </dd>
                <dt className="col-5 col-sm-4">Duration</dt>
                <dd className="col-7 col-sm-8">{game.duration} min</dd>
                <dt className="col-5 col-sm-4">Players</dt>
                <dd className="col-7 col-sm-8">
                  {game.playerCount} of {game.maxPlayers} ·{" "}
                  {formatPlaces(game.placesLeft())}
                </dd>
                <dt className="col-5 col-sm-4">Notes</dt>
                <dd className="col-7 col-sm-8 mb-0">
                  {game.notes || <span className="text-muted">No notes</span>}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-5">
          <div className="card h-100">
            <div className="card-header">
              Players{" "}
              <span className="text-muted">
                ({game.playerCount} of {game.maxPlayers})
              </span>
            </div>
            <ul className="list-group list-group-flush">
              {players.map((player) => (
                <li className="list-group-item" key={player._id}>
                  {player.username()}{" "}
                  {isOrganizer(player) && (
                    <span className="badge text-bg-dark">Organizer</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePage;
