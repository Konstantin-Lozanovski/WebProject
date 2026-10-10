import { useState, useEffect } from "react";
import Modal from "./Modal.jsx";
import { fetchMessages, postMessage, deleteMessage } from "../services/api.js";

// How often the chat asks the server for its messages, in milliseconds
const REFRESH_EVERY = 5000;
// The same rule the server checks: 1 to 500 characters
const TEXT_REGEX = /^.{1,500}$/;
const TEXT_MAX_LENGTH = 500;

const MINUTE = 60 * 1000;

// "1 minute ago" or "3 minutes ago"
const formatAgo = (count, unit) => {
  if (count === 1) return `1 ${unit} ago`;
  return `${count} ${unit}s ago`;
};

// How long ago the date was, in the biggest unit that fits: "just now",
// "5 minutes ago", "3 hours ago" or "2 days ago"
const timeAgo = (date) => {
  const minutes = Math.floor((Date.now() - date.getTime()) / MINUTE);
  if (minutes < 1) return "just now";
  if (minutes < 60) return formatAgo(minutes, "minute");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatAgo(hours, "hour");

  return formatAgo(Math.floor(hours / 24), "day");
};

// The chat of one game. The Game page only shows it to the game's players
// and to admins.
// user is the logged-in user. canPost says whether they are a player in the
// game: an admin who is not one reads and deletes, but cannot post.
const Chat = ({ gameId, user, canPost }) => {
  const [messages, setMessages] = useState([]);
  // Why the chat could not be loaded; empty when the last load worked
  const [loadError, setLoadError] = useState("");
  // True once the server refused the chat or the game is gone: the user was
  // removed from the game, or the game was cancelled, while the page was open
  const [closed, setClosed] = useState(false);
  // Kept in state so the input can be emptied after a message is posted
  const [text, setText] = useState("");
  // Why the last message was not posted or deleted; empty when it was
  const [actionError, setActionError] = useState("");
  // True while a message is on its way, so it cannot be sent twice
  const [sending, setSending] = useState(false);
  // The message waiting in the "Delete?" popup, or null
  const [messageToDelete, setMessageToDelete] = useState(null);

  useEffect(() => {
    // Nothing more to ask for, so the requests stop
    if (closed) return;

    const loadMessages = async () => {
      try {
        const loaded = await fetchMessages(gameId);
        setMessages(loaded);
        setLoadError("");
      } catch (error) {
        console.error("Error fetching the chat:", error);
        const data = error.response ? error.response.data : null;
        // The server's message says why, for example when the user was
        // removed from the game while the page was open
        setLoadError(data ? data.msg : "The server could not be reached");

        const status = error.response ? error.response.status : null;
        // 403 is a user who is no longer a player; 404 is a game that no
        // longer exists. Either way the messages are not theirs to see.
        if (status === 403 || status === 404) {
          setMessages([]);
          setClosed(true);
        }
      }
    };

    loadMessages();
    // Polling: the same request again every 5 seconds, so a message from
    // another player shows up without reloading the page
    const timer = setInterval(loadMessages, REFRESH_EVERY);

    // Runs when the page is left (or the game changes), so the requests
    // stop with it
    return () => clearInterval(timer);
  }, [gameId, closed]);

  const handleSubmit = async (e) => {
    // Stops the browser from reloading the page, which is what a form does
    // by default
    e.preventDefault();

    const trimmed = text.trim();
    if (!TEXT_REGEX.test(trimmed)) {
      setActionError("Message must be 1 to 500 characters");
      return;
    }

    setActionError("");
    setSending(true);

    try {
      const message = await postMessage(gameId, trimmed);
      // Added at once, without waiting for the next refresh. current is
      // the newest list: a refresh may have changed it in the meantime,
      // and may even have brought this message already.
      setMessages((current) => {
        const alreadyShown = current.some((one) => one._id === message._id);
        return alreadyShown ? current : [...current, message];
      });
      setText("");
    } catch (error) {
      console.error("Error posting the message:", error);
      const data = error.response ? error.response.data : null;
      setActionError(data ? data.msg : "The server could not be reached");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    const message = messageToDelete;
    setMessageToDelete(null);
    setActionError("");

    try {
      await deleteMessage(gameId, message._id);
      setMessages((current) => {
        return current.filter((one) => one._id !== message._id);
      });
    } catch (error) {
      console.error("Error deleting the message:", error);
      const data = error.response ? error.response.data : null;
      setActionError(data ? data.msg : "The server could not be reached");
    }
  };

  if (closed) {
    return (
      <>
        <h2 className="h4 mb-3">Chat</h2>
        <div className="alert alert-danger">{loadError}</div>
      </>
    );
  }

  return (
    <>
      <h2 className="h4 mb-3">Chat</h2>
      {loadError && <div className="alert alert-danger">{loadError}</div>}
      {actionError && <div className="alert alert-danger">{actionError}</div>}
      <div className="card">
        {messages.length === 0 && (
          <div className="card-body text-muted">No messages yet.</div>
        )}
        <ul className="list-group list-group-flush">
          {messages.map((message) => (
            <li className="list-group-item" key={message._id}>
              <div className="d-flex justify-content-between">
                <strong>{message.username()}</strong>
                <small className="text-muted">
                  {timeAgo(message.createdAt)}
                </small>
              </div>
              <div className="d-flex justify-content-between align-items-start gap-2">
                {/* text-break keeps one very long word inside the card */}
                <span className="text-break">{message.text}</span>
                {message.canBeDeletedBy(user) && (
                  <button
                    className="btn btn-link btn-sm text-danger p-0"
                    type="button"
                    onClick={() => setMessageToDelete(message)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="card-body">
          {canPost ? (
            <form className="input-group" onSubmit={handleSubmit} noValidate>
              <input
                className="form-control"
                type="text"
                placeholder="Write a message"
                aria-label="Message"
                maxLength={TEXT_MAX_LENGTH}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button className="btn btn-primary" type="submit" disabled={sending}>
                Send
              </button>
            </form>
          ) : (
            <small className="text-muted">
              You are not a player in this game, so you can read its chat and
              delete messages, but not post.
            </small>
          )}
        </div>
      </div>

      {messageToDelete && (
        <Modal
          title="Delete this message?"
          text={`"${messageToDelete.text}" by ${messageToDelete.username()} will be deleted for everyone. This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Go back"
          confirmVariant="danger"
          onConfirm={handleDelete}
          onClose={() => setMessageToDelete(null)}
        />
      )}
    </>
  );
};

export default Chat;
