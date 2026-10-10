import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="footer py-4 mt-auto">
      <div className="container d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="footer-brand">
            {/* Empty alt: the name next to it already says what the logo is */}
            <img src="/favicon.svg" alt="" />
            <span>
              Pickup<span className="brand-light">Games</span>
            </span>
          </div>
          <span>Find a game. Fill a team. Play.</span>
        </div>
        <div className="footer-links">
          <Link to="/">Home</Link>
          <Link to="/db">Database</Link>
          {/* An address outside the app, so a plain link and not a Link */}
          <a href="https://open-meteo.com/">Weather data by Open-Meteo</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
