import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import JoinPanel from "../components/JoinPanel.jsx";
import PendingJoinRequests from "../components/PendingJoinRequests.jsx";
import {
  fetchGame,
  deleteGame,
  fetchMyJoinRequest,
  fetchPendingJoinRequests,
  sendJoinRequest,
  answerJoinRequest,
  withdrawJoinRequest,
  deletePlayer,
} from "../services/api.js";
import { formatDateTime, formatPlaces } from "../services/helpers.js";

// How each status is shown: its text and the Bootstrap colour of its badge
const STATUS_BADGES = {
  upcoming: { label: "Upcoming", variant: "primary" },
  "in progress": { label: "In progress", variant: "success" },
  finished: { label: "Finished", variant: "secondary" },
};

// Asks the API for everything the page shows to this user (null for a
// guest). Not every user may ask for every part: a guest has no join
// request of their own, and only the organizer and admins get the pending
// ones. Asking anyway would be answered with 401 or 403.
const loadGamePage = async (id, user) => {
  const data = await fetchGame(id);

  let myJoinRequest = null;
  if (user) {
    myJoinRequest = await fetchMyJoinRequest(id);
  }

  let pendingJoinRequests = [];
  if (data.game.showsJoinRequestsTo(user)) {
    pendingJoinRequests = await fetchPendingJoinRequests(id);
  }

  return {
    game: data.game,
    players: data.players,
    myJoinRequest,
    pendingJoinRequests,
  };
};

