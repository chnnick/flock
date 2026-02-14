import { fetch } from "expo/fetch";

export interface UserForIntro {
  name: string;
  occupation: string;
  interests: string[];
}

/**
 * Fetch a Gemini-generated introduction for mutual friends.
 * Returns null if the API is unavailable or the request fails.
 */
export async function fetchIntroduction(users: UserForIntro[]): Promise<string | null> {
  const host = process.env.EXPO_PUBLIC_DOMAIN;
  if (!host || users.length < 2) return null;

  const baseUrl = host.startsWith("http")
    ? host
    : host.startsWith("localhost")
      ? `http://${host}`
      : `https://${host}`;
  const url = `${baseUrl}/api/chat/introduction`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ users }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { introduction: string };
    return data.introduction?.trim() || null;
  } catch {
    return null;
  }
}
