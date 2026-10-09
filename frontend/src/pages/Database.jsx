import { useState } from "react";
import Modal from "../components/Modal.jsx";
import { deleteAllData, seedInitialData } from "../services/api.js";

// What the popup shows for each of the two actions
const CONFIRMATIONS = {
  delete: {
    title: "Delete all data?",
    text: "Everything in the database will be deleted, including every account. This cannot be undone.",
    confirmLabel: "Delete all data",
    cancelLabel: "Keep data",
    confirmVariant: "danger",
  },
  seed: {
    title: "Seed initial data?",
    text: "The current data will be deleted and replaced with the initial data.",
    confirmLabel: "Seed initial data",
    cancelLabel: "Go back",
    confirmVariant: "primary",
  },
};

// Turns { users: 7 } into "7 users"
const describeCounts = (counts) => {
  const parts = [];
  for (const name of Object.keys(counts)) {
    parts.push(`${counts[name]} ${name}`);
  }
  return parts.join(", ");
};

const Database = ({ onLogout }) => {
  // Which action is waiting in the popup: null, "delete" or "seed"
  const [pendingAction, setPendingAction] = useState(null);
  // The outcome of the last action: { variant: "success", text: "..." }
  const [result, setResult] = useState(null);
  const [working, setWorking] = useState(false);

  const closeModal = () => {
    setPendingAction(null);
  };

  const runAction = async (action) => {
    if (action === "delete") {
      await deleteAllData();
      return "All data was deleted.";
    }

    const data = await seedInitialData();
    return `Initial data seeded: ${describeCounts(data.counts)}.`;
  };

  const handleConfirm = async () => {
    const action = pendingAction;
    closeModal();
    setResult(null);
    setWorking(true);

    try {
      const text = await runAction(action);
      // Both actions delete every account, the logged-in one too, so the
      // browser must forget the user it had
      onLogout();
      setResult({ variant: "success", text });
    } catch (error) {
      console.error("Error changing the database:", error);
      const data = error.response ? error.response.data : null;
      // An answer from the server means the action started, so some or all
      // of the accounts may already be gone. No answer means nothing ran.
      if (error.response) onLogout();
      const reason = data && data.msg ? data.msg : "the server could not be reached";
      setResult({ variant: "danger", text: `The action failed: ${reason}` });
    } finally {
      setWorking(false);
    }
  };

  const confirmation = pendingAction ? CONFIRMATIONS[pendingAction] : null;

  return (
    <div className="container py-4">
      <h1 className="h2 mb-2">Database</h1>
      <p className="text-muted mb-4">
        Tools for testing the app and returning it to a known starting point.
        No login is needed.
      </p>

      {working && <div className="alert alert-info">Working...</div>}
      {result && (
        <div className={`alert alert-${result.variant}`}>{result.text}</div>
      )}

      <div className="row g-4">
        <div className="col-12 col-md-6">
          <div className="card h-100">
            <div className="card-body d-flex flex-column">
              <h2 className="h5">Delete all data</h2>
              <p>Empties every collection in the database.</p>
              <button
                className="btn btn-danger mt-auto align-self-start"
                type="button"
                disabled={working}
                onClick={() => setPendingAction("delete")}
              >
                Delete all data
              </button>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card h-100">
            <div className="card-body d-flex flex-column">
              <h2 className="h5">Seed initial data</h2>
              <p>
                Clears the database first, then adds the initial data: one
                admin and several users.
              </p>
              <button
                className="btn btn-primary mt-auto align-self-start"
                type="button"
                disabled={working}
                onClick={() => setPendingAction("seed")}
              >
                Seed initial data
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmation && (
        <Modal
          title={confirmation.title}
          text={confirmation.text}
          confirmLabel={confirmation.confirmLabel}
          cancelLabel={confirmation.cancelLabel}
          confirmVariant={confirmation.confirmVariant}
          onConfirm={handleConfirm}
          onClose={closeModal}
        />
      )}
    </div>
  );
};

export default Database;