// user is the logged-in user, or null for a guest
const GamePage = ({ user }) => {
  // The id is the ":id" part of the address /games/:id
  const { id } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  // Empty when the game loaded; otherwise what to tell the user
  const [loadError, setLoadError] = useState("");
  // Whether the "Cancel this game?" popup is open
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelError, setCancelError] = useState("");
  // True while the cancel request is on its way, so it cannot be sent twice
  const [cancelling, setCancelling] = useState(false);
  // The logged-in user's own join request for this game, or null
  const [myJoinRequest, setMyJoinRequest] = useState(null);
  // Stays empty for everyone but the organizer and admins
  const [pendingJoinRequests, setPendingJoinRequests] = useState([]);
  const [joinError, setJoinError] = useState("");
  // True while a join request action is on its way
  const [working, setWorking] = useState(false);
  // The join request waiting in the "Decline?" popup, or null
  const [joinRequestToDecline, setJoinRequestToDecline] = useState(null);
  // Whether the "Leave this game?" popup is open
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  // The player waiting in the "Remove?" popup, or null
  const [playerToRemove, setPlayerToRemove] = useState(null);

  // The logged-in user's own player in this game; undefined for a guest and
  // for a user who is not a player. A player whose account was deleted has
  // no user.
  const myPlayer = players.find((player) => {
    return user && player.user && player.user._id === user._id;
  });

  const showPage = (page) => {
    setGame(page.game);
    setPlayers(page.players);
    setMyJoinRequest(page.myJoinRequest);
    setPendingJoinRequests(page.pendingJoinRequests);
  };

  useEffect(() => {
    const getGame = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const page = await loadGamePage(id, user);
        showPage(page);
      } catch (error) {
        console.error("Error fetching the game:", error);
        const status = error.response ? error.response.status : null;
        // 404 is a game that does not exist (any more); 400 is an address
        // whose id could never be a game's id. Both mean the same to a user.
        if (status === 404 || status === 400) {
          setLoadError("Game not found. It may have been cancelled.");
        } else {
          setLoadError("The game could not be loaded. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    };

    getGame();
    // Runs again when the id changes, so moving from one game's address
    // to another's loads the other game, and when the user changes, because
    // logging out changes what the page may show
  }, [id, user]);

  const handleCancelGame = async () => {
    setConfirmingCancel(false);
    setCancelError("");
    setCancelling(true);

    try {
      await deleteGame(id);
      // The game no longer exists, so there is nothing left to show here
      navigate("/");
    } catch (error) {
      console.error("Error cancelling the game:", error);
      const data = error.response ? error.response.data : null;
      setCancelError(data ? data.msg : "The server could not be reached");
      setCancelling(false);
    }
  };

  // Every join request action goes through here: it runs the action, then
  // loads the page again, because one action can change the places left,
  // the players and both kinds of join requests at once.
  // action is a function that sends the request to the API.
  const runJoinAction = async (action) => {
    setJoinError("");
    setWorking(true);

    try {
      await action();
    } catch (error) {
      console.error("Error changing a join request:", error);
      const data = error.response ? error.response.data : null;
      // The server's message says which rule refused it (full, overlap, ...)
      setJoinError(data ? data.msg : "The server could not be reached");
    }

    // Also after a refused action: a refusal usually means the page was
    // out of date (the game became full, the join request was withdrawn)
    try {
      const page = await loadGamePage(id, user);
      showPage(page);
    } catch (error) {
      console.error("Error fetching the game:", error);
    } finally {
      setWorking(false);
    }
  };

  const handleSendJoinRequest = () => {
    runJoinAction(() => sendJoinRequest(id));
  };

  const handleWithdrawJoinRequest = () => {
    runJoinAction(() => withdrawJoinRequest(id, myJoinRequest._id));
  };

  const handleAcceptJoinRequest = (joinRequest) => {
    runJoinAction(() => answerJoinRequest(id, joinRequest._id, "accepted"));
  };

  const handleDeclineJoinRequest = () => {
    const joinRequest = joinRequestToDecline;
    setJoinRequestToDecline(null);
    runJoinAction(() => answerJoinRequest(id, joinRequest._id, "declined"));
  };

  // Leaving and removing go through runJoinAction too: both free a place
  // and delete a join request, so the same parts of the page change
  const handleLeaveGame = () => {
    setConfirmingLeave(false);
    runJoinAction(() => deletePlayer(id, myPlayer._id));
  };

  const handleRemovePlayer = () => {
    const player = playerToRemove;
    setPlayerToRemove(null);
    runJoinAction(() => deletePlayer(id, player._id));
  };

  if (loading) return <p className="text-center py-5">Loading...</p>;

  if (loadError) {
    return (
      <div className="container text-center py-5">
        <h1 className="h2 mb-3">{loadError}</h1>
        <Link className="btn btn-primary" to="/">
          Back to Home
        </Link>
      </div>
    );
  }

  const badge = STATUS_BADGES[game.status];

  // Either side can be missing when that account was deleted
  const isOrganizer = (player) => {
    if (!game.organizer || !player.user) return false;
    return player.user._id === game.organizer._id;
  };

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div>
          <h1 className="h2 mb-1">
            {game.sport} in {game.city}{" "}
            <span className={`badge text-bg-${badge.variant} fs-6 align-middle`}>
              {badge.label}
            </span>
          </h1>
          <p className="text-muted mb-0">Organizer: {game.organizerName()}</p>
        </div>
        {game.canBeChangedBy(user) && (
          <div className="d-flex gap-2">
            <Link className="btn btn-outline-primary" to={`/games/${id}/edit`}>
              Edit game
            </Link>
            <button
              className="btn btn-outline-danger"
              type="button"
              disabled={cancelling}
              onClick={() => setConfirmingCancel(true)}
            >
              Cancel game
            </button>
          </div>
        )}
      </div>

      {cancelError && <div className="alert alert-danger">{cancelError}</div>}
      {joinError && <div className="alert alert-danger">{joinError}</div>}

      <JoinPanel
        user={user}
        game={game}
        isPlayer={myPlayer !== undefined}
        joinRequest={myJoinRequest}
        working={working}
        onSend={handleSendJoinRequest}
        onWithdraw={handleWithdrawJoinRequest}
        onLeave={() => setConfirmingLeave(true)}
      />

      <div className="row g-4">
        <div className="col-12 col-md-7">
          <div className="card h-100">
            <div className="card-header">Details</div>
            <div className="card-body">
              <dl className="row mb-0">
                <dt className="col-5 col-sm-4">Sport</dt>
                <dd className="col-7 col-sm-8">{game.sport}</dd>
                <dt className="col-5 col-sm-4">City</dt>
                <dd className="col-7 col-sm-8">{game.city}</dd>
                <dt className="col-5 col-sm-4">Venue</dt>
                <dd className="col-7 col-sm-8">{game.venue}</dd>
                <dt className="col-5 col-sm-4">Start time</dt>
                <dd className="col-7 col-sm-8">
                  {formatDateTime(game.startTime)}
                </dd>
                <dt className="col-5 col-sm-4">Duration</dt>
                <dd className="col-7 col-sm-8">{game.duration} min</dd>
                <dt className="col-5 col-sm-4">Players</dt>
                <dd className="col-7 col-sm-8">
                  {game.playerCount} of {game.maxPlayers} ·{" "}
                  {formatPlaces(game.placesLeft())}
                </dd>
                <dt className="col-5 col-sm-4">Notes</dt>
                <dd className="col-7 col-sm-8 mb-0">
                  {game.notes || <span className="text-muted">No notes</span>}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-5">
          <div className="card h-100">
            <div className="card-header">
              Players{" "}
              <span className="text-muted">
                ({game.playerCount} of {game.maxPlayers})
              </span>
            </div>
            <ul className="list-group list-group-flush">
              {players.map((player) => (
                <li
                  className="list-group-item d-flex justify-content-between align-items-center gap-2"
                  key={player._id}
                >
                  <span>
                    {player.username()}{" "}
                    {isOrganizer(player) && (
                      <span className="badge text-bg-dark">Organizer</span>
                    )}
                  </span>
                  {/* The organizer is never removed: the game is cancelled
                      instead. An admin who is a player has "Leave game" for
                      their own row. */}
                  {game.playersCanBeRemovedBy(user) &&
                    !isOrganizer(player) &&
                    player !== myPlayer && (
                    <button
                      className="btn btn-outline-danger btn-sm"
                      type="button"
                      disabled={working}
                      onClick={() => setPlayerToRemove(player)}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {game.showsJoinRequestsTo(user) && (
        <div className="row mt-4">
          <div className="col-12 col-lg-6">
            <PendingJoinRequests
              joinRequests={pendingJoinRequests}
              canAnswer={game.canBeChangedBy(user)}
              working={working}
              onAccept={handleAcceptJoinRequest}
              onDecline={setJoinRequestToDecline}
            />
          </div>
        </div>
      )}

      {joinRequestToDecline && (
        <Modal
          title="Decline this join request?"
          text={`${joinRequestToDecline.username()} will not be able to send another join request to this game. This cannot be undone.`}
          confirmLabel="Decline"
          cancelLabel="Go back"
          confirmVariant="danger"
          onConfirm={handleDeclineJoinRequest}
          onClose={() => setJoinRequestToDecline(null)}
        />
      )}

      {confirmingLeave && (
        <Modal
          title="Leave this game?"
          text="Your place will be freed for someone else. You can send a new join request later, if the game is not full by then."
          confirmLabel="Leave game"
          cancelLabel="Stay"
          confirmVariant="danger"
          onConfirm={handleLeaveGame}
          onClose={() => setConfirmingLeave(false)}
        />
      )}

      {playerToRemove && (
        <Modal
          title="Remove this player?"
          text={`${playerToRemove.username()} will lose their place in this game. They can send a new join request later.`}
          confirmLabel="Remove"
          cancelLabel="Go back"
          confirmVariant="danger"
          onConfirm={handleRemovePlayer}
          onClose={() => setPlayerToRemove(null)}
        />
      )}

      {confirmingCancel && (
        <Modal
          title="Cancel this game?"
          text={`${game.sport} in ${game.city} on ${formatDateTime(game.startTime)} will be deleted together with its join requests, players and chat messages. This cannot be undone.`}
          confirmLabel="Cancel game"
          cancelLabel="Keep game"
          confirmVariant="danger"
          onConfirm={handleCancelGame}
          onClose={() => setConfirmingCancel(false)}
        />
      )}
    </div>
  );
};

export default GamePage;
