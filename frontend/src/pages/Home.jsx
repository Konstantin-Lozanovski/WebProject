import { useState, useEffect } from "react";
import { fetchStatus } from "../services/api.js";

const SPORTS = ["Football", "Basketball", "Volleyball", "Tennis", "Padel"];
const CITIES = [
  "Skopje",
  "Bitola",
  "Kumanovo",
  "Prilep",
  "Tetovo",
  "Ohrid",
  "Veles",
  "Štip",
];

const Home = () => {
  const [apiStatus, setApiStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getStatus = async () => {
      try {
        const data = await fetchStatus();
        setApiStatus(data);
      } catch (error) {
        console.error("Error fetching API status:", error);
      } finally {
        setLoading(false);
      }
    };

    getStatus();
  }, []);

  const getStatusText = () => {
    if (loading) return "Checking the API...";
    if (!apiStatus) return "The API could not be reached";
    return `${apiStatus.msg} · database ${apiStatus.database}`;
  };

  // The filters do nothing yet, so the form must not reload the page
  const handleSearch = (e) => {
    e.preventDefault();
  };

  return (
    <>
      <h1 className="h2 mb-4">Upcoming games</h1>

      <form className="card card-body mb-4" onSubmit={handleSearch}>
        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-3">
            <label className="form-label" htmlFor="filterSport">
              Sport
            </label>
            <select className="form-select" id="filterSport">
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
            <select className="form-select" id="filterCity">
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
            <input className="form-control" type="date" id="filterDate" />
          </div>
          <div className="col-12 col-md-3">
            <button className="btn btn-primary w-100" type="submit">
              Search
            </button>
          </div>
        </div>
      </form>

      <div className="row g-4">
        <div className="col-12 col-lg-8">
          <div className="card mb-3">
            <div className="card-body">
              <h2 className="h5 mb-1">No games yet</h2>
              <p className="text-muted mb-0">{getStatusText()}</p>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card">
            <div className="card-header">Games per sport</div>
            <div className="card-body bg-light text-center text-muted py-5">
              Chart placeholder:
              <br />
              number of upcoming games for each sport
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
