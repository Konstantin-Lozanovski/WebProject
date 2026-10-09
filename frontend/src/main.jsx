import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
// Our own colours and the few classes of our own: must come after Bootstrap's
// stylesheet, because it changes Bootstrap's variables
import "./styles.css";
// Bootstrap's own script: needed for the collapsing navigation on small screens
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
