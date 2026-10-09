import { StatusCodes } from "http-status-codes";
import CustomAPIError from "./custom-api.js";

// 403: we know who is asking, and they are not allowed
class ForbiddenError extends CustomAPIError {
  constructor(message) {
    super(message, StatusCodes.FORBIDDEN);
  }
}

export default ForbiddenError;
