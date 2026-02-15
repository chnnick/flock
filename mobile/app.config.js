const fs = require("fs");
const path = require("path");

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = value;
  }
}

loadEnvFile(path.resolve(__dirname, "../.env"));

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

