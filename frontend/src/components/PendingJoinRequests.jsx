import Avatar from "./Avatar.jsx";
import EmptyState from "./EmptyState.jsx";
import { formatDateTime } from "../services/helpers.js";

// The pending join requests of a game, for its organizer and for admins.
// canAnswer says whether the Accept and Decline buttons are shown: the
// organizer loses them when the game starts.
// working is true while an action is on its way, so it cannot be sent twice.
const PendingJoinRequests = ({
  joinRequests,
  canAnswer,
  working,
  onAccept,
  onDecline,
}) => {
  return (
    <>
      <h2 className="section-title">Pending join requests</h2>
      {joinRequests.length === 0 && (
        <EmptyState
          title="No pending join requests"
          text="A new join request shows up here for you to accept or decline."
        />
      )}
      <ul className="list-group">
        {joinRequests.map((joinRequest) => (
          <li
            className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2"
            key={joinRequest._id}
          >
            <div className="d-flex align-items-center gap-2">
              <Avatar name={joinRequest.username()} />
              <div>
                {joinRequest.username()}
                <br />
                <small className="text-muted">
                  sent {formatDateTime(joinRequest.createdAt)}
                </small>
              </div>
            </div>
            {canAnswer && (
              <div className="d-flex gap-1">
                <button
                  className="btn btn-success btn-sm"
                  type="button"
                  disabled={working}
                  onClick={() => onAccept(joinRequest)}
                >
                  Accept
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  type="button"
                  disabled={working}
                  onClick={() => onDecline(joinRequest)}
                >
                  Decline
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
};

export default PendingJoinRequests;
