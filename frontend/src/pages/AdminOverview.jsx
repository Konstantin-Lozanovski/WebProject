import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Modal from "../components/Modal.jsx";
import UserList from "../components/UserList.jsx";
import BarChart from "../components/BarChart.jsx";
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
  // The status whose games the table shows; empty means every status
  const [statusFilter, setStatusFilter] = useState("");
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

  // The totals: two cards of numbers on the left (the users and the join
  // requests of each state) and the games of each status as a chart on the
  // right
  const renderTotals = () => {
    return (
      <div className="row g-3 mb-4">
        {/* The two cards share the height of the chart beside them:
            flex-column puts one under the other, flex-fill lets each grow */}
        <div className="col-12 col-lg-6 d-flex flex-column gap-3">
          <div className="card flex-fill">
            <div className="card-header">Users</div>
            <div className="card-body stat-group align-items-center">
              <div>
                <div className="stat-value">{totals.users}</div>
                <div className="stat-label">Accounts</div>
              </div>
            </div>
          </div>
          <div className="card flex-fill">
            <div className="card-header">Join requests by state</div>
            <div className="card-body stat-group align-items-center">
              {STATES.map((state) => (
                <div key={state}>
                  <div className="stat-value">{totals.joinRequests[state]}</div>
                  <div className="stat-label">{STATE_BADGES[state].label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <BarChart
            title="Games by status"
            labels={STATUSES.map((status) => STATUS_BADGES[status].label)}
            values={STATUSES.map((status) => totals.games[status])}
            emptyText="There are no games yet."
          />
        </div>
      </div>
    );
  };

  // "btn-primary" marks the button of the status being shown
  const getFilterClass = (status) => {
    const variant = status === statusFilter ? "btn-primary" : "btn-outline-primary";
    return `btn btn-sm ${variant}`;
  };

  // One button for every status and one for all of them: a closed set, so
  // buttons and not a text field
  const renderStatusFilter = () => {
    return (
      <div className="btn-group mb-3" role="group" aria-label="Filter games by status">
        <button
          className={getFilterClass("")}
          type="button"
          onClick={() => setStatusFilter("")}
        >
          All
        </button>
        {STATUSES.map((status) => (
          <button
            key={status}
            className={getFilterClass(status)}
            type="button"
            onClick={() => setStatusFilter(status)}
          >
            {STATUS_BADGES[status].label}
          </button>
        ))}
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
      return <EmptyState title="No games" text="There are no games yet." />;
    }

    // The games were all loaded already, so the filter only picks which
    // rows to show and asks the server for nothing
    const shownGames = games.filter((game) => {
      return statusFilter === "" || game.status === statusFilter;
    });

    // table-responsive lets the wide table scroll sideways on a phone;
    // text-nowrap keeps each cell on one line instead of squeezing the columns
    return (
      <>
        {renderStatusFilter()}
        {shownGames.length === 0 ? (
          <EmptyState
            title="No games with this status"
            text="Choose another status or All."
          />
        ) : (
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
              <tbody>{shownGames.map(renderGameRow)}</tbody>
            </table>
          </div>
        )}
      </>
    );
  };

  const renderOverview = () => {
    if (loading) return <p className="text-muted">Loading overview...</p>;
    if (loadError) return <div className="alert alert-danger">{loadError}</div>;

    return (
      <>
        {renderTotals()}

        <h2 className="section-title">Games</h2>
        {actionError && <div className="alert alert-danger">{actionError}</div>}
        {renderGames()}
      </>
    );
  };

  return (
    <>
      <PageHeader
        title="Admin overview"
        text="Every game and every user of the app. An admin can change or delete any of them at any time."
      />
      <div className="container page-body">
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
    </>
  );
};

export default AdminOverview;
