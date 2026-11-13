// Runs before each Jest test file. dotenv never overwrites a variable that is already set,
// so these values win over backend/.env and tests can't reach Atlas, Gmail or Cloudinary.
Object.assign(process.env, {
  NODE_ENV: "test",
  LOG_LEVEL: "fatal",
  // Nothing listens on port 1, so a test that connects without the test database fails at once.
  MONGODB_URI: "mongodb://127.0.0.1:1/jest-no-database",
  JWT_SECRET: "jest-secret-".repeat(4),
  CLIENT_URL: "http://shop.test",
  TRUST_PROXY_HOPS: "0",
  SMTP_HOST: "",
  GOOGLE_CLIENT_ID: "",
  CLOUDINARY_CLOUD_NAME: "",
  CLOUDINARY_API_KEY: "",
  CLOUDINARY_API_SECRET: "",
});
