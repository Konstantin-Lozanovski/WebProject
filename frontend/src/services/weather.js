import axios from "axios";

// The service for the external weather source, Open-Meteo. It uses axios
// itself and not our axiosInstance: that one sends the user's token with
// every request, and the token is only for our own API. Open-Meteo needs no
// key or login.
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

// Where each city of a game is on the map. Open-Meteo is asked by
// coordinates, not by a city's name.
const CITY_COORDINATES = {
  Skopje: { latitude: 41.9981, longitude: 21.4254 },
  Bitola: { latitude: 41.0297, longitude: 21.3292 },
  Kumanovo: { latitude: 42.1322, longitude: 21.7144 },
  Prilep: { latitude: 41.3451, longitude: 21.555 },
  Tetovo: { latitude: 42.0106, longitude: 20.9715 },
  Ohrid: { latitude: 41.1231, longitude: 20.8016 },
  Veles: { latitude: 41.7156, longitude: 21.7756 },
  Štip: { latitude: 41.7458, longitude: 22.1958 },
};

// Open-Meteo describes the conditions with a number (a WMO weather code).
// This is the text shown for each one.
const CONDITIONS = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light rain showers",
  81: "Rain showers",
  82: "Heavy rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

// The small picture shown next to the temperature. The codes come in groups
// (the 50s and 60s are rain, the 70s are snow), so a few limits are enough
// and not every code needs a line of its own. isDay is false at night,
// when a clear sky is a moon and not a sun.
const getIcon = (code, isDay) => {
  // A code we have no text for gets no picture either
  if (!CONDITIONS[code]) return "";

  if (code <= 1) return isDay ? "☀️" : "🌙";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "❄️";
  return "⛈️";
};

// "2026-10-10T16:00": the hour the date falls in, the way Open-Meteo wants
// it. toISOString gives the time in UTC, which is also what Open-Meteo
// reads the hour as when no time zone is sent.
const toForecastHour = (date) => {
  return `${date.toISOString().slice(0, 13)}:00`;
};

// GET https://api.open-meteo.com/v1/forecast
// The forecast for one city at the hour of startTime (a Date)
export const fetchForecast = async (city, startTime) => {
  const hour = toForecastHour(startTime);
  const coordinates = CITY_COORDINATES[city];

  const response = await axios.get(FORECAST_URL, {
    params: {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      hourly:
        "temperature_2m,weather_code,wind_speed_10m,precipitation_probability,is_day",
      // The same hour as start and end, so the answer holds only that hour
      start_hour: hour,
      end_hour: hour,
    },
  });

  // Every value comes as a list with one item per hour; we asked for one hour
  const hourly = response.data.hourly;
  // Open-Meteo sends null for a value it has no forecast for. Thrown as an
  // error so the page shows its "could not be loaded" message, not "0 °C".
  if (hourly.temperature_2m[0] === null) {
    throw new Error("Open-Meteo has no forecast for this hour");
  }

  return {
    // In °C
    temperature: hourly.temperature_2m[0],
    description: CONDITIONS[hourly.weather_code[0]] || "Unknown conditions",
    // is_day is 1 while the sun is up at that hour and 0 at night
    icon: getIcon(hourly.weather_code[0], hourly.is_day[0] === 1),
    // In km/h
    windSpeed: hourly.wind_speed_10m[0],
    // In percent
    rainChance: hourly.precipitation_probability[0],
  };
};
