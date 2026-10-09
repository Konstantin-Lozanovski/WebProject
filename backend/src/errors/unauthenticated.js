import { StatusCodes } from "http-status-codes";
import CustomAPIError from "./custom-api.js";

// 401: we do not know who is asking
class UnauthenticatedError extends CustomAPIError {
  constructor(message) {
    super(message, StatusCodes.UNAUTHORIZED);
  }
}

export default UnauthenticatedError;
