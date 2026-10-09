import { validationResult } from "express-validator";
import { BadRequestError } from "../errors/index.js";

// Goes after a list of validation rules on a route. The rules only collect
// problems; this is what stops the request before it reaches the controller.
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  // One message per field, keyed by the field's name
  const fields = {};
  for (const error of result.array({ onlyFirstError: true })) {
    fields[error.path] = error.msg;
  }

  const messages = Object.values(fields);
  throw new BadRequestError(messages.join(", "), fields);
};

export default validate;
