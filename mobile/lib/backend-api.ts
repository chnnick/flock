import {
  ApiChatMessage,
  ApiChatRoomDetail,
  ApiChatRoomSummary,
  ApiCommuteCreate,
  ApiCommutePatch,
  ApiCommuteResponse,
  ApiMatchRunResponse,
  ApiMatchSuggestion,
  ApiUser,
  ApiUserCreate,
  ApiUserUpdate,
} from '@/lib/api-types';
import { apiRequest } from '@/lib/query-client';

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function getMeUser(): Promise<ApiUser> {
  return parseJson<ApiUser>(await apiRequest('GET', '/api/users/me'));
}

export async function createMeUser(payload: ApiUserCreate): Promise<ApiUser> {
  return parseJson<ApiUser>(await apiRequest('POST', '/api/users/me', payload));
}

export async function patchMeUser(payload: ApiUserUpdate): Promise<ApiUser> {
  return parseJson<ApiUser>(await apiRequest('PATCH', '/api/users/me', payload));
}

export async function getMeCommute(): Promise<ApiCommuteResponse> {
  return parseJson<ApiCommuteResponse>(await apiRequest('GET', '/api/commutes/me'));
}

export async function createMeCommute(payload: ApiCommuteCreate): Promise<ApiCommuteResponse> {
  return parseJson<ApiCommuteResponse>(await apiRequest('POST', '/api/commutes/me', payload));
}

export async function patchMeCommute(payload: ApiCommutePatch): Promise<ApiCommuteResponse> {
  return parseJson<ApiCommuteResponse>(await apiRequest('PATCH', '/api/commutes/me', payload));
}

export async function queueMeCommute(): Promise<ApiCommuteResponse> {
  return parseJson<ApiCommuteResponse>(await apiRequest('POST', '/api/commutes/me/queue'));
}

export async function suggestionsMeCommute(): Promise<ApiCommuteResponse> {
  return parseJson<ApiCommuteResponse>(await apiRequest('POST', '/api/commutes/me/suggestions'));
}

export async function pauseMeCommute(): Promise<ApiCommuteResponse> {
  return parseJson<ApiCommuteResponse>(await apiRequest('POST', '/api/commutes/me/pause'));
}

export async function runMatching(runQueue: boolean): Promise<ApiMatchRunResponse> {
  const query = runQueue ? '?run_queue=true' : '';
  return parseJson<ApiMatchRunResponse>(await apiRequest('POST', `/api/matching/run${query}`));
}

export async function getSuggestions(kind: 'individual' | 'group'): Promise<ApiMatchSuggestion[]> {
  return parseJson<ApiMatchSuggestion[]>(
    await apiRequest('GET', `/api/matching/suggestions?kind=${kind}`),
  );
}

export async function getActive(kind: 'individual' | 'group'): Promise<ApiMatchSuggestion[]> {
  return parseJson<ApiMatchSuggestion[]>(
    await apiRequest('GET', `/api/matching/active?kind=${kind}`),
  );
}

export async function getAssignments(
  kind: 'individual' | 'group',
  date: string,
): Promise<ApiMatchSuggestion[]> {
  return parseJson<ApiMatchSuggestion[]>(
    await apiRequest('GET', `/api/matching/assignments?kind=${kind}&date=${date}`),
  );
}

export async function acceptSuggestion(suggestionId: string): Promise<ApiMatchSuggestion> {
  return parseJson<ApiMatchSuggestion>(
    await apiRequest('POST', `/api/matching/suggestions/${suggestionId}/accept`),
  );
}

export async function passSuggestion(suggestionId: string): Promise<ApiMatchSuggestion> {
  return parseJson<ApiMatchSuggestion>(
    await apiRequest('POST', `/api/matching/suggestions/${suggestionId}/pass`),
  );
}

export async function getChats(): Promise<ApiChatRoomSummary[]> {
  return parseJson<ApiChatRoomSummary[]>(await apiRequest('GET', '/api/chats'));
}

export async function getChatRoom(roomId: string): Promise<ApiChatRoomDetail> {
  return parseJson<ApiChatRoomDetail>(await apiRequest('GET', `/api/chats/${roomId}`));
}

export async function sendChatMessage(roomId: string, body: string): Promise<ApiChatMessage> {
  return parseJson<ApiChatMessage>(
    await apiRequest('POST', `/api/chats/${roomId}/messages`, { body }),
  );
}


