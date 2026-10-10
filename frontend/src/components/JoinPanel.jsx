import { Link } from "react-router-dom";

// How each state is shown: its text and the Bootstrap colour of its badge
const STATE_BADGES = {
  pending: { label: "Pending", variant: "warning" },
  accepted: { label: "Accepted", variant: "success" },
  declined: { label: "Declined", variant: "secondary" },
};

// What the person looking at a game sees about joining it: the way in
// ("Log in to join" or "Request to join"), the state of the join request
// they already sent, or the way out ("Leave game") once they are a player.
// user is the logged-in user or null; joinRequest is their join request for
// this game or null; isPlayer says whether they are a player in it.
// working is true while an action is on its way, so it cannot be sent twice.
const JoinPanel = ({
  user,
  game,
  isPlayer,
  joinRequest,
  working,
  onSend,
  onWithdraw,
  onLeave,
}) => {
  const getRequestContent = () => {
    const badge = STATE_BADGES[joinRequest.state];
    // Only a pending join request of a game that has not started yet can
    // be withdrawn, and only until one hour before the start
    const isOpen = joinRequest.isPending() && game.status === "upcoming";
    const canWithdraw = isOpen && game.startsInMoreThanAnHour();

    return (
      <>
        <span>
          Your join request:{" "}
          <span className={`badge text-bg-${badge.variant}`}>{badge.label}</span>
          {joinRequest.state === "declined" && (
            <small className="text-muted d-block">
              A decline is final, so you cannot send another join request to
              this game.
            </small>
          )}
        </span>
        {canWithdraw && (
          <button
            className="btn btn-outline-danger btn-sm"
            type="button"
            disabled={working}
            onClick={onWithdraw}
          >
            Withdraw
          </button>
        )}
        {isOpen && !canWithdraw && (
          <small className="text-muted">
            It can no longer be withdrawn: the game starts in less than one
            hour.
          </small>
        )}
      </>
    );
  };

  // What a player other than the organizer sees: the way out
  const getPlayerContent = () => {
    // Leaving is allowed until one hour before the start. An admin is not
    // held to that, on the server either.
    const canLeave = user.isAdmin() || game.startsInMoreThanAnHour();

    return (
      <>
        <span>You are a player in this game.</span>
        {canLeave && (
          <button
            className="btn btn-outline-danger btn-sm"
            type="button"
            disabled={working}
            onClick={onLeave}
          >
            Leave game
          </button>
        )}
        {game.status === "upcoming" && !canLeave && (
          <small className="text-muted">
            You can no longer leave: the game starts in less than one hour.
          </small>
        )}
      </>
    );
  };

  // Returns null when there is nothing to say about joining
  const getContent = () => {
    if (isPlayer) {
      // The organizer cannot leave their own game; they cancel it instead
      if (game.isOrganizedBy(user)) return null;
      return getPlayerContent();
    }
    if (joinRequest) return getRequestContent();
    // Join requests are sent until the game starts
    if (game.status !== "upcoming") return null;

    if (!user) {
      return (
        <>
          <span>Want to play in this game?</span>
          <Link className="btn btn-primary btn-sm" to="/login">
            Log in to join
          </Link>
        </>
      );
    }

    if (game.isFull()) return <span>This game is full.</span>;

    return (
      <>
        <span>Want to play in this game?</span>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          disabled={working}
          onClick={onSend}
        >
          Request to join
        </button>
      </>
    );
  };

  const content = getContent();
  if (!content) return null;

  return (
    <div className="card mb-4">
      <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-2">
        {content}
      </div>
    </div>
  );
};

export default JoinPanel;
