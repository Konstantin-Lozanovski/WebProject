import { StatusCodes } from "http-status-codes";
import CustomAPIError from "./custom-api.js";

// 409: the request is valid, but a rule of the app refuses it
// (for example an overlap with another game)
class ConflictError extends CustomAPIError {
  constructor(message) {
    super(message, StatusCodes.CONFLICT);
  }
}

export default ConflictError;
