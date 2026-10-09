import { useState, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import Navigation from "./components/Navigation.jsx";
import Footer from "./components/Footer.jsx";
import AppRoutes from "./AppRoutes.jsx";
import { fetchCurrentUser } from "./services/api.js";

const App = () => {
  // null means a guest
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // After a refresh the state is empty but the token is still in the
  // browser, so the user is asked for again from the API
  useEffect(() => {
    const restoreSession = async () => {
      if (!localStorage.getItem("token")) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await fetchCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error("Error restoring the session:", error);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const handleLogin = (loggedInUser, token) => {
    localStorage.setItem("token", token);
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  // Waiting here stops the page from showing the guest view for a moment
  // to someone who is in fact logged in
  if (loading) return <p className="text-center py-5">Loading...</p>;

  return (
    <BrowserRouter>
      {/* flex column + min-vh-100 keeps the footer at the bottom on short pages */}
      <div className="d-flex flex-column min-vh-100">
        <Navigation user={user} onLogout={handleLogout} />
        <main className="container flex-grow-1 py-4">
          <AppRoutes user={user} onLogin={handleLogin} />
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
};

export default App;
