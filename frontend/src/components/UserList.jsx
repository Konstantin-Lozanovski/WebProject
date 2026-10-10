import { useState, useEffect } from "react";
import Modal from "./Modal.jsx";
import { fetchUsers, updateUserRole, deleteUser } from "../services/api.js";
import { ROLES, ROLE_LABELS } from "../models/User.js";

// Every user of the app, with the controls to change a role and to delete
// a user. Only shown to admins; user is the logged-in admin.
// onDelete is called after a user was deleted, so the screen around the
// list can load again what the delete changed.
const UserList = ({ user, onDelete }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Why the last role change or delete was refused; empty when it worked
  const [actionError, setActionError] = useState("");
  // True while an action is on its way, so it cannot be sent twice
  const [working, setWorking] = useState(false);
  // The user waiting in the "Delete?" popup, or null
  const [userToDelete, setUserToDelete] = useState(null);

  useEffect(() => {
    const getUsers = async () => {
      try {
        const loaded = await fetchUsers();
        setUsers(loaded);
      } catch (error) {
        console.error("Error fetching the users:", error);
        setLoadError("The users could not be loaded. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    getUsers();
  }, []);

  const handleRoleChange = async (listedUser, role) => {
    setActionError("");
    setWorking(true);

    try {
      const updated = await updateUserRole(listedUser._id, role);
      // The select shows the role in state, so it only moves to the new
      // role once the server has saved it
      setUsers((current) => {
        return current.map((one) => (one._id === updated._id ? updated : one));
      });
    } catch (error) {
      console.error("Error changing the role:", error);
      const data = error.response ? error.response.data : null;
      const reason = data ? data.msg : "The server could not be reached";
      setActionError(
        `The role of ${listedUser.username} could not be changed: ${reason}`,
      );
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async () => {
    const listedUser = userToDelete;
    setUserToDelete(null);
    setActionError("");
    setWorking(true);

    try {
      await deleteUser(listedUser._id);
      setUsers((current) => {
        return current.filter((one) => one._id !== listedUser._id);
      });
      onDelete();
    } catch (error) {
      console.error("Error deleting the user:", error);
      const data = error.response ? error.response.data : null;
      const reason = data ? data.msg : "The server could not be reached";
      setActionError(`${listedUser.username} could not be deleted: ${reason}`);
    } finally {
      setWorking(false);
    }
  };

  const renderRow = (listedUser) => {
    // An admin cannot demote or delete themselves, so the controls of
    // their own row are switched off. The server refuses it too.
    const isMe = listedUser._id === user._id;

    return (
      <tr key={listedUser._id}>
        <td>
          {listedUser.username}{" "}
          {isMe && <span className="badge text-bg-dark">You</span>}
        </td>
        <td>{listedUser.email}</td>
        <td>
          <select
            className="form-select form-select-sm w-auto"
            aria-label={`Role of ${listedUser.username}`}
            value={listedUser.role}
            disabled={isMe || working}
            onChange={(e) => handleRoleChange(listedUser, e.target.value)}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </td>
        <td className="text-end">
          <button
            className="btn btn-outline-danger btn-sm"
            type="button"
            disabled={isMe || working}
            onClick={() => setUserToDelete(listedUser)}
          >
            Delete
          </button>
        </td>
      </tr>
    );
  };

  const renderTable = () => {
    if (loading) return <p className="text-muted">Loading users...</p>;
    if (loadError) return <div className="alert alert-danger">{loadError}</div>;

    return (
      <div className="table-responsive">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>{users.map(renderRow)}</tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <h2 className="h4 mb-3">Users</h2>
      {actionError && <div className="alert alert-danger">{actionError}</div>}
      {renderTable()}

      {userToDelete && (
        <Modal
          title="Delete this user?"
          text={`The upcoming games ${userToDelete.username} organizes are cancelled, and their join requests and their places in upcoming games are deleted. Their finished games and messages stay, shown with "deleted user" in place of the name. This cannot be undone.`}
          confirmLabel="Delete user"
          cancelLabel="Keep user"
          confirmVariant="danger"
          onConfirm={handleDelete}
          onClose={() => setUserToDelete(null)}
        />
      )}
    </>
  );
};

export default UserList;
