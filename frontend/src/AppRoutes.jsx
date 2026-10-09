import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import NotFound from "./pages/NotFound.jsx";

// All client-side routes live in this module, apart from the main app module.
// Each new screen gets one more Route here.
const AppRoutes = ({ user, onLogin }) => {
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
      {/* "*" catches every address that no other route matched */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
