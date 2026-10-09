import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import NotFound from "./pages/NotFound.jsx";

// All client-side routes live in this module, apart from the main app module.
// Each new screen gets one more Route here.
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/* "*" catches every address that no other route matched */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
