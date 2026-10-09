import app from "./app.js";
import connectDB from "./db/connect.js";
import { PORT, MONGO_URI } from "./config/env.js";

const start = async () => {
  try {
    await connectDB(MONGO_URI);
    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`);
    });
  } catch (error) {
    // Only the message is printed, because the full error can contain
    // the connection string with its password
    console.error("Could not start the server:", error.message);
    process.exit(1);
  }
};

start();
