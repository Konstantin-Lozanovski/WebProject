import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { JWT_LIFETIME, JWT_SECRET } from "../config/env.js";

export const ROLES = ["user", "admin"];

// Exported so the request validation checks the same rules as the schema
export const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;
// Read left to right: the name before the @ (letters, digits and . _ % + -),
// one @, then the domain as words joined by single dots, ending in a word
// of at least two letters (com, mk, ...)
export const EMAIL_REGEX =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export const PASSWORD_MIN_LENGTH = 8;
export const LETTER_REGEX = /[A-Za-z]/;
export const DIGIT_REGEX = /\d/;

const hasLetterAndDigit = (password) => {
  return LETTER_REGEX.test(password) && DIGIT_REGEX.test(password);
};

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ROLES,
      default: "user",
    },
    username: {
      type: String,
      required: [true, "Please provide username"],
      trim: true,
      match: [
        USERNAME_REGEX,
        "Username must be 3 to 20 letters, digits or underscores",
      ],
    },
    email: {
      type: String,
      required: [true, "Please provide email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, "Please provide a valid email address"],
    },
    // These rules are checked against the password the user typed.
    // Mongoose validates before the pre("save") hook below replaces it
    // with the hash.
    password: {
      type: String,
      required: [true, "Please provide password"],
      minlength: [
        PASSWORD_MIN_LENGTH,
        "Password must be at least 8 characters long",
      ],
      validate: {
        validator: hasLetterAndDigit,
        message: "Password must contain at least one letter and one digit",
      },
    },
  },
  { timestamps: true },
);

// The unique index on username is written here and not as "unique: true"
// on the field, because it needs a collation. Strength 2 tells MongoDB to
// compare letters without looking at their case, so "Marko" and "marko"
// count as the same username, while each is still stored the way it was typed.
userSchema.index(
  { username: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT method
userSchema.methods.createJWT = function () {
  return jwt.sign({ id: this._id, role: this.role }, JWT_SECRET, {
    expiresIn: JWT_LIFETIME,
  });
};

export default mongoose.model("User", userSchema);
