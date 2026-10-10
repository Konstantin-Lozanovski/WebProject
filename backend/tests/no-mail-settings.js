// Loaded before every test file (see the test script in package.json).
// It empties the mail settings, so the tests never send a real email, even
// when backend/.env holds the settings of a real mail provider: dotenv
// leaves alone a setting that already has a value, an empty one included.
process.env.MAIL_HOST = "";
process.env.MAIL_PORT = "";
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.MAIL_FROM = "";
