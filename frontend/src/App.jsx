import { BrowserRouter } from "react-router-dom";
import Navigation from "./components/Navigation.jsx";
import Footer from "./components/Footer.jsx";
import AppRoutes from "./AppRoutes.jsx";

const App = () => {
  return (
    <BrowserRouter>
      {/* flex column + min-vh-100 keeps the footer at the bottom on short pages */}
      <div className="d-flex flex-column min-vh-100">
        <Navigation />
        <main className="container flex-grow-1 py-4">
          <AppRoutes />
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
};

export default App;
