import { NotFoundError } from "../errors/index.js";

// Runs only when no route matched the request.
// It throws instead of answering, so the error handler stays the one
// place that turns errors into JSON.
const notFoundMiddleware = (req, res) => {
  throw new NotFoundError(`Route ${req.method} ${req.originalUrl} does not exist`);
};

export default notFoundMiddleware;
