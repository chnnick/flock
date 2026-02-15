/**
 * API base URL for backend requests.
 * - EXPO_PUBLIC_API_URL: full URL (e.g. https://api.example.com or http://localhost:8000)
 * - EXPO_PUBLIC_DOMAIN: host only (e.g. localhost:8000); uses http for localhost, https otherwise
 */

export function getApiUrl(): string {
  const explicitUrl = process.env.EXPO_PUBLIC_API_URL;
  if (explicitUrl) {
    const base = new URL(explicitUrl).href;
    if (__DEV__) console.log("[API] base URL:", base);
    return base;
  }

  const host = process.env.EXPO_PUBLIC_DOMAIN;
  if (!host) {
    throw new Error("EXPO_PUBLIC_API_URL or EXPO_PUBLIC_DOMAIN must be set");
  }
  const hostOnly = host.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  const isLocal =
    /^(localhost|127\.0\.0\.1)$/i.test(hostOnly) ||
    /^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\./.test(hostOnly);
  const protocol = isLocal ? "http" : "https";
  const base = new URL(`${protocol}://${host.replace(/^https?:\/\//, "")}`).href;
  if (__DEV__) console.log("[API] base URL:", base);
  return base;
}
