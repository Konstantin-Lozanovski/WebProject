import { StatusCodes } from "http-status-codes";
import { CustomAPIError } from "../errors/index.js";

// Express recognises an error handler by its four parameters,
// so _next has to stay even though it is not used
const errorHandlerMiddleware = (err, req, res, _next) => {
  if (err instanceof CustomAPIError) {
    // fields is left out of the JSON when the error has none
    return res
      .status(err.statusCode)
      .json({ msg: err.message, fields: err.fields });
  }

  if (err.name === "CastError") {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ msg: `Invalid ${err.path}: expected ${err.kind}` });
  }

  // Thrown by Mongoose when a document breaks its schema rules
  if (err.name === "ValidationError") {
    const fields = {};
    for (const error of Object.values(err.errors)) {
      fields[error.path] = error.message;
    }

    const messages = Object.values(fields);
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ msg: messages.join(", "), fields });
  }

  // 11000 is MongoDB's code for a value that breaks a unique index
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    const msg = `This ${field} is already taken`;

    return res
      .status(StatusCodes.CONFLICT)
      .json({ msg, fields: { [field]: msg } });
  }

  let customError = {
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    msg: err.message || "Something went wrong try again later",
  };

  return res.status(customError.statusCode).json({ msg: customError.msg });
};

export default errorHandlerMiddleware;
