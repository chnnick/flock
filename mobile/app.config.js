const path = require("path");
// Load .env: repo root first, then mobile/ so local overrides (same semantics as before)
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const appJson = require("./app.json");
const expoConfig = appJson.expo ?? {};

const publicEnvKeys = [
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_DOMAIN",
  "EXPO_PUBLIC_API_TOKEN",
  "EXPO_PUBLIC_DEV_AUTH0_ID",
];

const extra = { ...(expoConfig.extra ?? {}) };
for (const key of publicEnvKeys) {
  const value = process.env[key];
  if (value !== undefined) {
    extra[key] = value;
  }
}

module.exports = {
  ...appJson,
  expo: {
    ...expoConfig,
    extra,
  },
};

