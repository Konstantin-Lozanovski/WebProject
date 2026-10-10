import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="container text-center py-5">
      {/* "404" with the logo as the zero. Only decoration: the title under
          it says the same in words. */}
      <div className="not-found-code" aria-hidden="true">
        4
        <div className="hero-ball hero-ball-quick">
          <img src="/favicon.svg" alt="" />
        </div>
        4
      </div>
      <h1 className="h2 mb-3">Page not found</h1>
      <p className="text-muted">This page does not exist, or is not built yet.</p>
      <Link className="btn btn-primary" to="/">
        Back to Home
      </Link>
    </div>
  );
};

export default NotFound;
