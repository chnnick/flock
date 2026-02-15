import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const AUTH_TOKEN_KEY = "auth_token";

function getPublicEnvVar(name: string): string | undefined {
  const valueFromProcess = process.env[name];
  if (valueFromProcess) {
    return valueFromProcess;
  }

  const valueFromExpoConfig = Constants.expoConfig?.extra?.[name];
  return typeof valueFromExpoConfig === "string" && valueFromExpoConfig
    ? valueFromExpoConfig
    : undefined;
}

export async function getAuthToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function deleteAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

/**
 * Gets the base URL for the FastAPI backend (e.g., "http://localhost:8000")
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  const explicitBaseUrl = getPublicEnvVar("EXPO_PUBLIC_API_BASE_URL");
  if (explicitBaseUrl) {
    return explicitBaseUrl.endsWith("/") ? explicitBaseUrl : `${explicitBaseUrl}/`;
  }

  let host = getPublicEnvVar("EXPO_PUBLIC_DOMAIN");

  if (!host) {
    throw new Error("Set EXPO_PUBLIC_API_BASE_URL or EXPO_PUBLIC_DOMAIN");
  }

  let url = new URL(`https://${host}`);

  return url.href;
}

// TODO: REMOVE WHEN IN PRODUCTION!!!
/** Only used when EXPO_PUBLIC_DEV_AUTH0_ID is set (e.g. local dev). Backend can use it to impersonate that user. Leave unset in production. */
function getAuthHeader(): Record<string, string> {
  const devAuth0Id = getPublicEnvVar("EXPO_PUBLIC_DEV_AUTH0_ID");
  const headers: Record<string, string> = {};
  if (devAuth0Id) {
    headers["x-dev-auth0-id"] = devAuth0Id;
  }
  return headers;
}

async function throwIfResNotOk(res: Response, url?: string) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const urlPart = url ? ` ${url}` : '';
    throw new Error(`${res.status}: ${text}${urlPart}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);
  const storedToken = await getAuthToken();
  const envToken = getPublicEnvVar("EXPO_PUBLIC_API_TOKEN");
  const token = storedToken ?? envToken ?? undefined;

  const res = await fetch(url.toString(), {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...getAuthHeader(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res, route);
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
    const storedToken = await getAuthToken();
    const envToken = getPublicEnvVar("EXPO_PUBLIC_API_TOKEN");
    const token = storedToken ?? envToken ?? undefined;

    const res = await fetch(url.toString(), {
      headers: {
        ...getAuthHeader(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res, queryKey.join("/"));
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
