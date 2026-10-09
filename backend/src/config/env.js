import "dotenv/config";

// Every setting the backend reads from the environment is listed here,
// so no other file touches process.env

export const PORT = process.env.PORT || 5000;

// Local MongoDB is the default. The cloud host (Render) sets MONGO_URI to
// the Atlas address, and docker-compose sets it to the mongo container.
export const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/pickup-games";
