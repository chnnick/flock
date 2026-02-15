import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Gets the base URL for the FastAPI backend (e.g., "http://localhost:8000")
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  const explicitBaseUrl = getPublicEnvVar("EXPO_PUBLIC_API_BASE_URL");
  if (explicitBaseUrl) {
    return explicitBaseUrl.endsWith("/") ? explicitBaseUrl : `${explicitBaseUrl}/`;
  }

  const host = getPublicEnvVar("EXPO_PUBLIC_DOMAIN");

  if (!host) {
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }

  // If already a full URL (http:// or https://), use as-is; otherwise prepend https://
  const base =
    host.startsWith("http://") || host.startsWith("https://")
      ? host
      : `https://${host}`;
  const url = new URL(base);

  return url.href.endsWith("/") ? url.href : `${url.href}/`;
}

function getAuthHeader(): Record<string, string> {
  const token = getPublicEnvVar("EXPO_PUBLIC_API_TOKEN");
  const devAuth0Id = getPublicEnvVar("EXPO_PUBLIC_DEV_AUTH0_ID");
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (devAuth0Id) {
    headers["x-dev-auth0-id"] = devAuth0Id;
  }
  return headers;
}

async function throwIfResNotOk(res: Response, requestLabel?: string) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const label = requestLabel ? ` ${requestLabel}` : "";
    throw new Error(`${res.status}: ${text}${label}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);
  const urlString = url.toString();

  const res = await fetch(urlString, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res, `${method} ${urlString}`);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url.toString(), {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
