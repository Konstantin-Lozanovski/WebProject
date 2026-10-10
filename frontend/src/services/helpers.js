// Small functions that turn a value into the text shown on screen.
// Only the ones that more than one file uses live here.

// "18:00"
export const formatTime = (date) => {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

// "Sat, 10 Oct 2026, 18:00"
export const formatDateTime = (date) => {
  const day = date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${day}, ${formatTime(date)}`;
};

// "3 places left", "1 place left" or "Full"
export const formatPlaces = (placesLeft) => {
  if (placesLeft <= 0) return "Full";
  if (placesLeft === 1) return "1 place left";
  return `${placesLeft} places left`;
};

// The colour of the "places left" text: grey when full, amber when the
// game is nearly full, green otherwise
export const getPlacesClass = (placesLeft) => {
  if (placesLeft <= 0) return "places-full";
  if (placesLeft <= 2) return "places-few";
  return "places-open";
};
