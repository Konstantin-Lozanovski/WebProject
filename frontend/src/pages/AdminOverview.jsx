import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import UserList from "../components/UserList.jsx";
import { fetchTotals, fetchAllGames, deleteGame } from "../services/api.js";
import { STATUSES, STATUS_BADGES } from "../models/Game.js";
import { STATES, STATE_BADGES } from "../models/JoinRequest.js";
import { formatDateTime } from "../services/helpers.js";

// Asks the API for the two parts of the page that change together: deleting
// a game or a user changes both the totals and the list of games
const loadOverview = async () => {
  const totals = await fetchTotals();
  const games = await fetchAllGames();
  return { totals, games };
};

// The admin's own screen. user is the logged-in admin; the route sends
// everyone else away.
const AdminOverview = ({ user }) => {
  // The numbers at the top once they arrived, or null
  const [totals, setTotals] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Why the last delete of a game was refused; empty when it worked
  const [actionError, setActionError] = useState("");
  // True while a delete is on its way, so it cannot be sent twice
  const [working, setWorking] = useState(false);
  // The game waiting in the "Delete?" popup, or null
  const [gameToDelete, setGameToDelete] = useState(null);

  useEffect(() => {
    const getOverview = async () => {
      try {
        const overview = await loadOverview();
        setTotals(overview.totals);
        setGames(overview.games);
      } catch (error) {
        console.error("Error fetching the overview:", error);
        setLoadError("The overview could not be loaded. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    getOverview();
  }, []);

  // Loads the totals and the games again after something was deleted. A
  // failure here only leaves the old numbers on screen, so it is not shown.
  const refreshOverview = async () => {
    try {
      const overview = await loadOverview();
      setTotals(overview.totals);
      setGames(overview.games);
      // The first load may have failed; now there is something to show
      setLoadError("");
    } catch (error) {
      console.error("Error fetching the overview:", error);
    }
  };

  const handleDeleteGame = async () => {
    const game = gameToDelete;
    setGameToDelete(null);
    setActionError("");
    setWorking(true);

    try {
      await deleteGame(game._id);
    } catch (error) {
      console.error("Error deleting the game:", error);
      const data = error.response ? error.response.data : null;
      const reason = data ? data.msg : "The server could not be reached";
      setActionError(
        `${game.sport} in ${game.city} could not be deleted: ${reason}`,
      );
    }

    // Also after a refused delete: a refusal usually means the list was
    // out of date (the game was already cancelled by its organizer)
    await refreshOverview();
    setWorking(false);
  };

  const renderTotals = () => {
    return (
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="card h-100">
            <div className="card-header">Users</div>
            <div className="card-body">
              <p className="display-6 mb-0">{totals.users}</p>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card h-100">
            <div className="card-header">Games by status</div>
            <ul className="list-group list-group-flush">
              {STATUSES.map((status) => (
                <li
                  className="list-group-item d-flex justify-content-between"
                  key={status}
                >
                  {STATUS_BADGES[status].label}
                  <strong>{totals.games[status]}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card h-100">
            <div className="card-header">Join requests by state</div>
            <ul className="list-group list-group-flush">
              {STATES.map((state) => (
                <li
                  className="list-group-item d-flex justify-content-between"
                  key={state}
                >
                  {STATE_BADGES[state].label}
                  <strong>{totals.joinRequests[state]}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderGameRow = (game) => {
    const badge = STATUS_BADGES[game.status];

    return (
      <tr key={game._id}>
        <td>{game.sport}</td>
        <td>{game.city}</td>
        <td>{game.venue}</td>
        <td>{formatDateTime(game.startTime)}</td>
        <td>
          <span className={`badge text-bg-${badge.variant}`}>{badge.label}</span>
        </td>
        <td>
          {game.playerCount} of {game.maxPlayers}
        </td>
        <td>{game.organizerName()}</td>
        <td className="text-end">
          <Link
            className="btn btn-outline-primary btn-sm me-1"
            to={`/games/${game._id}`}
          >
            View
          </Link>
          <Link
            className="btn btn-outline-primary btn-sm me-1"
            to={`/games/${game._id}/edit`}
          >
            Edit
          </Link>
          <button
            className="btn btn-outline-danger btn-sm"
            type="button"
            disabled={working}
            onClick={() => setGameToDelete(game)}
          >
            Delete
          </button>
        </td>
      </tr>
    );
  };

  const renderGames = () => {
    if (games.length === 0) {
      return <p className="text-muted mb-4">There are no games yet.</p>;
    }

    // table-responsive lets the wide table scroll sideways on a phone;
    // text-nowrap keeps each cell on one line instead of squeezing the columns
    return (
      <div className="table-responsive mb-4">
        <table className="table table-striped align-middle text-nowrap">
          <thead>
            <tr>
              <th>Sport</th>
              <th>City</th>
              <th>Venue</th>
              <th>Start time</th>
              <th>Status</th>
              <th>Players</th>
              <th>Organizer</th>
              <th></th>
            </tr>
          </thead>
          <tbody>{games.map(renderGameRow)}</tbody>
        </table>
      </div>
    );
  };

  const renderOverview = () => {
    if (loading) return <p className="text-muted">Loading overview...</p>;
    if (loadError) return <div className="alert alert-danger">{loadError}</div>;

    return (
      <>
        {renderTotals()}

        <h2 className="h4 mb-3">Games</h2>
        {actionError && <div className="alert alert-danger">{actionError}</div>}
        {renderGames()}
      </>
    );
  };

  return (
    <div className="container py-4">
      <h1 className="h2 mb-4">Admin overview</h1>

      {renderOverview()}

      {/* The list loads its own users, so it still works when the totals
          and the games above could not be loaded */}
      <UserList user={user} onDelete={refreshOverview} />

      {gameToDelete && (
        <Modal
          title="Delete this game?"
          text={`${gameToDelete.sport} in ${gameToDelete.city} on ${formatDateTime(gameToDelete.startTime)} will be deleted together with its join requests, players and chat messages. This cannot be undone.`}
          confirmLabel="Delete game"
          cancelLabel="Keep game"
          confirmVariant="danger"
          onConfirm={handleDeleteGame}
          onClose={() => setGameToDelete(null)}
        />
      )}
    </div>
  );
};

export default AdminOverview;
