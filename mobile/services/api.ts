import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const getAuthToken = async () => {
  return await SecureStore.getItemAsync('auth_token');
};

export const setAuthToken = async (token: string) => {
  await SecureStore.setItemAsync('auth_token', token);
};

export const deleteAuthToken = async () => {
  await SecureStore.deleteItemAsync('auth_token');
};

export const getApiUrl = () => {
  return Platform.OS === 'web' ? process.env.EXPO_PUBLIC_DOMAIN : 'http://localhost:8000';
};

export const request = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const url = new URL(endpoint, getApiUrl());
  const token = await getAuthToken();
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  });

  const response = await fetch(url.toString(), { ...options, headers });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response;
};

export const api = {
  get: (endpoint: string) => request(endpoint),
  post: (endpoint: string, data: unknown) =>
    request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  patch: (endpoint: string, data: unknown) =>
    request(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  put: (endpoint: string, data: unknown) =>
    request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (endpoint: string) =>
    request(endpoint, { method: 'DELETE' })
};