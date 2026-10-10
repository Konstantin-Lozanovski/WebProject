import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import BarChart from "../components/BarChart.jsx";
import {
  fetchMyGames,
  fetchMyJoinRequests,
  fetchMyMonthCounts,
} from "../services/api.js";
import { STATE_BADGES } from "../models/JoinRequest.js";
import {
  formatDateTime,
  formatPlaces,
  getPlacesClass,
} from "../services/helpers.js";

// "2026-10" becomes "October"
const formatMonth = (month) => {
  // The first day of the month. A date written without a time is read as
  // UTC, so the name is asked for in UTC too, or a browser west of it
  // would answer with the month before.
  const firstDay = new Date(`${month}-01`);
  return firstDay.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
};

// user is the logged-in User; the route sends a guest to Login instead
const MyGames = ({ user }) => {
  // Upcoming games and the ones in progress
  const [currentGames, setCurrentGames] = useState([]);
  const [finishedGames, setFinishedGames] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // The user's finished games of each month once they arrived, or null
  const [monthCounts, setMonthCounts] = useState(null);
  // Why the chart could not be loaded; empty when it was
  const [chartError, setChartError] = useState("");

  useEffect(() => {
    const getLists = async () => {
      try {
        const games = await fetchMyGames();
        const requests = await fetchMyJoinRequests();
        setCurrentGames(games.currentGames);
        setFinishedGames(games.finishedGames);
        setJoinRequests(requests);
      } catch (error) {
        console.error("Error fetching my games:", error);
        setLoadError("Your games could not be loaded. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    // On its own, so a chart that fails does not take the lists with it
    const getMonthCounts = async () => {
      try {
        const data = await fetchMyMonthCounts();
        setMonthCounts(data);
      } catch (error) {
        console.error("Error fetching the month counts:", error);
        setChartError("The chart could not be loaded.");
      }
    };

    getLists();
    getMonthCounts();
    // Only once: the server takes the user from the token, so there is
    // nothing here that could change and ask for a new load
  }, []);

  // What stands at the right of a current game: the places left, or the
  // badge of a game that has already started
  const renderGameSide = (game) => {
    if (game.status === "in progress") {
      return <span className="badge text-bg-success">In progress</span>;
    }

    const placesLeft = game.placesLeft();
    return (
      <span className={`places ${getPlacesClass(placesLeft)}`}>
        {formatPlaces(placesLeft)}
      </span>
    );
  };

  // One game of either list. Only a current game gets something at the right.
  const renderGame = (game, isCurrent) => {
    return (
      <Link
        className="list-group-item list-group-item-action d-flex flex-wrap justify-content-between align-items-center gap-2"
        key={game._id}
        to={`/games/${game._id}`}
      >
        <div>
          <strong>
            {game.sport} in {game.city}
          </strong>{" "}
          {game.isOrganizedBy(user) && (
            <span className="badge text-bg-dark">Organizer</span>
          )}
          <br />
          <small className="text-muted">
            {game.venue} · {formatDateTime(game.startTime)} · {game.duration} min
          </small>
        </div>
        {isCurrent && renderGameSide(game)}
      </Link>
    );
  };

  const renderCurrentGames = () => {
    if (currentGames.length === 0) {
      return (
        <p className="text-muted mb-4">
          You are not a player in any upcoming game.
        </p>
      );
    }

    return (
      <div className="list-group mb-4">
        {currentGames.map((game) => renderGame(game, true))}
      </div>
    );
  };

  const renderFinishedGames = () => {
    if (finishedGames.length === 0) {
      return <p className="text-muted mb-4">You have no finished games yet.</p>;
    }

    return (
      <div className="list-group mb-4">
        {finishedGames.map((game) => renderGame(game, false))}
      </div>
    );
  };

  const renderJoinRequestRow = (joinRequest) => {
    const badge = STATE_BADGES[joinRequest.state];
    // In this list the game of a join request is an object and not an id.
    // It came as JSON, so its start time is still text.
    const game = joinRequest.game;

    return (
      <tr key={joinRequest._id}>
        <td>
          <Link to={`/games/${game._id}`}>
            {game.sport} in {game.city}
          </Link>
        </td>
        <td>{formatDateTime(new Date(game.startTime))}</td>
        <td>
          <span className={`badge text-bg-${badge.variant}`}>{badge.label}</span>
        </td>
      </tr>
    );
  };

  const renderJoinRequests = () => {
    if (joinRequests.length === 0) {
      return <p className="text-muted">You have not sent any join requests.</p>;
    }

    return (
      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th>Game</th>
              <th>Start time</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>{joinRequests.map(renderJoinRequestRow)}</tbody>
        </table>
      </div>
    );
  };

  const renderLists = () => {
    if (loading) return <p className="text-muted">Loading your games...</p>;
    if (loadError) return <div className="alert alert-danger">{loadError}</div>;

    return (
      <>
        <h2 className="h4 mb-3">Upcoming games</h2>
        {renderCurrentGames()}

        <h2 className="h4 mb-3">Finished games</h2>
        {renderFinishedGames()}

        <h2 className="h4 mb-3">My join requests</h2>
        {renderJoinRequests()}
      </>
    );
  };

  const renderChart = () => {
    if (chartError) return <p className="text-danger">{chartError}</p>;
    if (!monthCounts) return <p className="text-muted">Loading chart...</p>;

    return (
      <BarChart
        title="My games per month"
        labels={monthCounts.map((monthCount) => formatMonth(monthCount.month))}
        values={monthCounts.map((monthCount) => monthCount.count)}
        emptyText="You have no finished games in the last six months."
      />
    );
  };

  return (
    <div className="container py-4">
      <h1 className="h2 mb-4">My games</h1>

      <div className="row g-4">
        <div className="col-12 col-lg-8">{renderLists()}</div>

        <div className="col-12 col-lg-4">{renderChart()}</div>
      </div>
    </div>
  );
};

export default MyGames;
