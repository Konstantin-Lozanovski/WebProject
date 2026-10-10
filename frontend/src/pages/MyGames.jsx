import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import Stat from "../components/Stat.jsx";
import EmptyState from "../components/EmptyState.jsx";
import GameCard from "../components/GameCard.jsx";
import BarChart from "../components/BarChart.jsx";
import {
  fetchMyGames,
  fetchMyJoinRequests,
  fetchMyMonthCounts,
} from "../services/api.js";
import { SPORT_BALLS } from "../models/Game.js";
import { STATE_BADGES } from "../models/JoinRequest.js";
import { formatDateTime } from "../services/helpers.js";

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

  const renderCurrentGames = () => {
    if (currentGames.length === 0) {
      return (
        <EmptyState
          title="No upcoming games"
          text="You are not a player in any upcoming game."
        >
          <Link className="btn btn-primary btn-sm" to="/">
            Find a game
          </Link>
        </EmptyState>
      );
    }

    return (
      <div className="mb-4">
        {currentGames.map((game) => (
          <GameCard key={game._id} game={game} user={user} />
        ))}
      </div>
    );
  };

  const renderFinishedGameRow = (game) => {
    return (
      <tr key={game._id}>
        <td>
          {/* Empty alt: the link next to it already names the sport */}
          <img className="game-ball me-2" src={SPORT_BALLS[game.sport]} alt="" />
          <Link to={`/games/${game._id}`}>
            {game.sport} in {game.city}
          </Link>
          {game.isOrganizedBy(user) && (
            <span className="badge text-bg-dark ms-2">Organizer</span>
          )}
        </td>
        <td>{game.venue}</td>
        <td>{formatDateTime(game.startTime)}</td>
        <td>
          {game.playerCount} of {game.maxPlayers}
        </td>
      </tr>
    );
  };

  const renderFinishedGames = () => {
    if (finishedGames.length === 0) {
      return (
        <EmptyState
          title="No finished games"
          text="You have no finished games yet."
        />
      );
    }

    // A table and not cards: a finished game has nothing left to do in it,
    // and a long history stays short enough to read
    return (
      <div className="table-responsive mb-4">
        <table className="table align-middle">
          <thead>
            <tr>
              <th>Game</th>
              <th>Venue</th>
              <th>Start time</th>
              <th>Players</th>
            </tr>
          </thead>
          <tbody>{finishedGames.map(renderFinishedGameRow)}</tbody>
        </table>
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
      return (
        <EmptyState
          title="No join requests"
          text="You have not sent any join requests."
        />
      );
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
        <h2 className="section-title">Upcoming games</h2>
        {renderCurrentGames()}

        <h2 className="section-title">Finished games</h2>
        {renderFinishedGames()}

        <h2 className="section-title">My join requests</h2>
        {renderJoinRequests()}
      </>
    );
  };

  // The three numbers at the top of the page. Nothing until the lists arrived.
  const renderStats = () => {
    if (loading || loadError) return null;

    const pendingJoinRequests = joinRequests.filter((joinRequest) => {
      return joinRequest.isPending();
    });

    return (
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-4">
          <Stat
            label="Upcoming games"
            value={currentGames.length}
            note="you are a player in"
          />
        </div>
        <div className="col-12 col-sm-4">
          <Stat
            label="Finished games"
            value={finishedGames.length}
            note="played so far"
          />
        </div>
        <div className="col-12 col-sm-4">
          <Stat
            label="Pending join requests"
            value={pendingJoinRequests.length}
            note="waiting for an organizer"
          />
        </div>
      </div>
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
    <>
      <PageHeader
        title="My games"
        text="The games you are a player in and the join requests you sent."
      >
        <Link className="btn btn-light" to="/games/new">
          Create a game
        </Link>
      </PageHeader>
      <div className="container page-body">
        {renderStats()}

        <div className="row g-4">
          <div className="col-12 col-lg-8">{renderLists()}</div>

          <div className="col-12 col-lg-4">
            <div className="side-sticky">{renderChart()}</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MyGames;
