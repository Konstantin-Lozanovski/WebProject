import { Link, NavLink, useNavigate } from "react-router-dom";

// user is null for a guest
const Navigation = ({ user, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    // The page being viewed may be one a guest cannot use
    navigate("/");
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark topbar">
      <div className="container">
        <Link className="navbar-brand" to="/">
          Pickup Game Organizer
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
            <ul className="navbar-nav">
              <li className="nav-item">
                <span className="navbar-text me-lg-2">{user.username}</span>
              </li>
              <li className="nav-item">
                <button
                  className="nav-link btn btn-link"
                  type="button"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </li>
            </ul>
          ) : (
            <ul className="navbar-nav">
              <li className="nav-item">
                <NavLink className="nav-link" to="/login">
                  Log in
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/register">
                  Register
                </NavLink>
              </li>
            </ul>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
