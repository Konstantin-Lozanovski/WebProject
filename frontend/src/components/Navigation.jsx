import { Link, NavLink, useNavigate } from "react-router-dom";
import Avatar from "./Avatar.jsx";

// user is null for a guest
const Navigation = ({ user, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    // The page being viewed may be one a guest cannot use
    navigate("/");
  };

  return (
    // sticky-top keeps the navigation in view while the page scrolls
    <nav className="navbar navbar-expand-lg navbar-dark topbar sticky-top">
      <div className="container">
        <Link className="navbar-brand" to="/">
          {/* Empty alt: the name next to it already says what the logo is */}
          <img className="brand-logo" src="/favicon.svg" alt="" />
          {/* One span around the whole name, so the gap between the logo
              and the name does not also split "Pickup" from "Games" */}
          <span>
            Pickup<span className="brand-light">Games</span>
          </span>
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNav"
          aria-controls="mainNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="mainNav">
          {/* NavLink adds the "active" class to the link of the current page */}
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <NavLink className="nav-link" to="/" end>
                Home
              </NavLink>
            </li>
            {/* Hiding links is only for tidiness; the API does the real checks */}
            {user && (
              <li className="nav-item">
                <NavLink className="nav-link" to="/games/new">
                  Create game
                </NavLink>
              </li>
            )}
            {user && (
              <li className="nav-item">
                <NavLink className="nav-link" to="/my-games">
                  My games
                </NavLink>
              </li>
            )}
            {user && user.isAdmin() && (
              <li className="nav-item">
                <NavLink className="nav-link" to="/admin">
                  Admin overview
                </NavLink>
              </li>
            )}
            <li className="nav-item">
              <NavLink className="nav-link" to="/db">
                Database
              </NavLink>
            </li>
          </ul>
          {user ? (
            <div className="d-flex align-items-center gap-2 py-2 py-lg-0">
              <div className="user-chip" title={`Logged in as ${user.username}`}>
                <Avatar name={user.username} />
                <span className="user-name text-truncate">{user.username}</span>
                {user.isAdmin() && (
                  <span className="badge text-bg-warning">Admin</span>
                )}
              </div>
              <button
                className="btn btn-outline-light btn-sm"
                type="button"
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          ) : (
            // navbar-nav gives the Log in link the colours of the other links;
            // flex-row keeps the two next to each other on a phone too
            <div className="navbar-nav flex-row align-items-center gap-2 py-2 py-lg-0">
              <NavLink className="nav-link" to="/login">
                Log in
              </NavLink>
              <Link className="btn btn-light btn-sm" to="/register">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
