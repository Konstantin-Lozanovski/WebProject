import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="text-center py-5">
      <h1 className="h2 mb-3">Page not found</h1>
      <p className="text-muted">This page does not exist, or is not built yet.</p>
      <Link className="btn btn-primary" to="/">
        Back to Home
      </Link>
    </div>
  );
};

export default NotFound;
