import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Hero from "../components/Hero.jsx";
import GameCard from "../components/GameCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import BarChart from "../components/BarChart.jsx";
import { fetchUpcomingGames, fetchSportCounts } from "../services/api.js";
import { SPORTS, CITIES } from "../models/Game.js";

// What a date input gives: "2026-10-12"
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// user is null for a guest
const Home = ({ user }) => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // The number of games of each sport once it arrived, or null
  const [sportCounts, setSportCounts] = useState(null);
  // Why the chart could not be loaded; empty when it was
  const [chartError, setChartError] = useState("");

  // The chosen filters live in the address (/?sport=Padel&city=Bitola) and
  // nowhere else, so refresh, back and forward all show the same results
  const [searchParams, setSearchParams] = useSearchParams();

  // The address can be typed by hand, so a value that is not one of the
  // options counts as "not chosen". get() returns null for a missing filter.
  let sport = searchParams.get("sport") || "";
  if (!SPORTS.includes(sport)) sport = "";
  let city = searchParams.get("city") || "";
  if (!CITIES.includes(city)) city = "";
  let date = searchParams.get("date") || "";
  if (!DATE_REGEX.test(date)) date = "";

  const hasFilters = sport !== "" || city !== "" || date !== "";

  useEffect(() => {
    // Set by the cleanup below when a filter changes before the answer
    // arrives, so an old, slower answer cannot replace a newer one
    let outdated = false;

    const getGames = async () => {
      // Back to "Loading games..." on every search, so the old list is never
      // shown under the new filters
      setLoading(true);
      try {
        const data = await fetchUpcomingGames(sport, city, date);
        if (outdated) return;
        setGames(data);
        setLoadError("");
      } catch (error) {
        console.error("Error fetching games:", error);
        if (outdated) return;
        // The server explains a refused filter (for example a date typed in
        // the address that is not a real day), so its message is shown
        const data = error.response ? error.response.data : null;
        setLoadError(
          data ? data.msg : "The games could not be loaded. Please try again later.",
        );
      } finally {
        // An outdated answer must not end the loading of the newer search
        if (!outdated) setLoading(false);
      }
    };

    getGames();

    return () => {
      outdated = true;
    };
    // Runs again every time a filter in the address changes
  }, [sport, city, date]);

  useEffect(() => {
    const getSportCounts = async () => {
      try {
        const data = await fetchSportCounts();
        setSportCounts(data);
      } catch (error) {
        console.error("Error fetching the sport counts:", error);
        setChartError("The chart could not be loaded.");
      }
    };

    getSportCounts();
    // Only once: the chart counts every game, so the filters do not change it
  }, []);

  // name is "sport", "city" or "date"; an empty value removes the filter
  // from the address
  const changeFilter = (name, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === "") {
      newParams.delete(name);
    } else {
      newParams.set(name, value);
    }
    // A date typed on the keyboard changes with every digit of the year, and
    // each of those must not become a step of the Back button. So a date
    // replaces the current address, while a sport or a city adds a new one.
    setSearchParams(newParams, { replace: name === "date" });
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const renderChart = () => {
    if (chartError) return <p className="text-danger">{chartError}</p>;
    if (!sportCounts) return <p className="text-muted">Loading chart...</p>;

    return (
      <BarChart
        title="Games per sport"
        labels={sportCounts.map((sportCount) => sportCount.sport)}
        values={sportCounts.map((sportCount) => sportCount.count)}
        emptyText="There are no games yet."
      />
    );
  };

  const renderGames = () => {
    if (loading) return <p className="text-muted">Loading games...</p>;
    if (loadError) return <div className="alert alert-danger">{loadError}</div>;

    if (games.length === 0 && hasFilters) {
      return (
        <EmptyState
          title="No games found"
          text="No upcoming game matches these filters. Try changing or clearing them."
        />
      );
    }

    if (games.length === 0) {
      return (
        <EmptyState
          title="No upcoming games"
          text="There is no game to join right now."
        />
      );
    }

    return games.map((game) => <GameCard key={game._id} game={game} />);
  };

  return (
    <>
      <Hero user={user} />

      {/* The title and the filters sit in a band under the intro, so
          the page below is only games */}
      <div className="band">
        <div className="container">
          {/* h2: the page's h1 is the title of the intro above */}
          <h2 className="h3 mb-3">Upcoming games</h2>
          {/* Not a form: there is nothing to submit, every change searches
              right away */}
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-3">
              <label className="form-label" htmlFor="filterSport">
                Sport
              </label>
              <select
                className="form-select"
                id="filterSport"
                value={sport}
                onChange={(e) => changeFilter("sport", e.target.value)}
              >
                <option value="">All sports</option>
                {SPORTS.map((sport) => (
                  <option key={sport}>{sport}</option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label" htmlFor="filterCity">
                City
              </label>
              <select
                className="form-select"
                id="filterCity"
                value={city}
                onChange={(e) => changeFilter("city", e.target.value)}
              >
                <option value="">All cities</option>
                {CITIES.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label" htmlFor="filterDate">
                Date
              </label>
              {/* An empty date input is the "any date" choice */}
              <input
                className="form-control"
                type="date"
                id="filterDate"
                value={date}
                onChange={(e) => changeFilter("date", e.target.value)}
              />
            </div>
            <div className="col-12 col-md-3">
              <button
                className="btn btn-light w-100"
                type="button"
                onClick={clearFilters}
                disabled={!hasFilters}
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-4">
        <div className="row g-4">
          <div className="col-12 col-lg-8">{renderGames()}</div>

          <div className="col-12 col-lg-4">{renderChart()}</div>
        </div>
      </div>
    </>
  );
};

export default Home;
