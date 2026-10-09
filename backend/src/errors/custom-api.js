// Base class for every error we throw on purpose.
// The error handler reads statusCode to decide the HTTP status.
class CustomAPIError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export default CustomAPIError;
