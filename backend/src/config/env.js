import "dotenv/config";

// Every setting the backend reads from the environment is listed here,
// so no other file touches process.env

export const PORT = process.env.PORT || 5000;

// Local MongoDB is the default. The cloud host (Render) sets MONGO_URI to
// the Atlas address, and docker-compose sets it to the mongo container.
export const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/pickup-games";

// The key that signs the login tokens. The fallback is only good enough for
// running locally and in Docker; the cloud host must set its own JWT_SECRET,
// because anyone who knows the key can make a token for any user.
export const JWT_SECRET = process.env.JWT_SECRET || "local-development-secret";

// Fixed by the plan: a user stays logged in for a week
export const JWT_LIFETIME = "7d";
