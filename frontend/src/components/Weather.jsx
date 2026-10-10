import { useState, useEffect } from "react";
import { fetchForecast } from "../services/weather.js";
import { formatDateTime } from "../services/helpers.js";

const DAY = 24 * 60 * 60 * 1000;
// Open-Meteo forecasts 16 days counting today, so a game that starts within
// 15 full days from now is always inside the range
const FORECAST_RANGE = 15 * DAY;

// "17 °C"
const formatTemperature = (degrees) => {
  return `${Math.round(degrees)} °C`;
};

// There is no forecast for a game too far ahead, and a finished game no
// longer needs one
const hasForecast = (game) => {
  if (game.status === "finished") return false;
  return game.startTime.getTime() - Date.now() < FORECAST_RANGE;
};

// The weather forecast for the game's city at the hour the game starts.
// Everyone sees it, guests too.
const Weather = ({ game }) => {
  // The forecast once it arrived, or null
  const [forecast, setForecast] = useState(null);
  // Why the forecast could not be loaded; empty when it was
  const [loadError, setLoadError] = useState("");

  const city = game.city;
  // As a number, because the page makes a new game object (and a new Date)
  // every time it reloads; a number only changes when the time really does
  const startMs = game.startTime.getTime();
  const isAvailable = hasForecast(game);

  useEffect(() => {
    // No request for a forecast that cannot exist
    if (!isAvailable) return;

    const getForecast = async () => {
      try {
        const loaded = await fetchForecast(city, new Date(startMs));
        setForecast(loaded);
        setLoadError("");
      } catch (error) {
        console.error("Error fetching the forecast:", error);
        setLoadError("The forecast could not be loaded.");
      }
    };

    getForecast();
  }, [city, startMs, isAvailable]);

  const getContent = () => {
    if (!isAvailable) {
      return <p className="text-muted mb-0">Forecast not available yet.</p>;
    }
    if (loadError) return <p className="text-danger mb-0">{loadError}</p>;
    if (!forecast) return <p className="text-muted mb-0">Loading...</p>;

    return (
      <>
        <p className="display-6 mb-1">{formatTemperature(forecast.temperature)}</p>
        <p className="mb-1">{forecast.description}</p>
        {/* The far end of the forecast has a temperature but no rain chance */}
        {forecast.rainChance !== null && (
          <p className="mb-1">
            Wind {Math.round(forecast.windSpeed)} km/h · chance of rain{" "}
            {forecast.rainChance}%
          </p>
        )}
        <p className="text-muted mb-0">
          <small>
            {city}, {formatDateTime(game.startTime)} · source: Open-Meteo
          </small>
        </p>
      </>
    );
  };

  return (
    <div className="card h-100">
      <div className="card-header">Weather forecast</div>
      <div className="card-body">{getContent()}</div>
    </div>
  );
};

export default Weather;
