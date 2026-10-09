import mongoose from "mongoose";
import User from "../models/user.model.js";

// The demo logins. They are known on purpose, so anyone testing the app
// can log in as each role.
const ADMIN_PASSWORD = "admin1234";
const USER_PASSWORD = "football1";

const DEMO_USERS = [
  {
    username: "admin",
    email: "admin@example.com",
    password: ADMIN_PASSWORD,
    role: "admin",
  },
  { username: "marko_p", email: "marko@example.com", password: USER_PASSWORD },
  { username: "sara_b", email: "sara@example.com", password: USER_PASSWORD },
  { username: "ivan_t", email: "ivan@example.com", password: USER_PASSWORD },
  { username: "elena_k", email: "elena@example.com", password: USER_PASSWORD },
  { username: "david_m", email: "david@example.com", password: USER_PASSWORD },
  { username: "ana_s", email: "ana@example.com", password: USER_PASSWORD },
];

// Empties every collection but keeps the collections themselves, so the
// unique indexes stay in place.
// mongoose.models holds every model the app has loaded, so a model added
// by a later feature is cleared too without changing this function.
export const clearDatabase = async () => {
  for (const model of Object.values(mongoose.models)) {
    await model.deleteMany({});
  }
};

const seedUsers = async () => {
  // create and not insertMany, because create saves the users one by one,
  // and saving is what runs the hook that hashes the password
  return User.create(DEMO_USERS);
};

// Clears first, so seeding twice gives the same data and not two copies.
// Each feature adds its own seed function above and one step here, in the
// order the documents depend on each other. The answer says how many
// documents each collection got.
export const seedDatabase = async () => {
  await clearDatabase();

  const users = await seedUsers();

  return { users: users.length };
};
