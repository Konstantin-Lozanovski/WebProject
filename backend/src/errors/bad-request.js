import { StatusCodes } from "http-status-codes";
import CustomAPIError from "./custom-api.js";

class BadRequestError extends CustomAPIError {
  constructor(message, fields) {
    super(message, StatusCodes.BAD_REQUEST, fields);
  }
}

export default BadRequestError;
