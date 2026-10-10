import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createGame } from "../services/api.js";
import {
  SPORTS,
  CITIES,
  DURATIONS,
  MAX_PLAYERS_OPTIONS,
} from "../models/Game.js";

// The same rules the server checks, so most mistakes are caught before
// the form is sent
const VENUE_REGEX = /^.{3,100}$/;
const NOTES_MAX_LENGTH = 300;
const MIN_HOURS_AHEAD = 2;
const MAX_DAYS_AHEAD = 60;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// value is the text of the datetime-local input, for example
// "2026-10-10T18:00", or "" when nothing was picked
const isStartTimeAllowed = (value) => {
  if (value === "") return false;

  const start = new Date(value).getTime();
  const earliest = Date.now() + MIN_HOURS_AHEAD * HOUR;
  const latest = Date.now() + MAX_DAYS_AHEAD * DAY;

  return start >= earliest && start <= latest;
};

const CreateGame = () => {
  // A select and an input always hold text, so duration and max players
  // are kept as text here and turned into numbers when the form is sent
  const [sport, setSport] = useState("");
  const [city, setCity] = useState("");
  const [venue, setVenue] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [notes, setNotes] = useState("");
  // One message per field, for example { venue: "..." }
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const validateForm = () => {
    const errors = {};
    if (!SPORTS.includes(sport)) errors.sport = "Please choose a sport";
    if (!CITIES.includes(city)) errors.city = "Please choose a city";
    if (!VENUE_REGEX.test(venue.trim()))
      errors.venue = "Venue must be 3 to 100 characters";
    if (!isStartTimeAllowed(startTime))
      errors.startTime =
        "Start time must be at least 2 hours and at most 60 days from now";
    if (!DURATIONS.includes(Number(duration)))
      errors.duration = "Please choose a duration";
    if (!MAX_PLAYERS_OPTIONS.includes(Number(maxPlayers)))
      errors.maxPlayers = "Please choose the max number of players";
    if (notes.trim().length > NOTES_MAX_LENGTH)
      errors.notes = "Notes must be at most 300 characters";
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const errors = validateForm();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const game = await createGame({
        sport,
        city,
        venue: venue.trim(),
        // The input gives the time on this computer's clock; toISOString
        // turns it into the one format the server expects, with the time zone
        startTime: new Date(startTime).toISOString(),
        duration: Number(duration),
        maxPlayers: Number(maxPlayers),
        notes: notes.trim(),
      });
      navigate(`/games/${game._id}`);
    } catch (error) {
      console.error("Error creating the game:", error);
      const data = error.response ? error.response.data : null;
      // The server names the field when one breaks a rule, so its message
      // goes beside that field; anything else (for example an overlap with
      // another game) goes above the form
      if (data && data.fields) {
        setFieldErrors(data.fields);
      } else {
        setFormError(data ? data.msg : "The server could not be reached");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-md-10 col-lg-7">
          <h1 className="h2 mb-4">Create game</h1>

          {/* noValidate turns off the browser's own popups, so our messages show */}
          <form className="card card-body" onSubmit={handleSubmit} noValidate>
            {formError && <div className="alert alert-danger">{formError}</div>}

            <div className="row g-3">
              <div className="col-12 col-sm-6">
                <label className="form-label" htmlFor="sport">
                  Sport
                </label>
                <select
                  className={`form-select ${fieldErrors.sport ? "is-invalid" : ""}`}
                  id="sport"
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                >
                  <option value="" disabled>
                    Choose a sport
                  </option>
                  {SPORTS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                <div className="invalid-feedback">{fieldErrors.sport}</div>
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label" htmlFor="city">
                  City
                </label>
                <select
                  className={`form-select ${fieldErrors.city ? "is-invalid" : ""}`}
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  <option value="" disabled>
                    Choose a city
                  </option>
                  {CITIES.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                <div className="invalid-feedback">{fieldErrors.city}</div>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="venue">
                  Venue
                </label>
                <input
                  className={`form-control ${fieldErrors.venue ? "is-invalid" : ""}`}
                  type="text"
                  id="venue"
                  placeholder="The pitch, court or hall"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                />
                <div className="invalid-feedback">{fieldErrors.venue}</div>
                <div className="form-text">3 to 100 characters.</div>
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label" htmlFor="startTime">
                  Start time
                </label>
                <input
                  className={`form-control ${fieldErrors.startTime ? "is-invalid" : ""}`}
                  type="datetime-local"
                  id="startTime"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                <div className="invalid-feedback">{fieldErrors.startTime}</div>
                <div className="form-text">
                  At least 2 hours from now and at most 60 days ahead.
                </div>
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label" htmlFor="duration">
                  Duration
                </label>
                <select
                  className={`form-select ${fieldErrors.duration ? "is-invalid" : ""}`}
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option value="" disabled>
                    Choose a duration
                  </option>
                  {DURATIONS.map((option) => (
                    <option key={option} value={option}>
                      {option} min
                    </option>
                  ))}
                </select>
                <div className="invalid-feedback">{fieldErrors.duration}</div>
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label" htmlFor="maxPlayers">
                  Max players
                </label>
                <select
                  className={`form-select ${fieldErrors.maxPlayers ? "is-invalid" : ""}`}
                  id="maxPlayers"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                >
                  <option value="" disabled>
                    Choose a number
                  </option>
                  {MAX_PLAYERS_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                <div className="invalid-feedback">{fieldErrors.maxPlayers}</div>
                <div className="form-text">You count as one of the players.</div>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="notes">
                  Notes (optional)
                </label>
                <textarea
                  className={`form-control ${fieldErrors.notes ? "is-invalid" : ""}`}
                  id="notes"
                  rows="3"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                ></textarea>
                <div className="invalid-feedback">{fieldErrors.notes}</div>
                <div className="form-text">Up to 300 characters.</div>
              </div>
              <div className="col-12 d-flex gap-2">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={submitting}
                >
                  Create game
                </button>
                <Link className="btn btn-outline-secondary" to="/">
                  Back
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateGame;
