import { StatusCodes } from "http-status-codes";
import { CustomAPIError } from "../errors/index.js";

// Express recognises an error handler by its four parameters,
// so _next has to stay even though it is not used
const errorHandlerMiddleware = (err, req, res, _next) => {
  if (err instanceof CustomAPIError) {
    return res.status(err.statusCode).json({ msg: err.message });
  }

  let customError = {
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    msg: err.message || "Something went wrong try again later",
  };

  return res.status(customError.statusCode).json({ msg: customError.msg });
};

export default errorHandlerMiddleware;
