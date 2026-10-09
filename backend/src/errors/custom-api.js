// Base class for every error we throw on purpose.
// The error handler reads statusCode to decide the HTTP status.
// fields is optional: an object like { email: "message" } that lets the
// frontend show a message beside the input it belongs to.
class CustomAPIError extends Error {
  constructor(message, statusCode, fields) {
    super(message);
    this.statusCode = statusCode;
    this.fields = fields;
  }
}

export default CustomAPIError;
