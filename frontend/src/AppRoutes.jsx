import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Database from "./pages/Database.jsx";
import CreateGame from "./pages/CreateGame.jsx";
import EditGame from "./pages/EditGame.jsx";
import GamePage from "./pages/GamePage.jsx";
import MyGames from "./pages/MyGames.jsx";
import NotFound from "./pages/NotFound.jsx";

// All client-side routes live in this module, apart from the main app module.
// Each new screen gets one more Route here.
const AppRoutes = ({ user, onLogin, onLogout }) => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/* Someone who is already logged in has no use for these two screens */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login onLogin={onLogin} />}
      />
      <Route
        path="/register"
        element={
          user ? <Navigate to="/" replace /> : <Register onLogin={onLogin} />
        }
      />
      {/* A guest who types this address is sent to log in; the API would
          refuse them anyway */}
      <Route
        path="/games/new"
        element={user ? <CreateGame /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/games/:id/edit"
        element={
          user ? <EditGame user={user} /> : <Navigate to="/login" replace />
        }
      />
      <Route path="/games/:id" element={<GamePage user={user} />} />
      <Route
        path="/my-games"
        element={
          user ? <MyGames user={user} /> : <Navigate to="/login" replace />
        }
      />
      {/* Open to everyone: after "delete all" there is no admin to log in as */}
      <Route path="/db" element={<Database onLogout={onLogout} />} />
      {/* "*" catches every address that no other route matched */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
