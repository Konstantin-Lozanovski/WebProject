// Small functions that turn a value into the text shown on screen.
// Only the ones that more than one file uses live here.

// "18:00"
export const formatTime = (date) => {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

// "3 places left", "1 place left" or "Full"
export const formatPlaces = (placesLeft) => {
  if (placesLeft <= 0) return "Full";
  if (placesLeft === 1) return "1 place left";
  return `${placesLeft} places left`;
};
